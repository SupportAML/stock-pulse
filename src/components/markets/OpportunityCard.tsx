'use client';

import { AlertCircle } from 'lucide-react';
import { TradeOpportunity } from '@/lib/markets/types';

interface OpportunityCardProps {
  opportunity: TradeOpportunity;
  onExecute?: (opportunity: TradeOpportunity) => void;
}

export default function OpportunityCard({ opportunity, onExecute }: OpportunityCardProps) {
  const getActionBadgeColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'buy':
        return 'bg-green-600 text-white';
      case 'sell':
        return 'bg-red-600 text-white';
      case 'hold':
        return 'bg-blue-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  const riskRewardRatio = opportunity.targetPrice
    ? Math.abs((opportunity.targetPrice - opportunity.entryPrice) /
      (opportunity.entryPrice - opportunity.stopLoss))
    : 0;

  const potentialReturn = opportunity.targetPrice
    ? ((opportunity.targetPrice - opportunity.entryPrice) / opportunity.entryPrice) * 100
    : 0;

  return (
    <div className="bg-gray-800 rounded-lg p-6 space-y-4 hover:bg-gray-750 transition">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-white text-xl font-bold">{opportunity.symbol}</h3>
          <p className="text-gray-400 text-sm">{opportunity.name}</p>
        </div>
        <span className={`${getActionBadgeColor(opportunity.action)} px-3 py-1 rounded font-semibold text-sm`}>
          {opportunity.action.toUpperCase()}
        </span>
      </div>

      {/* Entry / Target / Stop */}
      <div className="grid grid-cols-3 gap-3 bg-gray-900 rounded p-3">
        <div>
          <p className="text-gray-400 text-xs mb-1">Entry</p>
          <p className="text-white font-semibold">${(opportunity.entryPrice ?? 0).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs mb-1">Target</p>
          <p className="text-green-500 font-semibold">${opportunity.targetPrice?.toFixed(2) || 'N/A'}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs mb-1">Stop Loss</p>
          <p className="text-red-500 font-semibold">${(opportunity.stopLoss ?? 0).toFixed(2)}</p>
        </div>
      </div>

      {/* Risk/Reward & Return */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-900 rounded p-3">
          <div className="flex items-center gap-1 mb-1">
            <AlertCircle className="w-4 h-4 text-orange-500" />
            <p className="text-gray-400 text-xs">Risk/Reward</p>
          </div>
          <p className="text-white font-semibold">{riskRewardRatio.toFixed(2)}:1</p>
        </div>
        <div className="bg-gray-900 rounded p-3">
          <p className="text-gray-400 text-xs mb-1">Potential Return</p>
          <p className={`font-semibold ${potentialReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {potentialReturn >= 0 ? '+' : ''}{potentialReturn.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Confidence Meter */}
      <div>
        <div className="flex justify-between mb-2">
          <p className="text-gray-400 text-xs font-semibold">Confidence</p>
          <p className="text-white text-xs font-semibold">{(opportunity.confidence ?? 0).toFixed(0)}%</p>
        </div>
        <div className="h-2 bg-gray-700 rounded overflow-hidden">
          <div
            className="h-full bg-blue-500"
            style={{ width: `${Math.min(opportunity.confidence ?? 0, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Reasoning */}
      <div className="bg-gray-900 rounded p-3">
        <p className="text-gray-300 text-sm leading-relaxed">{opportunity.reasoning}</p>
      </div>

      {/* Execute Button */}
      <button
        onClick={() => onExecute?.(opportunity)}
        className="w-full py-2 rounded font-semibold transition bg-blue-600 text-white hover:bg-blue-700"
      >
        Execute Trade
      </button>
    </div>
  );
}
