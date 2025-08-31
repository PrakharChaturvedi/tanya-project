import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { logger } from "./utils/logger";
import { v4 as uuidv4 } from "uuid";
import { chromium, Page } from "playwright";

// ---------------------- Playwright setup ----------------------
(async () => {
  const browser = await chromium.launch({ headless: false }); // headed mode
  logger.info("🚀 Playwright browser launched (headed mode)");

  type PricePage = {
    symbol: string;
    page: Page;
    last: number | null;
  };

  const pages = new Map<string, PricePage>();

  async function openSymbolPage(symbol: string): Promise<Page> {
    const page = await browser.newPage();
    const url = `https://www.tradingview.com/symbols/${symbol}/?exchange=BINANCE`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    logger.info(`🔗 Opened page for ${symbol}`);
    return page;
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
  if (pages.has(s)) return pages.get(s)!;

  const page = await openSymbolPage(s);
  const pp: PricePage = { symbol: s, page, last: null };
  pages.set(s, pp);
  return pp;
}

// ---------------------- WebSocket price streaming ----------------------
async function pumpSymbolToClient(symbol: string, client: any) {
  const pp = await ensurePage(symbol);
  const pollMs = 500;
  const interval = setInterval(async () => {
    try {
      const price = await readPriceOnce(pp.page);
      if (price !== null && price !== pp.last) {
        pp.last = price;
        client.send(JSON.stringify({
          type: "price_update",
          symbol: pp.symbol,
          price,
          ts: Date.now(),
        }));
      }
    } catch (e) {
      logger.warn(`Error reading price for ${pp.symbol}: ${(e as Error).message}`);
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

  const stopFuncs: (() => void)[] = [];

  ws.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === "subscribe" && Array.isArray(msg.tickers)) {
        for (const t of msg.tickers) {
          const stop = await pumpSymbolToClient(t, client);
          stopFuncs.push(stop);
        }
        ws.send(JSON.stringify({ type: "subscribed", tickers: msg.tickers }));

      } else if (msg.type === "unsubscribe" && Array.isArray(msg.tickers)) {
        stopFuncs.forEach(f => f());
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
    stopFuncs.forEach(f => f());
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
