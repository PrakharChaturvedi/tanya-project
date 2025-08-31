import { Page } from "playwright";
import { normalize } from "../models/ticker.model";
// import { openPageForSymbol } from "../utils/playwright";
import { logger } from "../utils/logger";
import { openSymbolPage, readPriceOnce } from "../utils/playwright";


type PricePage = { symbol: string, page: any, last: number | null };
const pages = new Map<string, PricePage>();

async function ensurePage(symbol: string) {
  const s = symbol.toUpperCase();
  if (pages.has(s)) return pages.get(s)!;

  const page = await openSymbolPage(s);
  const pp: PricePage = { symbol: s, page, last: null };
  pages.set(s, pp);
  return pp;
}


export async function pumpSymbolToClient(symbol: string, client: any) {
  const pp = await ensurePage(symbol);
  const pollMs = 500; // fast polling

  const interval = setInterval(async () => {
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
  }, pollMs);

  return () => clearInterval(interval); // to stop pumping
}

/**
 * TickerManager responsibilities:
 * - maintain one Playwright Page per symbol (shared)
 * - poll the page for prices (fast polling, e.g., 500ms)
 * - maintain map symbol -> Set of WebSocket clients subscribed
 * - push updates only on price change
 *
 * WebSocket server will interact with this manager:
 *  - subscribeClient(ws, symbol)
 *  - unsubscribeClient(ws, symbol)
 *  - removeClient(ws)  // on disconnect
 */

export type WSClient = {
  id: string;
  send: (data: any) => void;
};

type SymbolState = {
  symbol: string;
  page: Page;
  lastPrice: number | null;
  clients: Set<WSClient>;
  running: boolean;
};

const symbolStates = new Map<string, SymbolState>();

/**
 * Best-effort selectors: tradingview markup may change.
 * We'll try multiple selectors and parse the first numeric text we find.
 */
async function readPriceFromPage(page: Page): Promise<number | null> {
  const selectors = [
    '[data-qa="quote-header"] [data-qa="quote-value"]',
    'div.tv-symbol-price-quote__value',
    'div.js-symbol-last',
    'span.price', // fallback
    'span.tv-symbol-price-quote__value',
    '.tv-symbol-price-quote__value', // other variants
  ];

  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (!el) continue;
      const txt = (await el.textContent())?.trim().replace(/[, ]/g, "");
      if (!txt) continue;
      const n = Number(txt);
      if (!Number.isNaN(n)) return n;
    } catch (e) {
      // ignore selector failure
    }
  }
  return null;
}

async function ensureSymbolState(symbolRaw: string): Promise<SymbolState> {
  const symbol = normalize(symbolRaw);
  let st = symbolStates.get(symbol);
  if (st) return st;

  const page = await openPageForSymbol(symbol);
  st = {
    symbol,
    page,
    lastPrice: null,
    clients: new Set(),
    running: false,
  };
  symbolStates.set(symbol, st);
  return st;
}

/**
 * Start the continuous poll loop for a symbol if not running.
 */
async function startPollingIfNeeded(state: SymbolState) {
  if (state.running) return;
  state.running = true;
  logger.info(`Starting poll loop for ${state.symbol}`);
  const pollMs = 600; // adjustable; lower = lower latency but more load

  (async () => {
    while (state.running && state.clients.size > 0) {
      try {
        const price = await readPriceFromPage(state.page);
        if (price !== null && price !== state.lastPrice) {
          state.lastPrice = price;
          const payload = {
            type: "price",
            symbol: state.symbol,
            price,
            ts: Date.now()
          };
          // broadcast to all clients for this symbol
          for (const c of state.clients) {
            try {
              c.send(JSON.stringify(payload));
            } catch (e) {
              logger.warn(`Failed to send to client ${c.id}: ${(e as Error).message}`);
            }
          }
          logger.debug(`Broadcast ${state.symbol} ${price} => ${state.clients.size} clients`);
        }
      } catch (err) {
        logger.warn(`Error polling ${state.symbol}: ${(err as Error).message}`);
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }

    // if no clients left, stop running and close page after short grace
    state.running = false;
    logger.info(`Stopping poll for ${state.symbol} (clients=${state.clients.size})`);
    // keep page open for reuse; if you prefer to close to save memory, you can add logic here
  })();
}

/**
 * Subscribe a client to a symbol.
 */
export async function subscribeClient(client: WSClient, symbolRaw: string) {
  const state = await ensureSymbolState(symbolRaw);
  state.clients.add(client);
  logger.info(`Client ${client.id} subscribed to ${state.symbol} (total ${state.clients.size})`);
  await startPollingIfNeeded(state);

  // If there's an immediate lastPrice available, send it
  if (state.lastPrice !== null) {
    client.send(JSON.stringify({
      type: "price",
      symbol: state.symbol,
      price: state.lastPrice,
      ts: Date.now()
    }));
  }
}

/**
 * Unsubscribe a client from a symbol.
 */
export function unsubscribeClient(client: WSClient, symbolRaw: string) {
  const symbol = normalize(symbolRaw);
  const state = symbolStates.get(symbol);
  if (!state) return;
  state.clients.delete(client);
  logger.info(`Client ${client.id} unsubscribed from ${symbol} (remaining ${state.clients.size})`);
}

/**
 * Remove a client from all subscriptions when disconnected.
 */
export function removeClientFromAll(client: WSClient) {
  for (const [, state] of symbolStates) {
    if (state.clients.has(client)) {
      state.clients.delete(client);
    }
  }
  logger.info(`Client ${client.id} removed from all subscriptions.`);
}

/**
 * Get current active symbols (alphabetical).
 */
export function getActiveSymbols(): string[] {
  return Array.from(symbolStates.keys()).sort((a, b) => a.localeCompare(b));
}
