import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { logger } from "./utils/logger";
import { v4 as uuidv4 } from "uuid";
import { chromium, Page } from "playwright";

// ---------------------- Playwright setup ----------------------
(async () => {
  // Use environment variable to determine headless mode, default to true for production
  const isHeadless = process.env.HEADLESS !== 'false';
  const browser = await chromium.launch({ headless: isHeadless });
  logger.info(`🚀 Playwright browser launched (${isHeadless ? 'headless' : 'headed'} mode)`);

  type PricePage = {
    symbol: string;
    page: Page;
    last: number | null;
  };

  const pages = new Map<string, PricePage>();

  async function openSymbolPage(symbol: string): Promise<Page> {
    const page = await browser.newPage();
    const url = `https://www.tradingview.com/symbols/${symbol}/?exchange=BINANCE`;
    
    try {
      // Set a longer timeout for navigation (30 seconds)
      await page.goto(url, { 
        waitUntil: "domcontentloaded", 
        timeout: 30000 
      });
      
      // Add error handler for page errors
      page.on('error', error => {
        logger.error(`Page error for ${symbol}: ${error.message}`);
      });
      
      // Add console message logging for debugging
      page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
          logger.debug(`Console ${msg.type()} from ${symbol}: ${msg.text()}`);
        }
      });
      
      logger.info(`🔗 Opened page for ${symbol}`);
      return page;
    } catch (error) {
      logger.error(`Failed to open page for ${symbol}: ${(error as Error).message}`);
      // Close the page to avoid memory leaks
      await page.close().catch(() => {});
      // Retry once more with a different approach
      try {
        const newPage = await browser.newPage();
        // Try with networkidle instead
        await newPage.goto(url, { 
          waitUntil: "networkidle", 
          timeout: 45000 
        });
        logger.info(`🔗 Opened page for ${symbol} on second attempt`);
        return newPage;
      } catch (retryError) {
        logger.error(`Failed to open page for ${symbol} on retry: ${(retryError as Error).message}`);
        throw new Error(`Could not load page for ${symbol} after multiple attempts`);
      }
    }
  }

async function readPriceOnce(page: Page): Promise<number | null> {
  const selectors = [
    '[data-qa="quote-header"] [data-qa="quote-value"]',
    '[data-qa="tv-symbol-header"] [data-qa="price"]',
    'div[data-symbol-last]:not([data-symbol-last=""])',
    'span[data-qa="last-price-value"]',
    'div.js-symbol-last',
    'div.valueValue-3kA',
    'div.tv-symbol-price-quote__value',
    'span.js-symbol-last',
  ];

  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (!el) continue;
      const text = (await el.textContent())?.trim().replace(/[, ]/g, "");
      if (!text) continue;
      const n = Number(text);
      if (!Number.isNaN(n)) return n;
    } catch { /* ignore */ }
  }
  return null;
}

async function ensurePage(symbol: string): Promise<PricePage> {
  const s = symbol.toUpperCase();
  if (pages.has(s)) {
    const existingPage = pages.get(s)!;
    // Check if the page is still valid
    if (!existingPage.page.isClosed()) {
      return existingPage;
    }
    // If page is closed, remove it from the map and create a new one
    logger.info(`Page for ${s} was closed, creating a new one`);
    pages.delete(s);
  }

  try {
    const page = await openSymbolPage(s);
    
    // Create the price page object and add it to the map
    const pricePage: PricePage = {
      symbol: s,
      page,
      last: null
    };
    
    pages.set(s, pricePage);
    return pricePage;
  } catch (error) {
    logger.error(`Failed to ensure page for ${s}: ${(error as Error).message}`);
    throw error;
  }
}

// ---------------------- WebSocket price streaming ----------------------
async function pumpSymbolToClient(symbol: string, client: any) {
  const pp = await ensurePage(symbol);
  const pollMs = 500;
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;
  
  const interval = setInterval(async () => {
    try {
      // Check if page is closed and reopen if needed
      if (pp.page.isClosed()) {
        logger.warn(`Page for ${pp.symbol} was closed, reopening...`);
        pp.page = await openSymbolPage(pp.symbol);
      }
      
      const price = await readPriceOnce(pp.page);
      if (price !== null && price !== pp.last) {
        pp.last = price;
        client.send(JSON.stringify({
          type: "price",
          ticker: pp.symbol,
          price,
          ts: Date.now(),
        }));
      }
      
      // Reset error counter on success
      consecutiveErrors = 0;
    } catch (e) {
      consecutiveErrors++;
      logger.warn(`Error reading price for ${pp.symbol}: ${(e as Error).message}. Consecutive errors: ${consecutiveErrors}`);
      
      // Try to reload the page if we have multiple consecutive errors
      if (consecutiveErrors >= maxConsecutiveErrors) {
        try {
          logger.info(`Attempting to reload page for ${pp.symbol} after ${consecutiveErrors} consecutive errors`);
          await pp.page.reload();
          consecutiveErrors = 0;
        } catch (reloadError) {
          logger.error(`Failed to reload page for ${pp.symbol}: ${(reloadError as Error).message}`);
        }
      }
    }
  }, pollMs);

  return () => clearInterval(interval); // stop function
}

// ---------------------- Express + WebSocket ----------------------
const app = express();
const port = Number(process.env.PORT) || 4000;

app.get("/", (_req: any, res: { send: (arg0: string) => void; }) => {
  res.send("Backend (WebSocket price streamer) running 🚀");
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

logger.info("Starting WebSocket server on /ws");

wss.on("connection", (ws: WebSocket) => {
  const clientId = uuidv4();
  const client = {
    id: clientId,
    send: (data: any) => ws.send(typeof data === "string" ? data : JSON.stringify(data)),
  };
  logger.info(`Client connected: ${clientId}. total clients: ${wss.clients.size}`);

  // Map to track which ticker each stop function belongs to
  const stopFuncMap = new Map<string, () => void>();

  ws.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === "subscribe" && Array.isArray(msg.tickers)) {
        for (const t of msg.tickers) {
          // If already subscribed, skip
          if (stopFuncMap.has(t)) continue;
          
          const stop = await pumpSymbolToClient(t, client);
          stopFuncMap.set(t, stop);
        }
        ws.send(JSON.stringify({ type: "subscribed", tickers: msg.tickers }));

      } else if (msg.type === "unsubscribe" && Array.isArray(msg.tickers)) {
        // Only stop intervals for the specified tickers
        for (const t of msg.tickers) {
          const stopFunc = stopFuncMap.get(t);
          if (stopFunc) {
            stopFunc();
            stopFuncMap.delete(t);
          }
        }
        ws.send(JSON.stringify({ type: "unsubscribed", tickers: msg.tickers }));

      } else if (msg.type === "list") {
        ws.send(JSON.stringify({ type: "list", symbols: Array.from(pages.keys()) }));
      } else {
        ws.send(JSON.stringify({ type: "error", error: "Unknown message type" }));
      }

    } catch (e) {
      logger.warn(`Failed to handle message from ${clientId}: ${(e as Error).message}`);
      try { ws.send(JSON.stringify({ type: "error", error: "Invalid message format" })); } catch {}
    }
  });

  ws.on("close", () => {
    // Clean up all intervals when connection closes
    for (const stopFunc of stopFuncMap.values()) {
      stopFunc();
    }
    stopFuncMap.clear();
    logger.info(`Client disconnected: ${clientId}. total clients: ${wss.clients.size}`);
  });

  ws.on("error", (err) => {
    logger.warn(`WebSocket error for client ${clientId}: ${err.message}`);
  });

  ws.send(JSON.stringify({ type: "welcome", clientId }));
});
server.listen(port, () => {
  logger.info(`Server listening on http://localhost:${port}`);
  logger.info(`WebSocket endpoint: ws://localhost:${port}/ws`);
});
})();
