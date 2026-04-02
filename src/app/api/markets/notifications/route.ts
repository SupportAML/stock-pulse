import { NextRequest, NextResponse } from "next/server";
import {
  getNotifications,
  saveNotification,
  markNotificationRead,
} from "@/lib/markets/firestore";

export async function GET() {
  try {
    try {
      const notifications = await getNotifications(50);

      return NextResponse.json(
        { notifications },
        { status: 200 }
      );
    } catch (error) {
      console.error("Firestore get notifications error:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error in /api/markets/notifications GET:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch notifications",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, notification, id } = body;

    if (action === "create") {
      if (!notification) {
        return NextResponse.json(
          { error: "Notification data is required for create action" },
          { status: 400 }
        );
      }

      try {
        const newNotificationData = {
          title: notification.title,
          message: notification.message,
          type: notification.type || "signal",
          symbol: notification.symbol,
          action: notification.action,
          urgency: notification.urgency || "medium",
          read: false,
        };

        const notificationId = await saveNotification(newNotificationData);
        const createdNotification = {
          id: notificationId || `${Date.now()}`,
          ...newNotificationData,
          createdAt: Date.now(),
        };

        return NextResponse.json(
          { notification: createdNotification },
          { status: 201 }
        );
      } catch (error) {
        console.error("Firestore save notification error:", error);
        throw error;
      }
    } else if (action === "markRead") {
      if (!id) {
        return NextResponse.json(
          { error: "Notification ID is required for markRead action" },
          { status: 400 }
        );
      }

      try {
        await markNotificationRead(id);

        return NextResponse.json(
          { success: true },
          { status: 200 }
        );
      } catch (error) {
        console.error("Firestore mark read notification error:", error);
        throw error;
      }
    } else {
      return NextResponse.json(
        { error: "Invalid action. Must be 'create' or 'markRead'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error in /api/markets/notifications POST:", error);
    return NextResponse.json(
      {
        error: "Failed to process notification",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
