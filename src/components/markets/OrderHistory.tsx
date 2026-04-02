'use client';

import { useState, useEffect } from 'react';
import { XCircle } from 'lucide-react';

type TabType = 'open' | 'closed' | 'all';

interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: string;
  // Alpaca returns qty (not quantity) and limitPrice / filledPrice (not price)
  qty?: number;
  quantity?: number;
  limitPrice?: number | null;
  filledPrice?: number | null;
  stopPrice?: number | null;
  status: 'filled' | 'cancelled' | 'rejected' | 'pending' | 'partial';
  createdAt: string;
}

export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/markets/trade?status=all');
        if (!response.ok) throw new Error('Failed to fetch orders');
        const data = await response.json();
        setOrders(data.orders || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const handleCancel = async (orderId: string) => {
    try {
      setCancelling(orderId);
      const response = await fetch('/api/markets/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', orderId }),
      });

      if (!response.ok) throw new Error('Failed to cancel order');
      // Update local state
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelled' } : o))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setCancelling(null);
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (activeTab === 'open') return order.status === 'pending' || order.status === 'partial';
    if (activeTab === 'closed')
      return ['filled', 'cancelled', 'rejected'].includes(order.status);
    return true;
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'filled':
        return 'bg-green-900 text-green-300';
      case 'pending':
        return 'bg-yellow-900 text-yellow-300';
      case 'partial':
        return 'bg-blue-900 text-blue-300';
      case 'cancelled':
        return 'bg-gray-700 text-gray-300';
      case 'rejected':
        return 'bg-red-900 text-red-300';
      default:
        return 'bg-gray-700 text-gray-300';
    }
  };

  const getSideColor = (side: string) => (side === 'buy' ? 'text-green-500' : 'text-red-500');

  if (error) {
    return (
      <div className="p-6 bg-gray-900 text-white rounded-lg">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6 space-y-6">
      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-700">
        {(['open', 'closed', 'all'] as TabType[]).map((tab) => (
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

      {/* Loading State */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-gray-800 rounded h-12 animate-pulse"></div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredOrders.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p>No orders found</p>
        </div>
      )}

      {/* Orders Table */}
      {!loading && filteredOrders.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-gray-400 font-semibold">Date</th>
                <th className="text-left py-3 px-4 text-gray-400 font-semibold">Symbol</th>
                <th className="text-left py-3 px-4 text-gray-400 font-semibold">Side</th>
                <th className="text-left py-3 px-4 text-gray-400 font-semibold">Type</th>
                <th className="text-left py-3 px-4 text-gray-400 font-semibold">Qty</th>
                <th className="text-left py-3 px-4 text-gray-400 font-semibold">Price</th>
                <th className="text-left py-3 px-4 text-gray-400 font-semibold">Status</th>
                <th className="text-left py-3 px-4 text-gray-400 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const isOpen = ['pending', 'partial'].includes(order.status);
                return (
                  <tr key={order.id} className="border-b border-gray-700 hover:bg-gray-800/50">
                    <td className="py-3 px-4 text-white text-xs">
                      {new Date(order.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-white font-semibold">{order.symbol}</td>
                    <td className={`py-3 px-4 font-semibold ${getSideColor(order.side)}`}>
                      {order.side.toUpperCase()}
                    </td>
                    <td className="py-3 px-4 text-white capitalize">{order.type}</td>
                    <td className="py-3 px-4 text-white">
                      {order.qty ?? order.quantity ?? '—'}
                    </td>
                    <td className="py-3 px-4 text-white">
                      {(() => {
                        // Show fill price if filled, else limit price, else "Market"
                        const p = order.filledPrice ?? order.limitPrice ?? order.stopPrice;
                        return p != null ? `$${Number(p).toFixed(2)}` : 'Market';
                      })()}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`${getStatusBadgeColor(order.status)} px-2 py-1 rounded text-xs font-semibold`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {isOpen && (
                        <button
                          onClick={() => handleCancel(order.id)}
                          disabled={cancelling === order.id}
                          className={`flex items-center gap-1 text-red-500 hover:text-red-400 transition ${
                            cancelling === order.id ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
