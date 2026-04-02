'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { DashboardNav } from '@/components/markets/DashboardNav';
import { useMarketStream } from '@/hooks/useMarketStream';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'ws://localhost:8080';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

// ─── Suggested questions ──────────────────────────────────────────────────────

const SUGGESTIONS = [
  'What does RSI above 70 mean?',
  'Explain MACD crossover signals',
  'What is a good risk/reward ratio?',
  'Should I use stop-loss orders?',
  'Explain Bollinger Bands squeeze',
  'What is paper trading?',
  'How do I read a candlestick chart?',
  'What factors affect stock prices?',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-end gap-3">
      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">AI</div>
      <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-sm px-5 py-3.5">
        <div className="flex gap-1.5 items-center h-4">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  const time = new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div className={`flex items-end gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
        isUser ? 'bg-gray-700 text-gray-300' : 'bg-blue-600 text-white'
      }`}>
        {isUser ? 'U' : 'AI'}
      </div>
      <div className="flex flex-col gap-1 max-w-[75%]">
        <div className={`rounded-2xl px-5 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-gray-800 border border-gray-700 text-gray-100 rounded-bl-sm'
        }`}>
          {msg.content}
        </div>
        <span className={`text-[10px] text-gray-600 px-1 ${isUser ? 'text-right' : ''}`}>{time}</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLTextAreaElement>(null);

  const { prices, signals } = useMarketStream(GATEWAY_URL);

  const buildContext = useCallback((): string | undefined => {
    const lines: string[] = [];
    if (prices.size > 0) {
      const priceLines = [...prices.entries()].slice(0, 8)
        .map(([sym, d]) => `${sym}: $${d.price.toFixed(2)}`);
      lines.push(`Live prices: ${priceLines.join(', ')}`);
    }
    if (signals.size > 0) {
      const sigLines = [...signals.entries()].slice(0, 5)
        .map(([sym, s]) => `${sym}: ${s.action} (${s.confidence}% confidence)`);
      lines.push(`Current signals: ${sigLines.join(', ')}`);
    }
    return lines.length > 0 ? lines.join('\n') : undefined;
  }, [prices, signals]);

  // Welcome message on mount
  useEffect(() => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm StockPulse AI Advisor, powered by Ollama. I have access to your live market prices and trading signals.\n\nAsk me anything about markets, stocks, crypto, technical indicators, or trading strategies — I'm here to help you learn and make better paper trading decisions.",
      ts: Date.now(),
    }]);
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: trimmed, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const history = messages
      .filter(m => m.id !== 'welcome')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    try {
      const res = await fetch('/api/markets/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history, context: buildContext() }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || "Sorry, I couldn't generate a response. Please try again.",
        ts: Date.now(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Connection error — make sure Ollama is running and try again.",
        ts: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, buildContext]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      <DashboardNav />
      <main className="min-h-screen bg-gray-950 flex flex-col">
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col flex-1" style={{ height: 'calc(100vh - 64px)' }}>

          {/* Header */}
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                AI Chat Advisor
                <span className="text-xs font-normal px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full">
                  Ollama · qwen2.5:7b
                </span>
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">
                Ask about markets, signals, strategies, or any trading concept
              </p>
            </div>
            <button
              onClick={() => {
                setMessages([{
                  id: 'welcome',
                  role: 'assistant',
                  content: "Chat cleared! What would you like to discuss?",
                  ts: Date.now(),
                }]);
              }}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              Clear chat
            </button>
          </div>

          {/* Live context indicator */}
          {(prices.size > 0 || signals.size > 0) && (
            <div className="mb-4 flex items-center gap-2 text-xs text-gray-500 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live context active — {prices.size} prices, {signals.size} signals feeding the AI
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-5 pb-4">
            {messages.map(msg => <ChatBubble key={msg.id} msg={msg} />)}
            {loading && <TypingDots />}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && !loading && (
            <div className="flex flex-wrap gap-2 mb-4 flex-shrink-0">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-700 text-gray-400 hover:text-white hover:border-blue-500 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex-shrink-0 bg-gray-900 border border-gray-700 rounded-2xl p-3">
            <div className="flex items-end gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about markets, signals, trading strategies… (Enter to send)"
                rows={1}
                disabled={loading}
                className="flex-1 resize-none bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none leading-relaxed max-h-32"
                style={{ height: 'auto' }}
                onInput={e => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="p-2.5 rounded-xl bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-500 transition-colors flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-gray-600 mt-2">
              For educational purposes only · Not financial advice · Shift+Enter for new line
            </p>
          </div>

        </div>
      </main>
    </>
  );
}
