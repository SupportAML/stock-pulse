'use client';

import { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Wifi, WifiOff, Zap } from 'lucide-react';
import { MarketQuote, CryptoQuote } from '@/lib/markets/types';
import { useMarketStream } from '@/hooks/useMarketStream';

type TabType = 'stocks' | 'crypto' | 'all';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'ws://localhost:8080';

// Symbols we track via the live stream (must match gateway DEFAULT_SYMBOLS)
const STREAM_SYMBOLS = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN',
  'TSLA', 'META', 'AMD',  'SPY',   'QQQ',
];

interface MarketOverviewProps {
  onSymbolSelect?: (symbol: string) => void;
}

export default function MarketOverview({ onSymbolSelect }: MarketOverviewProps) {
  const [stocks, setStocks]   = useState<MarketQuote[]>([]);
  const [crypto, setCrypto]   = useState<CryptoQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [retryCount, setRetryCount] = useState(0);

  // Track which symbols just got a price update (for flash animation)
  const [flashSymbols, setFlashSymbols] = useState<Set<string>>(new Set());
  const flashTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ── Live stream ────────────────────────────────────────────────────────────
  const { prices, signals, connected } = useMarketStream(GATEWAY_URL, {
    watchlist: STREAM_SYMBOLS,
  });

  // ── Flash animation when a price updates ──────────────────────────────────
  function triggerFlash(symbol: string) {
    setFlashSymbols(prev => new Set(prev).add(symbol));
    if (flashTimers.current.has(symbol)) clearTimeout(flashTimers.current.get(symbol)!);
    flashTimers.current.set(
      symbol,
      setTimeout(() => {
        setFlashSymbols(prev => {
          const next = new Set(prev);
          next.delete(symbol);
          return next;
        });
      }, 600)
    );
  }

  // ── Merge live prices into stocks array ───────────────────────────────────
  useEffect(() => {
    if (prices.size === 0) return;
    setStocks(prev =>
      prev.map(stock => {
        const live = prices.get(stock.symbol);
        if (!live || live.price === stock.price) return stock;
        triggerFlash(stock.symbol);
        const change        = live.price - stock.prevClose;
        const changePercent = stock.prevClose > 0 ? (change / stock.prevClose) * 100 : 0;
        return { ...stock, price: live.price, change, changePercent };
      })
    );
  }, [prices]);

  // ── Initial REST fetch (SSR fallback) ─────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/markets/data');
        if (!response.ok) {
          // Try to extract the server-side error message
          let msg = `API error ${response.status}`;
          try {
            const errBody = await response.json();
            msg = errBody.message || errBody.error || msg;
          } catch { /* ignore parse error */ }
          throw new Error(msg);
        }
        const data = await response.json();
        setStocks(data.stocks || []);
        setCrypto(data.crypto || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Fallback polling — only fires if WebSocket is disconnected
    const interval = setInterval(() => {
      if (!connected) fetchData();
    }, 30000);

    return () => clearInterval(interval);
  }, [connected, retryCount]);

  // ── Derived display list ──────────────────────────────────────────────────
  const displayItems =
    activeTab === 'stocks' ? stocks :
    activeTab === 'crypto' ? crypto :
    [...stocks, ...crypto];

  // ── Signal badge ──────────────────────────────────────────────────────────
  const renderSignalBadge = (symbol: string, fallbackSignal?: string) => {
    const liveSignal = signals.get(symbol);

    if (liveSignal) {
      const colors = {
        BUY:  'bg-green-900 text-green-300 border border-green-700',
        SELL: 'bg-red-900 text-red-300 border border-red-700',
        HOLD: 'bg-blue-900 text-blue-300 border border-blue-700',
      };
      return (
        <div className="flex flex-col items-end gap-1">
          <div className={`${colors[liveSignal.action]} text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1`}>
            <Zap className="w-3 h-3" />
            {liveSignal.action} {liveSignal.confidence}%
          </div>
        </div>
      );
    }

    if (!fallbackSignal) return null;
    const signalLower = fallbackSignal.toLowerCase();
    let bgColor = 'bg-gray-700 text-white';
    if (signalLower.includes('buy'))  bgColor = 'bg-green-900 text-green-300';
    if (signalLower.includes('sell')) bgColor = 'bg-red-900 text-red-300';
    if (signalLower.includes('hold')) bgColor = 'bg-blue-900 text-blue-300';
    return (
      <div className={`${bgColor} text-xs font-semibold px-2 py-1 rounded`}>
        {fallbackSignal}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="p-6 bg-gray-900 border border-red-800 rounded-lg space-y-3">
        <p className="text-red-400 font-semibold">Failed to load market data</p>
        <p className="text-red-300 text-sm font-mono bg-red-950/50 px-3 py-2 rounded">{error}</p>
        <p className="text-gray-400 text-xs">
          Common causes: missing <code className="text-yellow-400">POLYGON_API_KEY</code> env variable,
          Polygon rate limit (5 req/min on free plan), or markets closed with no snapshot data.
        </p>
        <button
          onClick={() => { setError(null); setRetryCount(c => c + 1); }}
          className="text-blue-400 hover:text-blue-300 text-sm underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with connection status */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4 border-b border-gray-700 flex-1">
          {(['stocks', 'crypto', 'all'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-semibold capitalize border-b-2 transition ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Live / Fallback indicator */}
        <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ml-4 ${
          connected
            ? 'bg-green-900/50 text-green-400 border border-green-800'
            : 'bg-gray-800 text-gray-500 border border-gray-700'
        }`}>
          {connected
            ? <><Wifi className="w-3 h-3" /> LIVE</>
            : <><WifiOff className="w-3 h-3" /> REST</>
          }
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-24 mb-2"></div>
              <div className="h-6 bg-gray-700 rounded w-32 mb-4"></div>
              <div className="h-4 bg-gray-700 rounded w-20"></div>
            </div>
          ))}
        </div>
      )}

      {/* Cards Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayItems.map((item) => {
            const isNegative  = (item as any).change < 0;
            const signalColor = isNegative ? 'text-red-500' : 'text-green-500';
            const isFlashing  = flashSymbols.has(item.symbol);
            const livePrice   = prices.get(item.symbol)?.price;
            const displayPrice = livePrice ?? (item as any).price;

            return (
              <div
                key={item.symbol}
                onClick={() => onSymbolSelect?.(item.symbol)}
                className={`bg-gray-800 rounded-lg p-4 transition-all duration-200 ${
                  isFlashing ? 'ring-1 ring-blue-500/50' : ''
                } ${onSymbolSelect ? 'cursor-pointer hover:bg-gray-700 hover:ring-1 hover:ring-blue-500/30' : 'hover:bg-gray-700'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-white font-bold text-lg">{item.symbol}</h3>
                    <p className="text-gray-400 text-sm">{item.name}</p>
                  </div>
                  {renderSignalBadge(item.symbol, (item as any).technicalSignal)}
                </div>

                <div className="mb-4">
                  <p className={`text-2xl font-semibold transition-colors duration-300 ${
                    isFlashing ? 'text-blue-300' : 'text-white'
                  }`}>
                    ${displayPrice?.toFixed(2) ?? '0.00'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {isNegative
                      ? <TrendingDown className={`w-4 h-4 ${signalColor}`} />
                      : <TrendingUp   className={`w-4 h-4 ${signalColor}`} />
                    }
                    <span className={`${signalColor} text-sm font-semibold`}>
                      {isNegative ? '' : '+'}
                      {(item as any).change?.toFixed(2) ?? '0.00'} (
                      {(item as any).changePercent?.toFixed(2) ?? '0.00'}%)
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && displayItems.length === 0 && (
        <div className="text-center py-12 text-gray-400 space-y-2">
          <p className="text-gray-300 font-medium">No market data available</p>
          <p className="text-sm">
            Polygon&apos;s free plan returns empty snapshots outside US market hours (9:30–16:00 ET).
            Prices shown are from the previous trading day.
          </p>
          <p className="text-xs text-gray-500">
            Check the browser console for detailed API response info.
          </p>
        </div>
      )}
    </div>
  );
}
