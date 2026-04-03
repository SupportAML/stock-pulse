'use client';

import { useEffect, useRef } from 'react';
import type { OHLCV, TechnicalAnalysis } from '@/lib/markets/types';

// lightweight-charts must be imported dynamically (DOM-only library)
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  Time,
} from 'lightweight-charts';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TechnicalChartProps {
  symbol: string;
  data: OHLCV[];
  technicals: TechnicalAnalysis | null;
  /** Live price streamed from WebSocket — updates the last candle in real-time */
  livePrice?: number;
  /** Live volume from WebSocket */
  liveVolume?: number;
}

// ─── Signal badge colours ─────────────────────────────────────────────────────

const SIGNAL_COLORS: Record<string, string> = {
  strong_buy:  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  buy:         'bg-green-500/20 text-green-400 border-green-500/30',
  neutral:     'bg-gray-500/20 text-gray-400 border-gray-600',
  sell:        'bg-orange-500/20 text-orange-400 border-orange-500/30',
  strong_sell: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const SIGNAL_LABEL: Record<string, string> = {
  strong_buy: 'Strong Buy', buy: 'Buy', neutral: 'Neutral',
  sell: 'Sell', strong_sell: 'Strong Sell',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function TechnicalChart({
  symbol,
  data,
  technicals,
  livePrice,
  liveVolume,
}: TechnicalChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef          = useRef<IChartApi | null>(null);
  const candleSeriesRef   = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef   = useRef<ISeriesApi<'Histogram'> | null>(null);

  // ── Initialise chart ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    let chart: IChartApi;

    (async () => {
      const { createChart, ColorType, CrosshairMode } = await import('lightweight-charts');

      if (!chartContainerRef.current) return;

      // Destroy previous instance if symbol changed
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: '#111827' },
          textColor: '#9ca3af',
        },
        grid: {
          vertLines: { color: '#1f2937' },
          horzLines: { color: '#1f2937' },
        },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: '#374151' },
        timeScale: {
          borderColor: '#374151',
          timeVisible: true,
          secondsVisible: false,
        },
        width:  chartContainerRef.current.clientWidth,
        height: 400,
      });

      chartRef.current = chart;

      // ── Candlestick series ────────────────────────────────────────────────
      const candleSeries = chart.addCandlestickSeries({
        upColor:     '#10b981',
        downColor:   '#ef4444',
        borderUpColor:   '#10b981',
        borderDownColor: '#ef4444',
        wickUpColor:     '#10b981',
        wickDownColor:   '#ef4444',
      });
      candleSeriesRef.current = candleSeries;

      const candleData: CandlestickData<Time>[] = data
        .filter(b => b.timestamp && b.open && b.high && b.low && b.close)
        .map(b => ({
          time:  Math.floor(b.timestamp / 1000) as Time,
          open:  b.open,
          high:  b.high,
          low:   b.low,
          close: b.close,
        }));

      candleSeries.setData(candleData);

      // ── Volume histogram ──────────────────────────────────────────────────
      const volumeSeries = chart.addHistogramSeries({
        color:          '#3b82f6',
        priceFormat:    { type: 'volume' },
        priceScaleId:   'volume',
      });
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
      volumeSeriesRef.current = volumeSeries;

      const volumeData: HistogramData<Time>[] = data
        .filter(b => b.timestamp && b.volume != null)
        .map(b => ({
          time:  Math.floor(b.timestamp / 1000) as Time,
          value: b.volume,
          color: b.close >= b.open ? '#10b98133' : '#ef444433',
        }));

      volumeSeries.setData(volumeData);

      // Fit all data on screen initially
      chart.timeScale().fitContent();

      // ── Resize observer ───────────────────────────────────────────────────
      const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
          chart.applyOptions({ width: entry.contentRect.width });
        }
      });
      ro.observe(chartContainerRef.current!);

      return () => {
        ro.disconnect();
        chart.remove();
        chartRef.current      = null;
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
      };
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, data]);

  // ── Live price → update last candle ───────────────────────────────────────
  useEffect(() => {
    if (!livePrice || !candleSeriesRef.current || !volumeSeriesRef.current || data.length === 0) return;

    const last = data[data.length - 1];
    if (!last?.timestamp) return;

    const time = Math.floor(last.timestamp / 1000) as Time;

    candleSeriesRef.current.update({
      time,
      open:  last.open,
      high:  Math.max(last.high, livePrice),
      low:   Math.min(last.low, livePrice),
      close: livePrice,
    });

    if (liveVolume != null) {
      volumeSeriesRef.current.update({
        time,
        value: (last.volume ?? 0) + liveVolume,
        color: livePrice >= last.open ? '#10b98133' : '#ef444433',
      });
    }
  }, [livePrice, liveVolume, data]);

  // ── Live price line via price line API ────────────────────────────────────
  const priceLineRef = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null>(null);

  useEffect(() => {
    if (!livePrice || !candleSeriesRef.current) return;

    if (priceLineRef.current) {
      candleSeriesRef.current.removePriceLine(priceLineRef.current);
    }
    priceLineRef.current = candleSeriesRef.current.createPriceLine({
      price:     livePrice,
      color:     '#3b82f6',
      lineWidth: 1,
      lineStyle: 2, // dashed
      axisLabelVisible: true,
      title: 'Live',
    });
  }, [livePrice]);

  // ── Compute price change for header display ────────────────────────────────
  const prevClose  = data.length > 1 ? data[data.length - 2].close : null;
  const currentPrice = livePrice ?? (data.length > 0 ? data[data.length - 1].close : null);
  const priceChange  = currentPrice && prevClose ? currentPrice - prevClose : null;
  const priceChangePct = priceChange && prevClose ? (priceChange / prevClose) * 100 : null;
  const isPositive = (priceChange ?? 0) >= 0;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* ── Price header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-white">{symbol}</span>
          {livePrice && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {currentPrice != null && (
            <span className="text-2xl font-mono font-bold text-white">
              ${currentPrice.toFixed(2)}
            </span>
          )}
          {priceChange != null && priceChangePct != null && isFinite(priceChangePct) && (
            <span className={`text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{priceChange.toFixed(2)} ({isPositive ? '+' : ''}{priceChangePct.toFixed(2)}%)
            </span>
          )}
        </div>
      </div>

      {/* ── Chart canvas ───────────────────────────────────────────────────── */}
      <div ref={chartContainerRef} className="w-full" style={{ height: 400 }}>
        {data.length === 0 && (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            No chart data available
          </div>
        )}
      </div>

      {/* ── Technical signals ──────────────────────────────────────────────── */}
      {technicals && (
        <div className="px-5 py-4 border-t border-gray-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300">Technical Signals</h3>
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
              SIGNAL_COLORS[technicals.overallSignal] ?? SIGNAL_COLORS.neutral
            }`}>
              {SIGNAL_LABEL[technicals.overallSignal] ?? technicals.overallSignal}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {technicals.signals.map(sig => (
              <div key={sig.indicator}
                className="bg-gray-800 rounded-lg px-3 py-2 flex flex-col gap-0.5"
              >
                <span className="text-[10px] text-gray-500 uppercase tracking-wide">{sig.indicator}</span>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-white">{sig.value.toFixed(2)}</span>
                  <span className={`text-[10px] font-bold ${
                    sig.signal === 'buy' ? 'text-emerald-400'
                    : sig.signal === 'sell' ? 'text-red-400'
                    : 'text-gray-500'
                  }`}>
                    {sig.signal.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
