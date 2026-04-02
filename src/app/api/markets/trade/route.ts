import { NextRequest, NextResponse } from "next/server";
import { submitOrder, cancelOrder, getOrders } from "@/lib/markets/alpaca";
import { saveTradeOrder } from "@/lib/markets/firestore";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, order, orderId } = body;

    if (action === "submit") {
      if (!order) {
        return NextResponse.json(
          { error: "Order data is required for submit action" },
          { status: 400 }
        );
      }

      try {
        const alpacaOrder = await submitOrder(order);
        await saveTradeOrder(alpacaOrder);

        return NextResponse.json(
          { order: alpacaOrder },
          { status: 201 }
        );
      } catch (error) {
        console.error("Alpaca submit order error:", error);
        throw error;
      }
    } else if (action === "cancel") {
      if (!orderId) {
        return NextResponse.json(
          { error: "Order ID is required for cancel action" },
          { status: 400 }
        );
      }

      try {
        const cancelledOrder = await cancelOrder(orderId);

        return NextResponse.json(
          { order: cancelledOrder },
          { status: 200 }
        );
      } catch (error) {
        console.error("Alpaca cancel order error:", error);
        throw error;
      }
    } else {
      return NextResponse.json(
        { error: "Invalid action. Must be 'submit' or 'cancel'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error in /api/markets/trade POST:", error);
    return NextResponse.json(
      {
        error: "Failed to process trade order",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") || "all";

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
    console.error("Error in /api/markets/trade GET:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch orders",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
