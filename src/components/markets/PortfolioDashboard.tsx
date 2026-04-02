'use client';

import { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface EquityCurvePoint {
  timestamp: string;
  equity: number;
}

interface Position {
  symbol: string;
  quantity: number;
  averageEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPercent: number;
}

interface PortfolioData {
  totalEquity: number;
  dayPnL: number;
  dayPnLPercent: number;
  totalPnL: number;
  totalPnLPercent: number;
  cash: number;
  buyingPower: number;
  equityCurve: EquityCurvePoint[];
  positions: Position[];
}

type PeriodType = '1d' | '1w' | '1m' | '3m' | '1y';

export default function PortfolioDashboard() {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodType>('1m');

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/markets/portfolio');
        if (!response.ok) throw new Error('Failed to fetch portfolio data');
        const raw = await response.json();

        // API returns { account: PortfolioSummary, history: AlpacaHistory }
        const account = raw.account ?? raw;
        const history = raw.history;

        // Map Alpaca position field names → component field names
        // getPositions() in alpaca.ts returns camelCase: qty, avgEntryPrice, currentPrice,
        // marketValue, unrealizedPL, unrealizedPLPercent
        // Raw Alpaca API uses snake_case: qty, avg_entry_price, current_price, etc.
        // We handle BOTH so either source works
        const safeFloat = (v: any) => {
          const n = parseFloat(v);
          return isNaN(n) ? 0 : n;
        };

        const positions: Position[] = (account.positions ?? []).map((pos: any) => ({
          symbol: pos.symbol ?? '',
          quantity: safeFloat(pos.qty ?? pos.quantity ?? 0),
          averageEntryPrice: safeFloat(
            pos.avg_entry_price ?? pos.avgEntryPrice ?? pos.averageEntryPrice ?? 0
          ),
          currentPrice: safeFloat(pos.current_price ?? pos.currentPrice ?? 0),
          marketValue: safeFloat(pos.market_value ?? pos.marketValue ?? 0),
          // unrealizedPL (camelCase from getPositions) or unrealized_pl (raw Alpaca)
          pnl: safeFloat(pos.unrealizedPL ?? pos.unrealized_pl ?? pos.pnl ?? 0),
          // unrealizedPLPercent already multiplied by 100 in getPositions()
          // unrealized_plpc from raw Alpaca is a decimal → multiply by 100
          pnlPercent: pos.unrealizedPLPercent != null
            ? safeFloat(pos.unrealizedPLPercent)
            : pos.pnlPercent != null
              ? safeFloat(pos.pnlPercent)
              : safeFloat(pos.unrealized_plpc ?? 0) * 100,
        }));

        // Map portfolio history to equityCurve
        // Case 1: Raw Alpaca { timestamp: number[], equity: number[] }
        // Case 2: getPortfolioHistory() returns PortfolioHistoryPoint[] array of objects
        let equityCurve: EquityCurvePoint[] = [];
        if (history?.timestamp && Array.isArray(history.timestamp)) {
          // Raw Alpaca format — timestamps are Unix seconds
          equityCurve = history.timestamp.map((ts: number, i: number) => ({
            timestamp: new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            equity: history.equity?.[i] ?? 0,
          }));
        } else if (Array.isArray(history) && history.length > 0) {
          // PortfolioHistoryPoint[] format — timestamps already in milliseconds
          equityCurve = history.map((pt: any) => ({
            timestamp: pt.timestamp
              ? new Date(pt.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : '',
            equity: pt.equity ?? 0,
          }));
        }

        setPortfolio({
          totalEquity: parseFloat(account.equity ?? account.portfolioValue ?? 0),
          dayPnL: parseFloat(account.dayPL ?? account.dayPnL ?? 0),
          dayPnLPercent: parseFloat(account.dayPLPercent ?? account.dayPnLPercent ?? 0),
          totalPnL: parseFloat(account.totalPL ?? account.totalPnL ?? 0),
          totalPnLPercent: parseFloat(account.totalPLPercent ?? account.totalPnLPercent ?? 0),
          cash: parseFloat(account.cash ?? 0),
          buyingPower: parseFloat(account.buyingPower ?? 0),
          equityCurve,
          positions,
        });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, []);

  if (error) {
    return (
      <div className="p-6 bg-gray-900 text-white rounded-lg">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-4 h-20 animate-pulse"></div>
        ))}
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="p-6 bg-gray-900 text-white rounded-lg">
        <p className="text-gray-400">No portfolio data available</p>
      </div>
    );
  }

  const fmt = (n: number | undefined | null) => (n ?? 0).toFixed(2);

  const statCards = [
    {
      label: 'Total Equity',
      value: `$${fmt(portfolio.totalEquity)}`,
      change: portfolio.totalPnL,
      changePercent: portfolio.totalPnLPercent,
    },
    {
      label: 'Day P&L',
      value: `$${fmt(portfolio.dayPnL)}`,
      change: portfolio.dayPnL,
      changePercent: portfolio.dayPnLPercent,
    },
    {
      label: 'Total P&L',
      value: `$${fmt(portfolio.totalPnL)}`,
      change: portfolio.totalPnL,
      changePercent: portfolio.totalPnLPercent,
    },
    {
      label: 'Cash',
      value: `$${fmt(portfolio.cash)}`,
    },
    {
      label: 'Buying Power',
      value: `$${fmt(portfolio.buyingPower)}`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((card, idx) => {
          const isNegative = card.change !== undefined && card.change < 0;
          const colorClass = isNegative ? 'text-red-500' : 'text-green-500';

          return (
            <div key={idx} className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm font-semibold mb-2">{card.label}</p>
              <p className="text-white text-2xl font-bold mb-2">{card.value}</p>
              {card.changePercent !== undefined && (
                <div className="flex items-center gap-1">
                  {isNegative ? (
                    <TrendingDown className={`w-4 h-4 ${colorClass}`} />
                  ) : (
                    <TrendingUp className={`w-4 h-4 ${colorClass}`} />
                  )}
                  <span className={`${colorClass} text-xs font-semibold`}>
                    {isNegative ? '' : '+'}
                    {fmt(card.changePercent)}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Equity Curve */}
      <div className="bg-gray-900 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white text-xl font-bold">Equity Curve</h2>
          <div className="flex gap-2">
            {(['1d', '1w', '1m', '3m', '1y'] as PeriodType[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded font-semibold transition ${
                  period === p
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={portfolio.equityCurve}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
              <XAxis dataKey="timestamp" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #4b5563',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#equityGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Positions Table */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-white text-xl font-bold mb-4">Positions</h2>
        {portfolio.positions.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No positions open</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Symbol</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Qty</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Avg Entry</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Current</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Market Value</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">P&L</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">P&L %</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.positions.map((pos) => {
                  const isProfit = pos.pnl >= 0;
                  const colorClass = isProfit ? 'text-green-500' : 'text-red-500';
                  const rowBg = isProfit ? 'bg-green-900/10' : 'bg-red-900/10';

                  return (
                    <tr key={pos.symbol} className={`${rowBg} border-b border-gray-700`}>
                      <td className="py-3 px-4 text-white font-semibold">{pos.symbol}</td>
                      <td className="py-3 px-4 text-white">{pos.quantity}</td>
                      <td className="py-3 px-4 text-white">${fmt(pos.averageEntryPrice)}</td>
                      <td className="py-3 px-4 text-white">${fmt(pos.currentPrice)}</td>
                      <td className="py-3 px-4 text-white">${fmt(pos.marketValue)}</td>
                      <td className={`py-3 px-4 font-semibold ${colorClass}`}>
                        ${fmt(pos.pnl)}
                      </td>
                      <td className={`py-3 px-4 font-semibold ${colorClass}`}>
                        {isProfit ? '+' : ''}
                        {fmt(pos.pnlPercent)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
