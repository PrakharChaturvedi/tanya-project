export interface Ticker {
  symbol: string; // uppercase, e.g., "BTCUSD"
  createdAt: number;
}

export function normalize(symbol: string): string {
  return symbol.trim().toUpperCase();
}
