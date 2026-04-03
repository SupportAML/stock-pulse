import type {
  PortfolioSummary,
  Position,
  TradeOrder,
  PortfolioHistoryPoint,
} from "./types";

const STARTING_EQUITY = 100000;

export function getAlpacaBaseUrl(): string {
  const isLive = process.env.ALPACA_LIVE === "true";
  return isLive
    ? "https://api.alpaca.markets"
    : "https://paper-api.alpaca.markets";
}

export async function alpacaFetch(
  endpoint: string,
  options?: RequestInit
): Promise<Response> {
  const baseUrl = getAlpacaBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  const headers: HeadersInit = {
    "APCA-API-KEY-ID": process.env.ALPACA_KEY || process.env.ALPACA_API_KEY || "",
    "APCA-API-SECRET-KEY": process.env.ALPACA_SECRET || process.env.ALPACA_SECRET_KEY || "",
    "Content-Type": "application/json",
    ...options?.headers,
  };

  return fetch(url, {
    ...options,
    headers,
  });
}

export async function getAccount(): Promise<PortfolioSummary> {
  const response = await alpacaFetch("/v2/account");

  if (!response.ok) {
    throw new Error(`Failed to fetch account: ${response.statusText}`);
  }

  const account = await response.json();

  // Calculate P&L
  const equity = parseFloat(account.equity);
  const lastEquity = parseFloat(account.last_equity);
  const dayPL = equity - lastEquity;
  const dayPLPercent = lastEquity > 0 ? (dayPL / lastEquity) * 100 : 0;

  const totalPL = equity - STARTING_EQUITY;
  const totalPLPercent =
    STARTING_EQUITY > 0 ? (totalPL / STARTING_EQUITY) * 100 : 0;

  return {
    equity,
    cash: parseFloat(account.cash),
    buyingPower: parseFloat(account.buying_power),
    portfolioValue: equity,
    dayPL,
    dayPLPercent,
    totalPL,
    totalPLPercent,
    positions: [], // Populated separately by getPositions
    lastUpdated: Date.now(),
  };
}

export async function getPositions(): Promise<Position[]> {
  const response = await alpacaFetch("/v2/positions");

  if (!response.ok) {
    throw new Error(`Failed to fetch positions: ${response.statusText}`);
  }

  const positions = await response.json();

  return positions.map((pos: any) => ({
    symbol: pos.symbol,
    name: pos.symbol, // Name not provided by API
    qty: parseFloat(pos.qty),
    avgEntryPrice: parseFloat(pos.avg_fill_price),
    currentPrice: parseFloat(pos.current_price),
    marketValue: parseFloat(pos.market_value),
    unrealizedPL: parseFloat(pos.unrealized_pl),
    unrealizedPLPercent: parseFloat(pos.unrealized_plpc) * 100,
    side: pos.side === "long" ? "long" : "short",
  }));
}

export async function submitOrder(order: TradeOrder): Promise<TradeOrder> {
  const payload: Record<string, any> = {
    symbol: order.symbol,
    qty: order.qty,
    side: order.side,
    type: order.type,
    time_in_force: order.timeInForce,
  };

  if (order.limitPrice !== undefined) {
    payload.limit_price = order.limitPrice;
  }

  if (order.stopPrice !== undefined) {
    payload.stop_price = order.stopPrice;
  }

  const response = await alpacaFetch("/v2/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit order: ${response.statusText}`);
  }

  const result = await response.json();

  return {
    id: result.id,
    symbol: result.symbol,
    side: result.side,
    type: result.order_type,
    qty: parseFloat(result.qty),
    limitPrice: result.limit_price ? parseFloat(result.limit_price) : undefined,
    stopPrice: result.stop_price ? parseFloat(result.stop_price) : undefined,
    timeInForce: result.time_in_force,
    status: result.status,
    createdAt: result.created_at,
  };
}

export async function cancelOrder(orderId: string): Promise<void> {
  const response = await alpacaFetch(`/v2/orders/${orderId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to cancel order: ${response.statusText}`);
  }
}

export async function getOrders(status?: string): Promise<TradeOrder[]> {
  let endpoint = "/v2/orders";
  if (status) {
    endpoint += `?status=${status}`;
  }

  const response = await alpacaFetch(endpoint);

  if (!response.ok) {
    throw new Error(`Failed to fetch orders: ${response.statusText}`);
  }

  const orders = await response.json();

  return orders.map((ord: any) => ({
    id: ord.id,
    symbol: ord.symbol,
    side: ord.side,
    type: ord.order_type,
    qty: parseFloat(ord.qty),
    limitPrice: ord.limit_price ? parseFloat(ord.limit_price) : undefined,
    stopPrice: ord.stop_price ? parseFloat(ord.stop_price) : undefined,
    timeInForce: ord.time_in_force,
    status: ord.status,
    filledAt: ord.filled_at,
    filledPrice: ord.filled_avg_price ? parseFloat(ord.filled_avg_price) : undefined,
    createdAt: ord.created_at,
  }));
}

export async function getPortfolioHistory(
  period: string = "1M"
): Promise<PortfolioHistoryPoint[]> {
  const response = await alpacaFetch(
    `/v2/account/portfolio/history?period=${period}&timeframe=1D`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch portfolio history: ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.equity || !Array.isArray(data.equity)) {
    return [];
  }

  const timestamps = data.timestamp || [];
  const equity = data.equity || [];
  const profitLoss = data.profit_loss || [];
  const profitLossPct = data.profit_loss_pct || [];

  return timestamps.map((ts: number, idx: number) => ({
    timestamp: ts * 1000, // Convert to milliseconds
    equity: equity[idx] || 0,
    profitLoss: profitLoss[idx] || 0,
    profitLossPct: (profitLossPct[idx] || 0) * 100,
  }));
}
