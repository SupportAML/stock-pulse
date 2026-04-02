'use client';

import { useState } from 'react';
import { ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';
import { PricePrediction } from '@/lib/markets/types';

type TimeframeType = '1h' | '4h' | '1d' | '1w' | '1m';

interface PredictionCardProps {
  prediction: PricePrediction;
}

export default function PredictionCard({ prediction }: PredictionCardProps) {
  const [activeTimeframe, setActiveTimeframe] = useState<TimeframeType>('1d');
  const [showReasoning, setShowReasoning] = useState(false);

  const currentTimeframeData = prediction.predictions.find(
    (p) => p.timeframe === activeTimeframe
  );

  const getRiskBadgeColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'low':
        return 'bg-green-900 text-green-300';
      case 'medium':
        return 'bg-yellow-900 text-yellow-300';
      case 'high':
        return 'bg-orange-900 text-orange-300';
      case 'extreme':
        return 'bg-red-900 text-red-300';
      default:
        return 'bg-gray-700 text-gray-300';
    }
  };

  // Sentiment values come as 0–1 from the API (e.g. 0.6 = 60% bullish)
  const getSentimentColor = (value: number) => {
    if (value > 0.6) return 'bg-green-600';
    if (value > 0.4) return 'bg-blue-600';
    if (value > 0.2) return 'bg-orange-600';
    return 'bg-red-600';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-white text-2xl font-bold">{prediction.symbol}</h2>
          <p className="text-gray-400">Current: ${(prediction.currentPrice ?? 0).toFixed(2)}</p>
        </div>
        <span className={`${getRiskBadgeColor(prediction.riskLevel)} px-3 py-1 rounded font-semibold text-sm`}>
          {prediction.riskLevel}
        </span>
      </div>

      {/* Timeframe Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        {(['1h', '4h', '1d', '1w', '1m'] as TimeframeType[]).map((tf) => (
          <button
            key={tf}
            onClick={() => setActiveTimeframe(tf)}
            className={`px-3 py-2 text-sm font-semibold border-b-2 transition ${
              activeTimeframe === tf
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {tf.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Prediction for Active Timeframe */}
      {currentTimeframeData && (
        <div className="bg-gray-900 rounded p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Predicted Price</p>
              <p className="text-white text-2xl font-bold">${(currentTimeframeData.predictedPrice ?? 0).toFixed(2)}</p>
            </div>
            {currentTimeframeData.predictedPrice > prediction.currentPrice ? (
              <TrendingUp className="w-8 h-8 text-green-500" />
            ) : (
              <TrendingDown className="w-8 h-8 text-red-500" />
            )}
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <p className="text-gray-400 text-xs">Confidence</p>
              <p className="text-white text-xs font-semibold">{(currentTimeframeData.confidence ?? 0).toFixed(0)}%</p>
            </div>
            <div className="h-2 bg-gray-700 rounded overflow-hidden">
              <div
                className="h-full bg-blue-500"
                style={{ width: `${Math.min(currentTimeframeData.confidence ?? 0, 100)}%` }}
              ></div>
            </div>
          </div>

          <p className="text-green-400 text-sm font-semibold">
            Potential Return: {(currentTimeframeData.percentChange ?? 0) >= 0 ? '+' : ''}{(currentTimeframeData.percentChange ?? 0).toFixed(2)}%
          </p>
        </div>
      )}

      {/* Sentiment Bars */}
      <div className="space-y-2">
        <p className="text-white text-sm font-semibold">Sentiment Indicators</p>
        {[
          { label: 'Overall', value: prediction.sentiment.overall },
          { label: 'News', value: prediction.sentiment.news },
          { label: 'Social', value: prediction.sentiment.social },
          { label: 'Technical', value: prediction.sentiment.technical },
        ].map(({ label, value }) => (
          <div key={label}>
            <div className="flex justify-between mb-1">
              <p className="text-gray-400 text-xs">{label}</p>
              <p className="text-white text-xs">{((value ?? 0) * 100).toFixed(0)}%</p>
            </div>
            <div className="h-2 bg-gray-700 rounded overflow-hidden">
              <div
                className={`h-full ${getSentimentColor(value ?? 0)}`}
                style={{ width: `${Math.min(Math.abs((value ?? 0) * 100), 100)}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* Key Factors */}
      <div className="space-y-2">
        <p className="text-white text-sm font-semibold">Key Factors</p>
        <ul className="space-y-1">
          {prediction.keyFactors.slice(0, 3).map((factor, idx) => (
            <li key={idx} className="text-gray-400 text-xs flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span>{factor}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Reasoning */}
      <button
        onClick={() => setShowReasoning(!showReasoning)}
        className="w-full flex items-center justify-between py-2 px-3 bg-gray-700 hover:bg-gray-600 rounded transition text-gray-300 text-sm font-semibold"
      >
        <span>View Reasoning</span>
        <ChevronDown
          className={`w-4 h-4 transition ${showReasoning ? 'rotate-180' : ''}`}
        />
      </button>

      {showReasoning && (
        <div className="bg-gray-900 rounded p-3">
          <p className="text-gray-300 text-sm leading-relaxed">{prediction.reasoning}</p>
        </div>
      )}
    </div>
  );
}
