import type { OHLCV, TechnicalAnalysis, TechnicalSignal } from "./types";

export function computeRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) {
    return 50; // Neutral if not enough data
  }

  let gains = 0;
  let losses = 0;

  // First average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Wilder smoothing for remaining values
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }

  if (avgLoss === 0) {
    return avgGain > 0 ? 100 : 50;
  }

  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  return rsi;
}

export function computeMACD(
  closes: number[]
): { macd: number; signal: number; histogram: number } {
  if (closes.length < 26) {
    return { macd: 0, signal: 0, histogram: 0 };
  }

  const ema12 = computeEMA(closes, 12);
  const ema26 = computeEMA(closes, 26);

  const macd = ema12 - ema26;

  const macdLine = closes.map((_, i) => {
    const e12 = computeEMA(closes.slice(0, i + 1), 12);
    const e26 = computeEMA(closes.slice(0, i + 1), 26);
    return e12 - e26;
  });

  const signal = computeEMA(macdLine, 9);
  const histogram = macd - signal;

  return { macd, signal, histogram };
}

export function computeEMA(values: number[], period: number): number {
  if (values.length === 0) {
    return 0;
  }

  if (values.length === 1) {
    return values[0];
  }

  const k = 2 / (period + 1);
  let ema = values[0];

  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }

  return ema;
}

export function computeBollingerBands(
  closes: number[],
  period: number = 20,
  stdDev: number = 2
): { upper: number; middle: number; lower: number; percentB: number } {
  if (closes.length < period) {
    return { upper: 0, middle: 0, lower: 0, percentB: 0.5 };
  }

  const recentCloses = closes.slice(-period);
  const middle = recentCloses.reduce((a, b) => a + b, 0) / period;

  const variance =
    recentCloses.reduce((sum, val) => sum + Math.pow(val - middle, 2), 0) /
    period;
  const std = Math.sqrt(variance);

  const upper = middle + std * stdDev;
  const lower = middle - std * stdDev;

  const lastPrice = closes[closes.length - 1];
  const percentB =
    upper - lower > 0 ? (lastPrice - lower) / (upper - lower) : 0.5;

  return { upper, middle, lower, percentB };
}

export function computeSMA(values: number[], period: number): number {
  if (values.length < period) {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  const recentValues = values.slice(-period);
  return recentValues.reduce((a, b) => a + b, 0) / period;
}

export function computeStochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): { k: number; d: number } {
  if (highs.length < period) {
    return { k: 50, d: 50 };
  }

  const recentHighs = highs.slice(-period);
  const recentLows = lows.slice(-period);

  const highestHigh = Math.max(...recentHighs);
  const lowestLow = Math.min(...recentLows);

  const k =
    highestHigh - lowestLow > 0
      ? ((closes[closes.length - 1] - lowestLow) /
          (highestHigh - lowestLow)) *
        100
      : 50;

  // D is 3-period SMA of K
  // For simplicity, we'll use current K as approximation
  const d = k;

  return { k, d };
}

export function computeATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number {
  if (highs.length < period) {
    return 0;
  }

  const trueRanges: number[] = [];

  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges.push(tr);
  }

  if (trueRanges.length < period) {
    return trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;
  }

  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }

  return atr;
}

export function analyzeVolume(
  volumes: number[],
  closes: number[]
): { volumeScore: number; trend: "increasing" | "decreasing" | "stable" } {
  if (volumes.length < 20) {
    return { volumeScore: 0, trend: "stable" };
  }

  const recentVolumes = volumes.slice(-5);
  const avgVolume20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const avgRecentVolume =
    recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;

  const volumeRatio =
    avgVolume20 > 0 ? avgRecentVolume / avgVolume20 : 1;

  // Check price trend
  const recentCloses = closes.slice(-5);
  const avgRecentPrice =
    recentCloses.reduce((a, b) => a + b, 0) / recentCloses.length;
  const prevAvgPrice =
    closes.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;

  let trend: "increasing" | "decreasing" | "stable" = "stable";
  if (avgRecentPrice > prevAvgPrice) {
    trend = "increasing";
  } else if (avgRecentPrice < prevAvgPrice) {
    trend = "decreasing";
  }

  return {
    volumeScore: Math.min(100, volumeRatio * 50),
    trend,
  };
}

export async function analyzeTechnicals(
  symbol: string,
  bars: OHLCV[]
): Promise<TechnicalAnalysis> {
  if (bars.length < 20) {
    return {
      symbol,
      signals: [],
      overallSignal: "neutral",
      overallScore: 0,
      timestamp: Date.now(),
    };
  }

  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const volumes = bars.map((b) => b.volume);

  const signals: TechnicalSignal[] = [];
  let scoreSum = 0;

  // RSI
  const rsi = computeRSI(closes);
  signals.push({
    indicator: "RSI",
    value: rsi,
    signal: rsi > 70 ? "sell" : rsi < 30 ? "buy" : "neutral",
    strength: Math.abs(rsi - 50) / 50,
  });
  scoreSum += rsi > 70 ? -30 : rsi < 30 ? 30 : 0;

  // MACD
  const { histogram } = computeMACD(closes);
  signals.push({
    indicator: "MACD",
    value: histogram,
    signal:
      histogram > 0 ? "buy" : histogram < 0 ? "sell" : "neutral",
    strength: Math.abs(histogram) > 0 ? 0.7 : 0,
  });
  scoreSum += histogram > 0 ? 20 : histogram < 0 ? -20 : 0;

  // Bollinger Bands
  const { percentB } = computeBollingerBands(closes);
  signals.push({
    indicator: "Bollinger Bands",
    value: percentB,
    signal:
      percentB > 0.8 ? "sell" : percentB < 0.2 ? "buy" : "neutral",
    strength: Math.abs(percentB - 0.5) / 0.5,
  });
  scoreSum += percentB > 0.8 ? -15 : percentB < 0.2 ? 15 : 0;

  // Stochastic
  const { k } = computeStochastic(highs, lows, closes);
  signals.push({
    indicator: "Stochastic",
    value: k,
    signal: k > 80 ? "sell" : k < 20 ? "buy" : "neutral",
    strength: Math.abs(k - 50) / 50,
  });
  scoreSum += k > 80 ? -15 : k < 20 ? 15 : 0;

  // Volume
  const { volumeScore, trend } = analyzeVolume(volumes, closes);
  signals.push({
    indicator: "Volume",
    value: volumeScore,
    signal: trend === "increasing" ? "buy" : "sell",
    strength: volumeScore / 100,
  });
  scoreSum += trend === "increasing" ? 10 : trend === "decreasing" ? -10 : 0;

  // Determine overall signal
  let overallSignal: "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell";
  if (scoreSum > 50) {
    overallSignal = "strong_buy";
  } else if (scoreSum > 20) {
    overallSignal = "buy";
  } else if (scoreSum < -50) {
    overallSignal = "strong_sell";
  } else if (scoreSum < -20) {
    overallSignal = "sell";
  } else {
    overallSignal = "neutral";
  }

  return {
    symbol,
    signals,
    overallSignal,
    overallScore: scoreSum,
    timestamp: Date.now(),
  };
}
