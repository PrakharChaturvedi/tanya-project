import { chromium, Page, Browser } from "playwright";

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({ headless: false }); // headed mode
    console.log("🚀 Browser launched (headed mode)");
  }
  return browser;
}

export async function openSymbolPage(symbol: string): Promise<Page> {
  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();
  const url = `https://www.tradingview.com/symbols/${symbol}/?exchange=BINANCE`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  console.log(`🔗 Opened page for ${symbol}`);
  return page;
}

export async function readPriceOnce(page: Page): Promise<number | null> {
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
    } catch { /* ignore errors */ }
  }
  return null;
}
