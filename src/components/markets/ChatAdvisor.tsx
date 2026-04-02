'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
  'Explain MACD in simple terms',
  'What is a stop-loss and why use it?',
  'Is now a good time to buy AAPL?',
  'What is risk/reward ratio?',
  'Explain Bollinger Bands',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-white">AI</span>
      </div>
      <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
        isUser ? 'bg-gray-700 text-gray-300' : 'bg-blue-600 text-white'
      }`}>
        {isUser ? 'U' : 'AI'}
      </div>
      {/* Bubble */}
      <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? 'bg-blue-600 text-white rounded-br-sm'
          : 'bg-gray-800 border border-gray-700 text-gray-100 rounded-bl-sm'
      }`}>
        {msg.content}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChatAdvisor() {
  const [open, setOpen]         = useState(false);
  const [input, setInput]       = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading]   = useState(false);
  const [unread, setUnread]     = useState(0);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);

  // Pull live market context from gateway to enrich AI answers
  const { prices, signals } = useMarketStream(GATEWAY_URL);

  // Build a concise market context string from live data
  const buildContext = useCallback((): string | undefined => {
    const lines: string[] = [];
    if (prices.size > 0) {
      const priceLines = [...prices.entries()]
        .slice(0, 6)
        .map(([sym, d]) => `${sym}: $${d.price.toFixed(2)}`);
      lines.push(`Live prices: ${priceLines.join(', ')}`);
    }
    if (signals.size > 0) {
      const sigLines = [...signals.entries()]
        .slice(0, 4)
        .map(([sym, s]) => `${sym}: ${s.action} (${s.confidence}% confidence)`);
      lines.push(`Current signals: ${sigLines.join(', ')}`);
    }
    return lines.length > 0 ? lines.join('\n') : undefined;
  }, [prices, signals]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setUnread(0);
    }
  }, [open]);

  // Welcome message on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: "Hi! I'm your StockPulse AI Advisor. Ask me anything about markets, stocks, crypto, technical indicators, or your trading signals. How can I help?",
        ts: Date.now(),
      }]);
    }
  }, [open, messages.length]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: trimmed, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Build history for API (exclude welcome message from history)
    const history = messages
      .filter(m => m.id !== 'welcome')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    try {
      const res = await fetch('/api/markets/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history,
          context: buildContext(),
        }),
      });

      const data = await res.json();
      const reply = data.reply || "Sorry, I couldn't generate a response. Please try again.";

      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: reply, ts: Date.now() };
      setMessages(prev => [...prev, aiMsg]);

      if (!open) setUnread(n => n + 1);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting right now. Make sure Ollama is running and try again.",
        ts: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, buildContext, open]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setUnread(0);
  };

  return (
    <>
      {/* ── Chat Panel ─────────────────────────────────────────────────────── */}
      {open && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-50 w-[min(380px,calc(100vw-2rem))] flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-gray-700 bg-gray-900">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m1.636 6.364l.707-.707M12 20v1M7.05 7.05L6.343 6.343M16.95 7.05l.707-.707" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">AI Advisor</p>
                <p className="text-[10px] text-gray-500">Ollama · qwen2.5:7b</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                title="Clear chat"
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[420px] min-h-[280px]">
            {messages.map(msg => <ChatBubble key={msg.id} msg={msg} />)}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions (shown only when just welcome message) */}
          {messages.length <= 1 && !loading && (
            <div className="px-4 pb-2 flex gap-2 flex-wrap">
              {SUGGESTIONS.slice(0, 3).map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-xs px-2.5 py-1 rounded-full border border-gray-700 text-gray-400 hover:text-white hover:border-blue-500 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-gray-700 bg-gray-800/50">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about markets, signals, strategies…"
                rows={1}
                className="flex-1 resize-none bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors max-h-24 leading-relaxed"
                style={{ height: 'auto' }}
                onInput={e => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
                }}
                disabled={loading}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="p-2.5 rounded-xl bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-500 transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-gray-600 mt-1.5 text-center">
              Educational only · Not financial advice · Enter to send
            </p>
          </div>
        </div>
      )}

      {/* ── FAB Button ─────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-4 right-4 sm:right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          open
            ? 'bg-gray-700 hover:bg-gray-600 rotate-0'
            : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/30'
        }`}
        aria-label="Open AI Advisor"
      >
        {open ? (
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <>
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">
                {unread}
              </span>
            )}
          </>
        )}
      </button>
    </>
  );
}
