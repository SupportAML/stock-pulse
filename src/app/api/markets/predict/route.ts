import { NextRequest, NextResponse } from "next/server";
import type { OHLCV } from "@/lib/markets/types";
import {
  getBatchQuotes,
  getBatchCryptoQuotes,
  getHistoricalBars,
} from "@/lib/markets/polygon";
import { analyzeTechnicals } from "@/lib/markets/technical";
import { generatePredictions, OLLAMA_MODEL } from "@/lib/markets/predictions";
import { savePrediction, getRecentPredictions } from "@/lib/markets/firestore";
import { DEFAULT_STOCKS, DEFAULT_CRYPTO } from "@/lib/markets/types";

/**
 * GET /api/markets/predict
 * Returns the most recently cached prediction from Firestore.
 * Used by the predictions page to auto-load without triggering Ollama on every visit.
 */
export async function GET() {
  try {
    const recent = await getRecentPredictions(1);
    if (recent.length === 0) {
      return NextResponse.json({ cached: false }, { status: 200 });
    }
    return NextResponse.json({ cached: true, modelUsed: OLLAMA_MODEL, ...recent[0] }, { status: 200 });
  } catch (error) {
    console.error("Error in GET /api/markets/predict:", error);
    return NextResponse.json(
      { error: "Failed to load cached prediction", cached: false },
      { status: 200 }  // 200 so the page degrades gracefully
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Gracefully handle empty or missing body
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    let symbols: string[] = body.symbols;

    // Default symbols — extract string symbols from DEFAULT_STOCKS/CRYPTO objects
    if (!symbols || symbols.length === 0) {
      symbols = [
        ...DEFAULT_STOCKS.slice(0, 4).map((s) => s.symbol),
        ...DEFAULT_CRYPTO.slice(0, 3).map((s) => s.symbol),
      ];
    }

    // Separate stocks from crypto (crypto symbols contain "/")
    const stockSymbols = symbols.filter((s) => !s.includes("/"));
    const cryptoSymbols = symbols.filter((s) => s.includes("/"));

    // ONE batch API call each — no per-symbol requests
    const [stockQuotes, cryptoQuotes] = await Promise.all([
      stockSymbols.length > 0 ? getBatchQuotes(stockSymbols) : Promise.resolve([]),
      cryptoSymbols.length > 0 ? getBatchCryptoQuotes(cryptoSymbols) : Promise.resolve([]),
    ]);
    const allQuotes = [...stockQuotes, ...cryptoQuotes];

    // Fetch historical bars + compute technicals for top 3 stocks only
    // (each getHistoricalBars = 1 Polygon API call — keep under rate limit)
    const technicalAnalyses: Record<string, any> = {};
    const historicalBarsCache = new Map<string, OHLCV[]>();

    for (const symbol of stockSymbols.slice(0, 3)) {
      try {
        const bars = await getHistoricalBars(symbol, 60);
        historicalBarsCache.set(symbol, bars);
        if (bars.length > 0) {
          const technicals = await analyzeTechnicals(symbol, bars);
          technicalAnalyses[symbol] = technicals;
        }
      } catch (err) {
        console.error(`Technicals failed for ${symbol}:`, err);
      }
    }

    // Pass pre-fetched bars to generatePredictions (no double-fetching)
    const historicalBarsMap = new Map<string, Promise<OHLCV[]>>(
      symbols.map((s) => [s, Promise.resolve(historicalBarsCache.get(s) ?? [])])
    );

    const prediction = await generatePredictions(
      symbols,
      allQuotes,
      technicalAnalyses,
      historicalBarsMap
    );

    // Fire-and-forget — don't let Firestore errors 500 the route
    savePrediction(prediction).catch((e) =>
      console.error("savePrediction failed (non-fatal):", e)
    );

    return NextResponse.json({ ...prediction, modelUsed: OLLAMA_MODEL }, { status: 201 });
  } catch (error) {
    console.error("Error in /api/markets/predict:", error);
    return NextResponse.json(
      {
        error: "Failed to generate predictions",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
