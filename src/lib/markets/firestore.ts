import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
  type Firestore,
} from "firebase/firestore";
import { db } from "../firebase";
import type {
  MarketPrediction,
  TradeOrder,
  PortfolioSummary,
  MarketNotification,
} from "./types";

// ── Permission-denied throttle ──────────────────────────────────────────────
// Firebase PERMISSION_DENIED floods the terminal on every request.
// Log the warning once, then silently skip all Firestore operations.
let _permissionDenied = false;

function warnOnce(operation: string, error: any): void {
  const isPermDenied =
    error?.code === "permission-denied" ||
    String(error?.message ?? "").includes("PERMISSION_DENIED");

  if (isPermDenied) {
    if (!_permissionDenied) {
      _permissionDenied = true;
      console.warn(
        `[firestore] PERMISSION_DENIED on "${operation}". ` +
        "Firestore operations will be skipped until the app restarts. " +
        "To fix: open Firebase Console → Firestore → Rules → set:\n" +
        "  rules_version = '2';\n" +
        "  service cloud.firestore {\n" +
        "    match /databases/{database}/documents {\n" +
        '      match /{document=**} { allow read, write: if true; }\n' +
        "    }\n" +
        "  }"
      );
    }
    return;
  }
  // Non-permission errors still log normally
  console.error(`Error in ${operation}:`, error);
}

function getDb(): Firestore {
  if (!db) throw new Error("Firestore not configured");
  if (_permissionDenied) throw new Error("Firestore permission denied — skipping");
  return db;
}

// ── Writes ──────────────────────────────────────────────────────────────────

export async function savePrediction(prediction: MarketPrediction): Promise<void> {
  try {
    await addDoc(collection(getDb(), "predictions"), {
      ...prediction,
      createdAt: Timestamp.now(),
    });
  } catch (error) {
    warnOnce("savePrediction", error);
  }
}

export async function saveTradeOrder(order: TradeOrder): Promise<void> {
  try {
    await addDoc(collection(getDb(), "trades"), {
      ...order,
      createdAt: order.createdAt || new Date().toISOString(),
      timestamp: Timestamp.now(),
    });
  } catch (error) {
    warnOnce("saveTradeOrder", error);
  }
}

export async function savePortfolioSnapshot(summary: PortfolioSummary): Promise<void> {
  try {
    await addDoc(collection(getDb(), "portfolio_snapshots"), {
      equity: summary.equity,
      cash: summary.cash,
      buyingPower: summary.buyingPower,
      portfolioValue: summary.portfolioValue,
      dayPL: summary.dayPL,
      dayPLPercent: summary.dayPLPercent,
      totalPL: summary.totalPL,
      totalPLPercent: summary.totalPLPercent,
      positionCount: summary.positions.length,
      timestamp: Timestamp.now(),
    });
  } catch (error) {
    warnOnce("savePortfolioSnapshot", error);
  }
}

export async function saveNotification(
  notification: Omit<MarketNotification, "id" | "createdAt">
): Promise<string | null> {
  try {
    const docRef = await addDoc(collection(getDb(), "notifications"), {
      ...notification,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    warnOnce("saveNotification", error);
    return null;
  }
}

// ── Reads ───────────────────────────────────────────────────────────────────

export async function getNotifications(limitCount: number = 50): Promise<MarketNotification[]> {
  try {
    const q = query(
      collection(getDb(), "notifications"),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    const notifications: MarketNotification[] = [];
    snapshot.forEach((d) => {
      const data = d.data();
      notifications.push({
        id: d.id,
        type: data.type,
        title: data.title,
        message: data.message,
        symbol: data.symbol,
        action: data.action,
        urgency: data.urgency,
        read: data.read || false,
        createdAt: data.createdAt?.toMillis?.() || Date.now(),
      });
    });
    return notifications;
  } catch (error) {
    warnOnce("getNotifications", error);
    return [];
  }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    const notifRef = doc(getDb(), "notifications", notificationId);
    await updateDoc(notifRef, { read: true });
  } catch (error) {
    warnOnce("markNotificationRead", error);
  }
}

export async function getRecentPredictions(limitCount: number = 20): Promise<MarketPrediction[]> {
  try {
    const q = query(
      collection(getDb(), "predictions"),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    const predictions: MarketPrediction[] = [];
    snapshot.forEach((d) => {
      const data = d.data();
      predictions.push({
        predictions: data.predictions || [],
        marketOverview: data.marketOverview || "",
        topOpportunities: data.topOpportunities || [],
        warnings: data.warnings || [],
        generatedAt: data.generatedAt || data.createdAt?.toMillis?.() || Date.now(),
      });
    });
    return predictions;
  } catch (error) {
    warnOnce("getRecentPredictions", error);
    return [];
  }
}
