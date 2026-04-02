'use client';

import { useState, useEffect, useRef } from 'react';
import { DashboardNav } from '@/components/markets/DashboardNav';
import PredictionCard from '@/components/markets/PredictionCard';
import OpportunityCard from '@/components/markets/OpportunityCard';
import { Brain, AlertTriangle, TrendingUp, Clock, RefreshCw, Cpu } from 'lucide-react';
import type { MarketPrediction } from '@/lib/markets/types';

// ── Elapsed timer shown while Ollama is generating ────────────────────────────
function ElapsedTimer({ running }: { running: boolean }) {
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running]);

  if (!running) return null;
  return (
    <span className="text-gray-400 text-sm tabular-nums">{seconds}s elapsed</span>
  );
}

export default function PredictionsPage() {
  const [loading, setLoading]           = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [data, setData]                 = useState<(MarketPrediction & { cached?: boolean; modelUsed?: string }) | null>(null);
  const [error, setError]               = useState<string | null>(null);

  // ── Auto-load last cached prediction on mount ──────────────────────────────
  useEffect(() => {
    const loadCached = async () => {
      try {
        const res = await fetch('/api/markets/predict');
        if (res.ok) {
          const json = await res.json();
          if (json.cached && json.predictions?.length > 0) {
            setData(json);
          }
        }
      } catch {
        // Non-fatal — just show empty state
      } finally {
        setInitialLoading(false);
      }
    };
    loadCached();
  }, []);

  // ── Generate fresh predictions via POST ────────────────────────────────────
  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/markets/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        let msg = `Server error ${response.status}`;
        try { const j = await response.json(); msg = j.message || j.error || msg; } catch {}
        throw new Error(msg);
      }
      const json = await response.json();
      setData({ ...json, cached: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  const predictions     = data?.predictions     ?? [];
  const opportunities   = data?.topOpportunities ?? [];
  const marketOverview  = data?.marketOverview   ?? '';
  const warnings        = data?.warnings         ?? [];
  const generatedAt     = data?.generatedAt;
  const modelUsed       = data?.modelUsed        ?? 'qwen2.5:14b';

  // Detect algorithmic fallback: Ollama unavailable warning is injected by predictions.ts
  const isAlgorithmic = warnings.some(w =>
    w.toLowerCase().includes('ollama') ||
    w.toLowerCase().includes('unavailable') ||
    w.toLowerCase().includes('fallback')
  );

  const formattedTime = generatedAt
    ? new Intl.DateTimeFormat('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true,
        month: 'short',  day: 'numeric',
      }).format(new Date(generatedAt))
    : null;

  return (
    <>
      <DashboardNav />
      <main className="min-h-screen bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

          {/* ── Page Header ─────────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Brain className="w-8 h-8 text-blue-500" />
                AI Predictions
              </h1>
              <p className="text-gray-400 mt-1">
                Ollama · {modelUsed} · Multi-timeframe market forecasts
              </p>
            </div>

            <div className="flex items-center gap-4">
              <ElapsedTimer running={loading} />
              <button
                onClick={handleGenerate}
                disabled={loading || initialLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating… (30–60s)
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4" />
                    {data ? 'Regenerate' : 'Generate Predictions'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ── Error Banner ────────────────────────────────────────────────── */}
          {error && (
            <div className="p-4 bg-red-950 border border-red-800 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 font-semibold text-sm">Failed to generate predictions</p>
                <p className="text-red-400 text-sm font-mono mt-1">{error}</p>
                <p className="text-red-500 text-xs mt-2">
                  Make sure Ollama is running: <code className="bg-red-900/50 px-1 rounded">ollama serve</code>
                </p>
              </div>
            </div>
          )}

          {/* ── Initial load skeleton ────────────────────────────────────────── */}
          {initialLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-gray-800 rounded-lg p-6 animate-pulse space-y-4">
                  <div className="h-5 bg-gray-700 rounded w-24" />
                  <div className="h-3 bg-gray-700 rounded w-40" />
                  <div className="h-8 bg-gray-700 rounded w-32" />
                  <div className="space-y-2">
                    {[1,2,3].map(j => <div key={j} className="h-2 bg-gray-700 rounded" />)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Empty state ──────────────────────────────────────────────────── */}
          {!initialLoading && !loading && predictions.length === 0 && !error && (
            <div className="text-center py-16 space-y-3">
              <Brain className="w-12 h-12 text-gray-700 mx-auto" />
              <p className="text-gray-300 text-lg font-medium">No predictions yet</p>
              <p className="text-gray-500 text-sm max-w-md mx-auto">
                Click <strong className="text-gray-400">Generate Predictions</strong> to run the AI analysis.
                Ollama ({modelUsed}) will analyze RSI, MACD, Bollinger Bands, and historical price data for the
                top watched stocks.
              </p>
              <p className="text-gray-600 text-xs">
                First run takes 30–90 seconds depending on your hardware.
              </p>
            </div>
          )}

          {/* ── Data panels ──────────────────────────────────────────────────── */}
          {predictions.length > 0 && (
            <>
              {/* Meta bar — timestamp + AI/algorithmic badge */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {formattedTime && (
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <Clock className="w-4 h-4" />
                    Generated {data?.cached ? 'cached · ' : ''}{formattedTime}
                  </span>
                )}
                {isAlgorithmic ? (
                  <span className="flex items-center gap-1.5 bg-yellow-900/50 text-yellow-400 border border-yellow-800 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                    <Cpu className="w-3.5 h-3.5" />
                    Algorithmic fallback (Ollama offline)
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 bg-blue-900/50 text-blue-400 border border-blue-800 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                    <Brain className="w-3.5 h-3.5" />
                    AI-powered · {modelUsed}
                  </span>
                )}
              </div>

              {/* Market Overview */}
              {marketOverview && (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                  <h2 className="text-white font-semibold text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                    Market Overview
                  </h2>
                  <p className="text-gray-300 leading-relaxed text-sm">{marketOverview}</p>
                </div>
              )}

              {/* Warnings */}
              {warnings.length > 0 && (
                <div className="bg-yellow-950/50 border border-yellow-900 rounded-lg p-4 space-y-2">
                  <h3 className="text-yellow-400 font-semibold text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Market Warnings
                  </h3>
                  <ul className="space-y-1">
                    {warnings.map((w, i) => (
                      <li key={i} className="text-yellow-300 text-sm flex items-start gap-2">
                        <span className="text-yellow-600 mt-1">•</span>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Disclaimer */}
              <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-3 text-xs text-gray-500">
                <strong className="text-gray-400">Disclaimer:</strong> These predictions are generated by a
                local AI model and are for informational purposes only. They do not constitute financial advice.
                Always conduct your own research before making any trading decisions.
              </div>

              {/* Prediction Cards */}
              <section>
                <h2 className="text-xl font-bold text-white mb-4">Stock Predictions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {predictions.map((pred: any, idx: number) => {
                    if (!pred || typeof pred !== 'object' || !pred.symbol) return null;
                    return (
                      <PredictionCard
                        key={pred.symbol ?? idx}
                        prediction={pred}
                      />
                    );
                  })}
                </div>
              </section>

              {/* Opportunities */}
              {opportunities.length > 0 && (
                <section>
                  <h2 className="text-xl font-bold text-white mb-4">Top Opportunities</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {opportunities.map((opp: any, idx: number) => {
                      if (!opp || typeof opp !== 'object') return null;
                      return (
                        <OpportunityCard
                          key={`${opp.symbol ?? 'opp'}-${idx}`}
                          opportunity={opp}
                        />
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}

        </div>
      </main>
    </>
  );
}
