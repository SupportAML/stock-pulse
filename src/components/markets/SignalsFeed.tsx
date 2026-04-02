'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useMarketStream, type SignalUpdate } from '@/hooks/useMarketStream';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'ws://localhost:8080';

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
      connected
        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        : 'bg-gray-800 text-gray-500 border border-gray-700'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
      {connected ? 'Live' : 'Connecting…'}
    </span>
  );
}

function ActionBadge({ action }: { action: 'BUY' | 'SELL' | 'HOLD' }) {
  const styles = {
    BUY:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    SELL: 'bg-red-500/15 text-red-400 border-red-500/30',
    HOLD: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold border tracking-wide ${styles[action]}`}>
      {action}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number | null | undefined }) {
  const pct = Math.min(100, Math.max(0, value ?? 0));
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
    </div>
  );
}

function PriceRow({ label, value, color }: { label: string; value: number | null | undefined; color: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-mono font-medium ${color}`}>
        {value != null ? `$${value.toFixed(2)}` : '—'}
      </span>
    </div>
  );
}

function SignalCard({ signal, isNew }: { signal: SignalUpdate; isNew: boolean }) {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (isNew) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1200);
      return () => clearTimeout(t);
    }
  }, [isNew]);

  const isAlgorithmic = (signal as any).algorithmic === true;
  const age = Date.now() - (signal.timestamp ?? 0);
  const ageLabel = age < 60_000
    ? `${Math.floor(age / 1000)}s ago`
    : age < 3_600_000
    ? `${Math.floor(age / 60_000)}m ago`
    : `${Math.floor(age / 3_600_000)}h ago`;

  return (
    <div className={`relative rounded-xl border bg-gray-900 p-4 flex flex-col gap-3 transition-all duration-300 ${
      flash ? 'border-blue-500/60 shadow-lg shadow-blue-500/10' : 'border-gray-800 hover:border-gray-700'
    }`}>
      {/* Flash overlay */}
      {flash && (
        <div className="absolute inset-0 rounded-xl bg-blue-500/5 pointer-events-none animate-pulse" />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-white tracking-wide">{signal.symbol}</span>
          <ActionBadge action={signal.action} />
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs text-gray-600">{ageLabel}</span>
          {isAlgorithmic ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
              Algo
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              AI
            </span>
          )}
        </div>
      </div>

      {/* Confidence */}
      <div>
        <div className="flex justify-between mb-1">
          <span className="text-xs text-gray-500">Confidence</span>
        </div>
        <ConfidenceBar value={signal.confidence} />
      </div>

      {/* Price levels */}
      <div className="flex flex-col gap-1 bg-gray-800/40 rounded-lg px-3 py-2">
        <PriceRow label="Entry"     value={signal.entry}    color="text-white" />
        <PriceRow label="Target"    value={signal.target}   color="text-emerald-400" />
        <PriceRow label="Stop Loss" value={signal.stopLoss} color="text-red-400" />
      </div>

      {/* Risk/reward */}
      {signal.entry > 0 && signal.stopLoss > 0 && signal.target > 0 &&
        signal.entry !== signal.stopLoss && (
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Risk/Reward</span>
          <span className="text-gray-300 font-mono">
            {Math.abs((signal.target - signal.entry) / (signal.entry - signal.stopLoss)).toFixed(2)}x
          </span>
        </div>
      )}

      {/* Reasoning */}
      {(signal.reasoning || signal.reason) && (
        <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
          {signal.reasoning || signal.reason}
        </p>
      )}

      {/* Disclaimer */}
      <p className="text-[10px] text-gray-600 italic">
        {signal.disclaimer ?? 'For educational purposes only. Not financial advice.'}
      </p>
    </div>
  );
}

function EmptyState({ connected }: { connected: boolean }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-800/60 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      {connected ? (
        <>
          <p className="text-gray-400 font-medium">Waiting for signals…</p>
          <p className="text-gray-600 text-sm mt-1">
            The gateway generates a signal for each symbol on every 1-minute bar.
            First signal arrives within 60 seconds of the market opening.
          </p>
        </>
      ) : (
        <>
          <p className="text-gray-400 font-medium">Gateway offline</p>
          <p className="text-gray-600 text-sm mt-1 max-w-xs">
            Start the WebSocket gateway to receive live signals.
          </p>
          <code className="mt-3 text-xs bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg">
            cd stockpulse-gateway &amp;&amp; node server.js
          </code>
        </>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SignalsFeedProps {
  onSymbolSelect?: (symbol: string) => void;
}

export default function SignalsFeed({ onSymbolSelect }: SignalsFeedProps) {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;
  const { signals, connected } = useMarketStream(GATEWAY_URL, { token });

  // Track which signals are newly arrived (for flash animation)
  const prevSignalKeys = useRef<Set<string>>(new Set());
  const [newSymbols, setNewSymbols] = useState<Set<string>>(new Set());

  useEffect(() => {
    const incoming = new Set(signals.keys());
    const fresh = new Set<string>();
    for (const sym of incoming) {
      if (!prevSignalKeys.current.has(sym)) fresh.add(sym);
      // Also flash if the signal was updated (timestamp changed)
      else {
        const prev = prevSignalKeys.current;
        if (prev.has(sym)) fresh.add(sym); // new timestamp = updated signal
      }
    }
    prevSignalKeys.current = incoming;
    if (fresh.size > 0) {
      setNewSymbols(fresh);
      const t = setTimeout(() => setNewSymbols(new Set()), 1500);
      return () => clearTimeout(t);
    }
  }, [signals]);

  // Sort signals: BUY first, then SELL, then HOLD; within each group by confidence desc
  const sortedSignals = [...signals.values()].sort((a, b) => {
    const order = { BUY: 0, SELL: 1, HOLD: 2 };
    const orderDiff = (order[a.action] ?? 3) - (order[b.action] ?? 3);
    if (orderDiff !== 0) return orderDiff;
    return b.confidence - a.confidence;
  });

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-white">AI Trading Signals</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Live signals from the Alpaca WebSocket + Ollama signal engine
          </p>
        </div>
        <div className="flex items-center gap-3">
          {signals.size > 0 && (
            <span className="text-sm text-gray-500">{signals.size} symbol{signals.size !== 1 ? 's' : ''}</span>
          )}
          <ConnectionBadge connected={connected} />
        </div>
      </div>

      {/* Signal grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sortedSignals.length === 0 ? (
          <EmptyState connected={connected} />
        ) : (
          sortedSignals.map(signal => (
            <div key={signal.symbol} onClick={() => onSymbolSelect?.(signal.symbol)}
              className={onSymbolSelect ? 'cursor-pointer' : ''}>
              <SignalCard
                signal={signal}
                isNew={newSymbols.has(signal.symbol)}
              />
            </div>
          ))
        )}
      </div>
    </section>
  );
}
