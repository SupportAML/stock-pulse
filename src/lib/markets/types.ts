export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  volume: number;
  marketCap?: number;
  timestamp: number;
}

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CryptoQuote extends MarketQuote {
  marketCapRank?: number;
  circulatingSupply?: number;
  totalSupply?: number;
  ath?: number;
  athChangePercent?: number;
}

export interface TechnicalSignal {
  indicator: string;
  value: number;
  signal: "buy" | "sell" | "neutral";
  strength: number;
}

export interface TechnicalAnalysis {
  symbol: string;
  signals: TechnicalSignal[];
  overallSignal: "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell";
  overallScore: number;
  timestamp: number;
}

export interface PricePrediction {
  symbol: string;
  currentPrice: number;
  predictions: {
    timeframe: "1h" | "4h" | "1d" | "1w" | "1m";
    predictedPrice: number;
    confidence: number;
    direction: "up" | "down" | "sideways";
    percentChange: number;
  }[];
  reasoning: string;
  riskLevel: "low" | "medium" | "high" | "extreme";
  sentiment: {
    overall: number;
    news: number;
    social: number;
    technical: number;
  };
  keyFactors: string[];
  timestamp: number;
}

export interface MarketPrediction {
  predictions: PricePrediction[];
  marketOverview: string;
  topOpportunities: TradeOpportunity[];
  warnings: string[];
  generatedAt: number;
}

export interface TradeOpportunity {
  symbol: string;
  name: string;
  action: "buy" | "sell" | "hold";
  confidence: number;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  riskRewardRatio: number;
  reasoning: string;
  timeframe: string;
  potentialReturn: number;
}

export interface TradeOrder {
  id?: string;
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "stop_limit";
  qty: number;
  limitPrice?: number;
  stopPrice?: number;
  timeInForce: "day" | "gtc" | "ioc" | "fok";
  status?: "pending_approval" | "submitted" | "filled" | "cancelled" | "rejected";
  filledAt?: string;
  filledPrice?: number;
  createdAt?: string;
}

export interface Position {
  symbol: string;
  name: string;
  qty: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  side: "long" | "short";
}

export interface PortfolioSummary {
  equity: number;
  cash: number;
  buyingPower: number;
  portfolioValue: number;
  dayPL: number;
  dayPLPercent: number;
  totalPL: number;
  totalPLPercent: number;
  positions: Position[];
  lastUpdated: number;
}

export interface PortfolioHistoryPoint {
  timestamp: number;
  equity: number;
  profitLoss: number;
  profitLossPct: number;
}

export interface MarketNotification {
  id: string;
  type: "signal" | "trade" | "alert" | "prediction";
  title: string;
  message: string;
  symbol?: string;
  action?: "buy" | "sell";
  urgency: "low" | "medium" | "high" | "critical";
  read: boolean;
  createdAt: number;
}

export const DEFAULT_STOCKS = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "MSFT", name: "Microsoft Corp." },
  { symbol: "NVDA", name: "NVIDIA Corp." },
  { symbol: "GOOGL", name: "Alphabet Inc." },
  { symbol: "AMZN", name: "Amazon.com Inc." },
  { symbol: "TSLA", name: "Tesla Inc." },
  { symbol: "META", name: "Meta Platforms" },
  { symbol: "AMD", name: "Advanced Micro Devices" },
  { symbol: "SPY", name: "S&P 500 ETF" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF" },
];

export const DEFAULT_CRYPTO = [
  { symbol: "BTC/USD", name: "Bitcoin" },
  { symbol: "ETH/USD", name: "Ethereum" },
  { symbol: "SOL/USD", name: "Solana" },
  { symbol: "XRP/USD", name: "Ripple" },
  { symbol: "ADA/USD", name: "Cardano" },
];
