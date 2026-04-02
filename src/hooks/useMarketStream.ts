'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TradeUpdate {
  type: 'trade';
  symbol: string;
  price: number;
  size: number;
  timestamp: string;
}

export interface BarUpdate {
  type: 'bar';
  symbol: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  timestamp: string;
}

export interface SignalUpdate {
  type: 'signal';
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  entry: number;
  stopLoss: number;
  target: number;
  reasoning: string;
  reason: string;
  timestamp: number;
  disclaimer: string;
}

export interface StatusUpdate {
  type: 'status';
  symbol: string;
  status: string;
  reason: string;
  timestamp: string;
}

export type MarketMessage = TradeUpdate | BarUpdate | SignalUpdate | StatusUpdate;

export interface PriceData {
  price: number;
  size?: number;
  timestamp: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseMarketStreamOptions {
  /** NextAuth session token for JWT auth. Leave undefined in dev (no auth required). */
  token?: string;
  /** Watchlist symbols — get AI signals every minute bar instead of every 5 min. */
  watchlist?: string[];
  /** Called on every incoming message (optional global listener). */
  onMessage?: (msg: MarketMessage) => void;
}

interface UseMarketStreamReturn {
  /** Latest price per symbol. Populated from snapshot on connect, updated on trades. */
  prices: Map<string, PriceData>;
  /** Latest AI signals per symbol. */
  signals: Map<string, SignalUpdate>;
  /** Whether the WebSocket is currently connected. */
  connected: boolean;
  /** Subscribe to messages for a specific symbol. Returns an unsubscribe function. */
  subscribe: (symbol: string, callback: (msg: MarketMessage) => void) => () => void;
}

export function useMarketStream(
  gatewayUrl: string,
  options: UseMarketStreamOptions = {}
): UseMarketStreamReturn {
  const { token, watchlist = [], onMessage } = options;

  const wsRef      = useRef<WebSocket | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted  = useRef(true);

  const [prices,    setPrices]    = useState<Map<string, PriceData>>(new Map());
  const [signals,   setSignals]   = useState<Map<string, SignalUpdate>>(new Map());
  const [connected, setConnected] = useState(false);

  // Per-symbol listeners: symbol -> Set<callback>
  const listenersRef = useRef<Map<string, Set<(msg: MarketMessage) => void>>>(new Map());

  // ── Notify symbol listeners ──────────────────────────────────────────────
  const notifyListeners = useCallback((symbol: string, msg: MarketMessage) => {
    const set = listenersRef.current.get(symbol);
    if (set) {
      for (const cb of set) cb(msg);
    }
  }, []);

  // ── Connect ──────────────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;

    function connect() {
      if (!isMounted.current) return;

      // Build URL with optional JWT token
      const url = token ? `${gatewayUrl}?token=${token}` : gatewayUrl;

      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch (err) {
        console.error('[useMarketStream] Failed to create WebSocket:', err);
        scheduleRetry();
        return;
      }

      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted.current) return;
        setConnected(true);
        console.log('[useMarketStream] Connected to gateway');

        // Send watchlist to gateway for priority signal generation
        if (watchlist.length > 0) {
          ws.send(JSON.stringify({ type: 'set_watchlist', symbols: watchlist }));
        }

        // Start keepalive pings every 30s
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);

        ws.addEventListener('close', () => clearInterval(pingInterval));
      };

      ws.onmessage = (event) => {
        if (!isMounted.current) return;

        let msg: any;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        // ── Snapshot (full price cache on connect) ─────────────────────────
        if (msg.type === 'snapshot') {
          const map = new Map<string, PriceData>();
          for (const [symbol, data] of Object.entries(msg.data as Record<string, any>)) {
            if (data?.price) {
              map.set(symbol, { price: data.price, size: data.size, timestamp: data.timestamp });
            }
          }
          setPrices(map);
          return;
        }

        // ── Signals snapshot (latest AI signals for all symbols on connect) ──
        if (msg.type === 'signals_snapshot') {
          const map = new Map<string, SignalUpdate>();
          for (const [symbol, sig] of Object.entries(msg.data as Record<string, any>)) {
            if (sig?.action) map.set(symbol, sig as SignalUpdate);
          }
          setSignals(map);
          return;
        }

        // ── Trade update ───────────────────────────────────────────────────
        if (msg.type === 'trade') {
          setPrices(prev => {
            const next = new Map(prev);
            next.set(msg.symbol, { price: msg.price, size: msg.size, timestamp: Date.now() });
            return next;
          });
          notifyListeners(msg.symbol, msg as TradeUpdate);
          onMessage?.(msg as TradeUpdate);
          return;
        }

        // ── Bar update ─────────────────────────────────────────────────────
        if (msg.type === 'bar') {
          // Update price from bar close
          setPrices(prev => {
            const next = new Map(prev);
            next.set(msg.symbol, { price: msg.c, size: msg.v, timestamp: Date.now() });
            return next;
          });
          notifyListeners(msg.symbol, msg as BarUpdate);
          onMessage?.(msg as BarUpdate);
          return;
        }

        // ── AI Signal ──────────────────────────────────────────────────────
        if (msg.type === 'signal') {
          setSignals(prev => {
            const next = new Map(prev);
            next.set(msg.symbol, msg as SignalUpdate);
            return next;
          });
          notifyListeners(msg.symbol, msg as SignalUpdate);
          onMessage?.(msg as SignalUpdate);
          return;
        }

        // ── Other messages (status, pong, watchlist_ack) ───────────────────
        onMessage?.(msg);
      };

      ws.onclose = (event) => {
        if (!isMounted.current) return;
        setConnected(false);
        if (event.code !== 1000) {
          // 1000 = clean close (component unmounted). Anything else = retry.
          console.log('[useMarketStream] Gateway unreachable — falling back to REST. Retrying in 3s...');
          scheduleRetry();
        }
      };

      ws.onerror = () => {
        // onclose fires immediately after onerror and handles the retry.
        // We suppress the error log here because a failed connection attempt
        // (e.g. gateway not running) is expected during dev and handled gracefully.
      };
    }

    function scheduleRetry() {
      if (!isMounted.current) return;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(connect, 3000);
    }

    connect();

    return () => {
      isMounted.current = false;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gatewayUrl, token]);

  // ── Subscribe API ────────────────────────────────────────────────────────
  const subscribe = useCallback(
    (symbol: string, callback: (msg: MarketMessage) => void) => {
      const sym = symbol.toUpperCase();
      if (!listenersRef.current.has(sym)) {
        listenersRef.current.set(sym, new Set());
      }
      listenersRef.current.get(sym)!.add(callback);

      return () => {
        listenersRef.current.get(sym)?.delete(callback);
      };
    },
    []
  );

  return { prices, signals, connected, subscribe };
}
