'use client';

import { useState } from 'react';
import { DashboardNav } from '@/components/markets/DashboardNav';
import MarketOverview from '@/components/markets/MarketOverview';
import SignalsFeed from '@/components/markets/SignalsFeed';
import StockDetailPanel from '@/components/markets/StockDetailPanel';

export default function MarketsPage() {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  return (
    <>
      <DashboardNav />
      <main className="min-h-screen bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">

          {/* Market quotes + technical overview */}
          <section>
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-white mb-1">Markets Overview</h1>
              <p className="text-gray-400">
                Real-time market data and analysis
                {!selectedSymbol && (
                  <span className="ml-2 text-sm text-gray-600">· Click any symbol to open its chart</span>
                )}
              </p>
            </div>
            <MarketOverview onSymbolSelect={setSelectedSymbol} />
          </section>

          {/* Candlestick chart — shown when a symbol is selected */}
          {selectedSymbol && (
            <section>
              <StockDetailPanel
                symbol={selectedSymbol}
                onClose={() => setSelectedSymbol(null)}
              />
            </section>
          )}

          {/* Live AI trading signals from the WebSocket gateway */}
          <SignalsFeed onSymbolSelect={setSelectedSymbol} />

        </div>
      </main>
    </>
  );
}
