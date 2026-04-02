'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

type SideType = 'buy' | 'sell';
type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
type TimeInForce = 'day' | 'gtc' | 'ioc' | 'fok';

interface Message {
  type: 'success' | 'error';
  text: string;
}

export default function TradeForm() {
  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState<SideType>('buy');
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [timeInForce, setTimeInForce] = useState<TimeInForce>('day');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!symbol || !quantity) {
      setMessage({ type: 'error', text: 'Symbol and quantity are required' });
      return;
    }

    // Build the order object exactly as alpaca.ts submitOrder() expects
    const order: any = {
      symbol: symbol.toUpperCase(),
      side,
      type: orderType,
      qty: parseFloat(quantity),
      timeInForce,
    };

    if (['limit', 'stop_limit'].includes(orderType) && limitPrice) {
      order.limitPrice = parseFloat(limitPrice);
    }

    if (['stop', 'stop_limit'].includes(orderType) && stopPrice) {
      order.stopPrice = parseFloat(stopPrice);
    }

    try {
      setLoading(true);
      const response = await fetch('/api/markets/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Route expects { action, order } — nest order under "order" key
        body: JSON.stringify({ action: 'submit', order }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || 'Failed to submit trade');
      }
      const data = await response.json();

      // Route returns { order: alpacaOrder } — id is at data.order.id
      setMessage({ type: 'success', text: `Order placed! ID: ${data.order?.id ?? 'submitted'}` });
      // Reset form
      setSymbol('');
      setQuantity('');
      setLimitPrice('');
      setStopPrice('');

      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to place order',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-900 rounded-lg p-6 space-y-4 max-w-md mx-auto"
    >
      <h2 className="text-white text-2xl font-bold mb-6">Place Order</h2>

      {/* Messages */}
      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-900/30 text-green-500'
              : 'bg-red-900/30 text-red-500'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Symbol */}
      <div>
        <label className="block text-gray-400 text-sm font-semibold mb-2">Symbol</label>
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="e.g., AAPL"
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Side */}
      <div>
        <label className="block text-gray-400 text-sm font-semibold mb-2">Side</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSide('buy')}
            className={`flex-1 py-2 rounded font-semibold transition ${
              side === 'buy'
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Buy
          </button>
          <button
            type="button"
            onClick={() => setSide('sell')}
            className={`flex-1 py-2 rounded font-semibold transition ${
              side === 'sell'
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Sell
          </button>
        </div>
      </div>

      {/* Order Type */}
      <div>
        <label className="block text-gray-400 text-sm font-semibold mb-2">Order Type</label>
        <select
          value={orderType}
          onChange={(e) => setOrderType(e.target.value as OrderType)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
        >
          <option value="market">Market</option>
          <option value="limit">Limit</option>
          <option value="stop">Stop</option>
          <option value="stop_limit">Stop Limit</option>
        </select>
      </div>

      {/* Quantity */}
      <div>
        <label className="block text-gray-400 text-sm font-semibold mb-2">Quantity</label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="0"
          step="0.01"
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Limit Price */}
      {['limit', 'stop_limit'].includes(orderType) && (
        <div>
          <label className="block text-gray-400 text-sm font-semibold mb-2">Limit Price</label>
          <input
            type="number"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            placeholder="0.00"
            step="0.01"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      {/* Stop Price */}
      {['stop', 'stop_limit'].includes(orderType) && (
        <div>
          <label className="block text-gray-400 text-sm font-semibold mb-2">Stop Price</label>
          <input
            type="number"
            value={stopPrice}
            onChange={(e) => setStopPrice(e.target.value)}
            placeholder="0.00"
            step="0.01"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      {/* Time in Force */}
      <div>
        <label className="block text-gray-400 text-sm font-semibold mb-2">Time in Force</label>
        <select
          value={timeInForce}
          onChange={(e) => setTimeInForce(e.target.value as TimeInForce)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
        >
          <option value="day">Day</option>
          <option value="gtc">GTC (Good Till Cancel)</option>
          <option value="ioc">IOC (Immediate or Cancel)</option>
          <option value="fok">FOK (Fill or Kill)</option>
        </select>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className={`w-full py-2 rounded font-semibold transition ${
          loading
            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {loading ? 'Submitting...' : 'Place Order'}
      </button>
    </form>
  );
}
