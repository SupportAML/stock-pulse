import { NextRequest, NextResponse } from "next/server";
import {
  getAccount,
  getPositions,
  getPortfolioHistory,
} from "@/lib/markets/alpaca";
import { savePortfolioSnapshot } from "@/lib/markets/firestore";
import type { PortfolioSummary } from "@/lib/markets/types";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "1M";

    try {
      // Fetch account info
      const accountData = await getAccount();

      // Fetch positions
      const positions = await getPositions();

      // Fetch portfolio history
      const history = await getPortfolioHistory(period);

      // Create portfolio summary
      const portfolioValue = (accountData as any).portfolio_value || 0;
      const lastEquity = (accountData as any).last_equity || portfolioValue || 0;
      const previousEquity = lastEquity;
      const summary: PortfolioSummary = {
        equity: (accountData as any).equity || 0,
        cash: (accountData as any).cash || 0,
        buyingPower: (accountData as any).buying_power || 0,
        portfolioValue,
        dayPL: portfolioValue && previousEquity
          ? portfolioValue - previousEquity
          : 0,
        dayPLPercent: previousEquity && previousEquity !== 0
          ? ((portfolioValue - previousEquity) / previousEquity) * 100
          : 0,
        totalPL: portfolioValue && (accountData as any).equity
          ? portfolioValue - (accountData as any).equity
          : 0,
        totalPLPercent: (accountData as any).equity && (accountData as any).equity !== 0
          ? ((portfolioValue - (accountData as any).equity) / (accountData as any).equity) * 100
          : 0,
        positions,
        lastUpdated: Date.now(),
      };

      // Save snapshot to firestore
      await savePortfolioSnapshot(summary);

      return NextResponse.json(
        {
          account: summary,
          history,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Alpaca portfolio error:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error in /api/markets/portfolio:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch portfolio data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
