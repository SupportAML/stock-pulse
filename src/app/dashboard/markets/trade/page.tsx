'use client';

import { DashboardNav } from '@/components/markets/DashboardNav';
import TradeForm from '@/components/markets/TradeForm';
import OrderHistory from '@/components/markets/OrderHistory';

export default function TradePage() {
  return (
    <>
      <DashboardNav />
      <main className="min-h-screen bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Trade</h1>
            <p className="text-gray-400">Execute trades and manage your orders</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Trade Form */}
            <div className="lg:col-span-1">
              <TradeForm />
            </div>

            {/* Order History */}
            <div className="lg:col-span-2">
              <OrderHistory />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
