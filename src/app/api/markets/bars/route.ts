import { NextRequest, NextResponse } from "next/server";
import { getHistoricalBars } from "@/lib/markets/polygon";
import { analyzeTechnicals } from "@/lib/markets/technical";

/**
 * GET /api/markets/bars?symbol=AAPL&limit=120
 * Returns OHLCV bars + technical analysis for the chart.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const symbol = (params.get("symbol") ?? "").toUpperCase().trim();
  const limit  = Math.min(500, Math.max(10, Number(params.get("limit") ?? 120)));

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  try {
    const bars = await getHistoricalBars(symbol, limit);

    let technicals = null;
    if (bars.length >= 20) {
      try {
        technicals = await analyzeTechnicals(symbol, bars);
      } catch (e) {
        console.warn(`Technicals failed for ${symbol}:`, e);
      }
    }

    return NextResponse.json({ symbol, bars, technicals }, { status: 200 });
  } catch (error) {
    console.error(`/api/markets/bars error for ${symbol}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch bars", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
