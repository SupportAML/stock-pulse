import type { MarketQuote, CryptoQuote, OHLCV } from "./types";

const POLYGON_BASE_URL = "https://api.polygon.io";

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY CACHE  (survives across requests in the same Node.js process)
//
// Why: Polygon free plan = 5 API calls per minute. Without caching, a single
// page load + predictions generation can make 15+ calls → instant 429.
// With a 5-minute cache, the first load fetches data once and all subsequent
// requests (including /api/markets/predict) reuse it.
// ─────────────────────────────────────────────────────────────────────────────
const _cache = new Map<string, { data: any; exp: number }>();
const QUOTE_TTL = 5 * 60 * 1000;   // 5 min for quotes
const HIST_TTL  = 10 * 60 * 1000;  // 10 min for historical bars

function cached<T>(key: string): T | null {
  const entry = _cache.get(key);
  if (entry && entry.exp > Date.now()) return entry.data as T;
  _cache.delete(key);
  return null;
}

function setCache(key: string, data: any, ttl: number) {
  _cache.set(key, { data, exp: Date.now() + ttl });
}

// ─────────────────────────────────────────────────────────────────────────────
// RAW FETCH WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

export async function polygonFetch(endpoint: string): Promise<any> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    throw new Error("POLYGON_API_KEY environment variable not set");
  }

  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `${POLYGON_BASE_URL}${endpoint}${separator}apiKey=${apiKey}`;

  const response = await fetch(url, {
    next: { revalidate: 30 },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Polygon API error ${response.status}: ${text}`);
  }

  return response.json();
}

// Get the most recent trading day's date string (YYYY-MM-DD)
function getPrevTradingDate(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 6=Sat
  if (day === 0) now.setDate(now.getDate() - 2);      // Sun → Fri
  else if (day === 1) now.setDate(now.getDate() - 3);  // Mon → Fri
  else if (day === 6) now.setDate(now.getDate() - 1);  // Sat → Fri
  else now.setDate(now.getDate() - 1);                 // Tue-Fri → prev day
  return now.toISOString().split("T")[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH STOCK QUOTES
//
// Strategy (in order):
//   1. Return cached data if available (5 min TTL)
//   2. Try "grouped daily" endpoint — 1 API call returns ALL tickers for a date
//      (free-tier compatible, under Aggregates not Snapshots)
//   3. Fallback: individual /prev calls with 13s delay (safe for 5 req/min)
// ─────────────────────────────────────────────────────────────────────────────

export async function getBatchQuotes(
  symbols: string[],
  names?: string[]
): Promise<MarketQuote[]> {
  if (symbols.length === 0) return [];

  // Check cache
  const cacheKey = `quotes:${symbols.join(",")}`;
  const hit = cached<MarketQuote[]>(cacheKey);
  if (hit) return hit;

  try {
    // Strategy 1: Grouped daily (1 API call for ALL US stocks)
    const date = getPrevTradingDate();
    const data = await polygonFetch(
      `/v2/aggs/grouped/locale/us/market/stocks/${date}?adjusted=true`
    );

    const results: any[] = data.results ?? [];
    const symbolSet = new Set(symbols.map(s => s.toUpperCase()));

    // Filter to just our symbols
    const filtered = results.filter((bar: any) => symbolSet.has(bar.T));
    const quotes: MarketQuote[] = filtered.map((bar: any) => {
      const idx = symbols.findIndex(s => s.toUpperCase() === bar.T);
      const price     = bar.c;
      const prevClose = bar.o; // use open as approximate prev close from grouped daily
      const change    = price - prevClose;
      const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

      return {
        symbol:        bar.T,
        name:          names?.[idx] ?? bar.T,
        price,
        change,
        changePercent: changePct,
        high:          bar.h,
        low:           bar.l,
        open:          bar.o,
        prevClose,
        volume:        bar.v || 0,
        timestamp:     bar.t || Date.now(),
      } satisfies MarketQuote;
    });

    // Add empty entries for any symbols not found in the grouped results
    for (let i = 0; i < symbols.length; i++) {
      if (!quotes.some(q => q.symbol === symbols[i])) {
        quotes.push({
          symbol: symbols[i],
          name: names?.[i] ?? symbols[i],
          price: 0, change: 0, changePercent: 0,
          high: 0, low: 0, open: 0, prevClose: 0, volume: 0,
          timestamp: Date.now(),
        });
      }
    }

    setCache(cacheKey, quotes, QUOTE_TTL);
    return quotes;
  } catch (error) {
    console.warn("Polygon grouped daily failed, trying individual prev calls:", (error as Error).message);
    // Strategy 2: Individual /prev calls (slow but reliable)
    const quotes = await fallbackPrevDayQuotes(symbols.slice(0, 5), names);
    if (quotes.length > 0) setCache(cacheKey, quotes, QUOTE_TTL);
    return quotes;
  }
}

export async function getBatchCryptoQuotes(
  symbols: string[],
  names?: string[]
): Promise<CryptoQuote[]> {
  if (symbols.length === 0) return [];

  const cacheKey = `crypto:${symbols.join(",")}`;
  const hit = cached<CryptoQuote[]>(cacheKey);
  if (hit) return hit;

  try {
    // Grouped daily for crypto — 1 API call
    const date = getPrevTradingDate();
    const data = await polygonFetch(
      `/v2/aggs/grouped/locale/global/market/crypto/${date}?adjusted=true`
    );

    const results: any[] = data.results ?? [];

    // Convert our "BTC/USD" to "X:BTCUSD" for matching
    const lookupMap = new Map<string, number>();
    symbols.forEach((s, i) => lookupMap.set(`X:${s.replace("/", "")}`, i));

    const quotes: CryptoQuote[] = [];
    for (const bar of results) {
      const idx = lookupMap.get(bar.T);
      if (idx == null) continue;

      const price     = bar.c;
      const prevClose = bar.o;
      const change    = price - prevClose;
      const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

      quotes.push({
        symbol:        symbols[idx],
        name:          names?.[idx] ?? symbols[idx],
        price,
        change,
        changePercent: changePct,
        high:          bar.h,
        low:           bar.l,
        open:          bar.o,
        prevClose,
        volume:        bar.v || 0,
        timestamp:     bar.t || Date.now(),
      } satisfies CryptoQuote);
    }

    setCache(cacheKey, quotes, QUOTE_TTL);
    return quotes;
  } catch (error) {
    console.warn("Polygon crypto grouped daily failed:", (error as Error).message);
    // Crypto individual fallback: just fetch 2 symbols max
    const quotes = await fallbackCryptoPrevDay(symbols.slice(0, 2), names);
    if (quotes.length > 0) setCache(cacheKey, quotes, QUOTE_TTL);
    return quotes;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACKS — individual /prev calls with rate-limit-safe delays
// ─────────────────────────────────────────────────────────────────────────────

async function fallbackPrevDayQuotes(
  symbols: string[],
  names?: string[]
): Promise<MarketQuote[]> {
  const results: MarketQuote[] = [];
  for (let i = 0; i < symbols.length; i++) {
    try {
      const q = await getStockQuote(symbols[i]);
      if (names?.[i]) q.name = names[i];
      results.push(q);
      // 13s delay = safe for 5 req/min limit on free plan
      if (i < symbols.length - 1) await new Promise(r => setTimeout(r, 13_000));
    } catch {
      // skip failed symbol
    }
  }
  return results;
}

async function fallbackCryptoPrevDay(
  symbols: string[],
  names?: string[]
): Promise<CryptoQuote[]> {
  const results: CryptoQuote[] = [];
  for (let i = 0; i < symbols.length; i++) {
    try {
      const q = await getCryptoQuote(symbols[i]);
      if (names?.[i]) q.name = names[i];
      results.push(q);
      if (i < symbols.length - 1) await new Promise(r => setTimeout(r, 13_000));
    } catch {
      // skip failed symbol
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE QUOTE (used by fallbacks)
// ─────────────────────────────────────────────────────────────────────────────

export async function getStockQuote(symbol: string): Promise<MarketQuote> {
  const data = await polygonFetch(
    `/v2/aggs/ticker/${symbol}/prev?adjusted=true`
  );

  if (!data.results || data.results.length === 0) {
    throw new Error(`No data found for symbol: ${symbol}`);
  }

  const bar = data.results[0];

  return {
    symbol,
    name: symbol,
    price:         bar.c,
    change:        bar.c - (bar.o || bar.c),
    changePercent: bar.o ? ((bar.c - bar.o) / bar.o) * 100 : 0,
    high:          bar.h,
    low:           bar.l,
    open:          bar.o,
    prevClose:     bar.o,
    volume:        bar.v,
    timestamp:     bar.t || Date.now(),
  };
}

export async function getCryptoQuote(symbol: string): Promise<CryptoQuote> {
  const cryptoSymbol = `X:${symbol.replace("/", "")}`;
  const data = await polygonFetch(
    `/v2/aggs/ticker/${cryptoSymbol}/prev?adjusted=true`
  );

  if (!data.results || data.results.length === 0) {
    throw new Error(`No data found for crypto: ${symbol}`);
  }

  const bar = data.results[0];

  return {
    symbol,
    name: symbol,
    price:         bar.c,
    change:        bar.c - (bar.o || bar.c),
    changePercent: bar.o ? ((bar.c - bar.o) / bar.o) * 100 : 0,
    high:          bar.h,
    low:           bar.l,
    open:          bar.o,
    prevClose:     bar.o,
    volume:        bar.v,
    timestamp:     bar.t || Date.now(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORICAL BARS (with per-symbol cache)
// ─────────────────────────────────────────────────────────────────────────────

export async function getHistoricalBars(
  symbol: string,
  days: number = 365
): Promise<OHLCV[]> {
  const cacheKey = `hist:${symbol}:${days}`;
  const hit = cached<OHLCV[]>(cacheKey);
  if (hit) return hit;

  const polygonSymbol = symbol.includes("/")
    ? `X:${symbol.replace("/", "")}`
    : symbol;

  const toDate   = new Date();
  const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);
  const fromStr  = fromDate.toISOString().split("T")[0];
  const toStr    = toDate.toISOString().split("T")[0];

  const data = await polygonFetch(
    `/v2/aggs/ticker/${polygonSymbol}/range/1/day/${fromStr}/${toStr}`
  );

  if (!data.results) return [];

  const bars: OHLCV[] = data.results.map((bar: any) => ({
    timestamp: bar.t,
    open:      bar.o,
    high:      bar.h,
    low:       bar.l,
    close:     bar.c,
    volume:    bar.v,
  }));

  setCache(cacheKey, bars, HIST_TTL);
  return bars;
}

// ─────────────────────────────────────────────────────────────────────────────
// NEWS
// ─────────────────────────────────────────────────────────────────────────────

export async function getNews(
  symbols: string[],
  limit: number = 10
): Promise<any[]> {
  const tickerParam = symbols.join(",");
  const data = await polygonFetch(
    `/v2/reference/news?ticker=${tickerParam}&limit=${limit}`
  );
  return data.results || [];
}
