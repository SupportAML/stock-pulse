'use client';

import { DashboardNav } from '@/components/markets/DashboardNav';
import PortfolioDashboard from '@/components/markets/PortfolioDashboard';

export default function PortfolioPage() {
  return (
    <>
      <DashboardNav />
      <main className="min-h-screen bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Portfolio</h1>
            <p className="text-gray-400">Your holdings and performance</p>
          </div>
          <PortfolioDashboard />
        </div>
      </main>
    </>
  );
}
