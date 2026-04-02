import { NextRequest, NextResponse } from "next/server";
import { getBatchQuotes, getBatchCryptoQuotes } from "@/lib/markets/polygon";
import { analyzeTechnicals } from "@/lib/markets/technical";
import { getHistoricalBars } from "@/lib/markets/polygon";
import { DEFAULT_STOCKS, DEFAULT_CRYPTO } from "@/lib/markets/types";
import type {
  MarketQuote,
  CryptoQuote,
  TechnicalAnalysis,
} from "@/lib/markets/types";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "all";
    const symbolsParam = searchParams.get("symbols");
    const period = parseInt(searchParams.get("period") || "30");

    const stocks: MarketQuote[] = [];
    const crypto: CryptoQuote[] = [];
    const technicals: Record<string, TechnicalAnalysis> = {};

    // Get stock data
    if (type === "stock" || type === "all") {
      const stockSymbols = symbolsParam
        ? symbolsParam.split(",").map((s) => s.trim())
        : DEFAULT_STOCKS.map((s) => s.symbol);

      const stockQuotes = await getBatchQuotes(
        stockSymbols,
        DEFAULT_STOCKS.map((s) => s.name)
      );
      stocks.push(...stockQuotes);

      // Compute technicals for top 5 stocks
      const topStocks = stockQuotes.slice(0, 5);
      for (const stock of topStocks) {
        try {
          const bars = await getHistoricalBars(stock.symbol, period);
          const technical = await analyzeTechnicals(stock.symbol, bars);
          technicals[stock.symbol] = technical;
        } catch (error) {
          console.error(`Failed to compute technicals for ${stock.symbol}:`, error);
        }
      }
    }

    // Get crypto data
    if (type === "crypto" || type === "all") {
      const cryptoSymbols = symbolsParam
        ? symbolsParam.split(",").map((s) => s.trim())
        : DEFAULT_CRYPTO.map((s) => s.symbol);

      const cryptoQuotes = await getBatchCryptoQuotes(
        cryptoSymbols,
        DEFAULT_CRYPTO.map((s) => s.name)
      );
      crypto.push(...cryptoQuotes);
    }

    return NextResponse.json(
      {
        stocks,
        crypto,
        technicals,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in /api/markets/data:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch market data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
