'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import TechnicalChart from './TechnicalChart';
import { useMarketStream } from '@/hooks/useMarketStream';
import type { OHLCV, TechnicalAnalysis } from '@/lib/markets/types';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'ws://localhost:8080';

// ─── Props ────────────────────────────────────────────────────────────────────

interface StockDetailPanelProps {
  symbol: string;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StockDetailPanel({ symbol, onClose }: StockDetailPanelProps) {
  const [bars,       setBars]       = useState<OHLCV[]>([]);
  const [technicals, setTechnicals] = useState<TechnicalAnalysis | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  // Live price & volume from WebSocket (authenticated)
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;
  const { prices, signals, subscribe } = useMarketStream(GATEWAY_URL, { token });
  const liveData    = prices.get(symbol.toUpperCase());
  const livePrice   = liveData?.price;
  const liveSignal  = signals.get(symbol.toUpperCase());

  // Accumulate volume ticks for current candle update
  const liveVolume = useRef(0);
  useEffect(() => {
    const unsub = subscribe(symbol, msg => {
      if (msg.type === 'trade') liveVolume.current += (msg as any).size ?? 0;
    });
    return unsub;
  }, [symbol, subscribe]);

  // Fetch historical bars + technicals
  useEffect(() => {
    setLoading(true);
    setError(null);
    setBars([]);
    setTechnicals(null);
    liveVolume.current = 0;

    fetch(`/api/markets/bars?symbol=${encodeURIComponent(symbol)}&limit=120`)
      .then(r => {
        if (!r.ok) throw new Error(`History API ${r.status}`);
        return r.json();
      })
      .then((d: { bars?: OHLCV[]; technicals?: TechnicalAnalysis }) => {
        setBars(d.bars ?? []);
        setTechnicals(d.technicals ?? null);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [symbol]);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-3 bg-gray-800/60 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{symbol} — Detail View</span>
          {liveSignal && (
            <span className={`text-xs px-2 py-0.5 rounded border font-bold ${
              liveSignal.action === 'BUY'  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              liveSignal.action === 'SELL' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                             'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
            }`}>
              Signal: {liveSignal.action} · {liveSignal.confidence}%
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
          aria-label="Close detail panel"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            <p className="text-sm text-gray-500">Loading chart for {symbol}…</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-red-400 text-sm">{error}</p>
            <p className="text-gray-600 text-xs mt-1">Historical data unavailable</p>
          </div>
        </div>
      ) : (
        <TechnicalChart
          symbol={symbol}
          data={bars}
          technicals={technicals}
          livePrice={livePrice}
          liveVolume={liveVolume.current > 0 ? liveVolume.current : undefined}
        />
      )}

      {/* Signal detail row */}
      {liveSignal && (
        <div className="px-5 py-3 border-t border-gray-800 bg-gray-800/30">
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-gray-500">Entry</span>
              <p className="text-white font-mono font-medium">
                {liveSignal.entry != null ? `$${liveSignal.entry.toFixed(2)}` : '—'}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Target</span>
              <p className="text-emerald-400 font-mono font-medium">
                {liveSignal.target != null ? `$${liveSignal.target.toFixed(2)}` : '—'}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Stop Loss</span>
              <p className="text-red-400 font-mono font-medium">
                {liveSignal.stopLoss != null ? `$${liveSignal.stopLoss.toFixed(2)}` : '—'}
              </p>
            </div>
          </div>
          {liveSignal.reasoning && (
            <p className="text-xs text-gray-500 mt-2 line-clamp-2">{liveSignal.reasoning}</p>
          )}
        </div>
      )}
    </div>
  );
}
