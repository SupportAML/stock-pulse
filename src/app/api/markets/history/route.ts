import { NextRequest, NextResponse } from "next/server";
import { getOrders } from "@/lib/markets/alpaca";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") || "closed";

    try {
      const orders = await getOrders(status);

      return NextResponse.json(
        { orders },
        { status: 200 }
      );
    } catch (error) {
      console.error("Alpaca get orders error:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error in /api/markets/history:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch order history",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
