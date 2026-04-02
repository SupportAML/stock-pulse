'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="max-w-2xl mx-auto px-4 text-center">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            StockPulse
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-2">
            AI-Powered Paper Trading
          </p>
          <p className="text-gray-400">
            Master the markets with real-time data, AI predictions, and risk-free trading
          </p>
        </div>

        {/* CTA Button */}
        <Link
          href="/dashboard/markets"
          className="inline-block px-8 py-3 mb-16 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
        >
          Enter Dashboard
        </Link>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="text-lg font-semibold mb-2">Real-time Data</h3>
            <p className="text-gray-400 text-sm">
              Live market quotes and comprehensive stock information updated continuously
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="text-3xl mb-3">🤖</div>
            <h3 className="text-lg font-semibold mb-2">AI Predictions</h3>
            <p className="text-gray-400 text-sm">
              Advanced machine learning models predict stock price movements and identify opportunities
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="text-3xl mb-3">📈</div>
            <h3 className="text-lg font-semibold mb-2">Paper Trading</h3>
            <p className="text-gray-400 text-sm">
              Practice trading with virtual funds without any financial risk
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="text-3xl mb-3">📉</div>
            <h3 className="text-lg font-semibold mb-2">Technical Analysis</h3>
            <p className="text-gray-400 text-sm">
              Professional-grade charting and technical indicators for informed decisions
            </p>
          </div>
        </div>

        {/* Footer Link */}
        <p className="text-gray-500 text-sm">
          Start your trading journey today
        </p>
      </div>
    </div>
  );
}
