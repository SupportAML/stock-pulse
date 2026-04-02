import http from "http";
import https from "https";
import type {
  MarketPrediction,
  MarketQuote,
  TechnicalAnalysis,
  OHLCV,
} from "./types";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b";

// Exported so the API route can include it in the response
export { OLLAMA_MODEL };

/**
 * Calls Ollama using Node's native http/https module.
 *
 * WHY NOT fetch():
 *   Next.js 16 (App Router + Turbopack) patches the global fetch() and
 *   propagates the incoming HTTP request's AbortSignal to every outbound
 *   fetch() call made inside a route handler.  When the browser finishes
 *   reading the response headers (or navigates away) Next.js cancels that
 *   signal → our long-running Ollama request gets aborted after only a few
 *   seconds, no matter how long the timeout we set.
 *
 *   Node's http.request() is completely outside that patching layer and is
 *   never cancelled by Next.js request lifecycle events.
 */
function _doOllamaRequest(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 600,  // shorter output = faster response
        num_ctx: 2048,     // explicit KV-cache size — prevents OOM on large models
      },
    });

    const parsedUrl = new URL(`${OLLAMA_URL}/api/generate`);
    const isHttps = parsedUrl.protocol === "https:";
    const transport = isHttps ? https : http;

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port
        ? Number(parsedUrl.port)
        : isHttps ? 443 : 80,
      path: parsedUrl.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    // 3-minute hard timeout — fires even if the socket is still open
    const timer = setTimeout(() => {
      req.destroy(new Error(`Ollama timed out after 3 minutes (model: ${OLLAMA_MODEL})`));
    }, 180_000);

    const req = transport.request(reqOptions, (res) => {
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => { raw += chunk; });
      res.on("end", () => {
        clearTimeout(timer);

        if (res.statusCode !== 200) {
          // Extract the actual Ollama error message from the response body
          let errMsg = raw;
          try { errMsg = (JSON.parse(raw) as { error?: string }).error ?? raw; } catch { /* keep raw */ }

          if (res.statusCode === 404) {
            reject(new Error(
              `Ollama model "${OLLAMA_MODEL}" not found. Run: ollama pull ${OLLAMA_MODEL}`
            ));
          } else {
            reject(new Error(`Ollama ${res.statusCode}: ${errMsg}`));
          }
          return;
        }

        try {
          const parsed = JSON.parse(raw) as { response?: string };
          resolve(parsed.response ?? "");
        } catch {
          reject(new Error("Failed to parse Ollama JSON response"));
        }
      });
    });

    req.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (err.code === "ECONNREFUSED") {
        reject(new Error(`Ollama not reachable at ${OLLAMA_URL}. Is it running?`));
      } else {
        reject(err);
      }
    });

    req.write(body);
    req.end();
  });
}

async function callOllama(prompt: string): Promise<string> {
  try {
    return await _doOllamaRequest(prompt);
  } catch (firstErr) {
    const msg = String(firstErr);
    // Retry once on 500 (model cold-start / temporary OOM) or connection refused
    if (msg.includes("500") || msg.includes("ECONNREFUSED")) {
      console.warn(`Ollama first attempt failed (${msg.slice(0, 80)}) — retrying in 5s…`);
      await new Promise((res) => setTimeout(res, 5_000));
      return await _doOllamaRequest(prompt);
    }
    throw firstErr;
  }
}

export async function generatePredictions(
  _symbols: string[],
  quotes: MarketQuote[],
  technicals: Record<string, TechnicalAnalysis>,
  historicalBars: Map<string, Promise<OHLCV[]>>
): Promise<MarketPrediction> {
  // Cap at 5 symbols to keep the prompt within num_ctx=2048 comfortably
  const MAX_SYMBOLS = 5;
  const topQuotes = quotes.slice(0, MAX_SYMBOLS);
  const technicalArray = Object.values(technicals).slice(0, MAX_SYMBOLS);

  const quoteContext = topQuotes
    .map(
      (q) =>
        `${q.symbol}:$${(q.price ?? 0).toFixed(2)}(${(q.changePercent ?? 0) > 0 ? "+" : ""}${(q.changePercent ?? 0).toFixed(2)}%)`
    )
    .join(", ");

  const technicalContext = technicalArray
    .map((t) => `${t.symbol}:${t.overallSignal}(${t.overallScore})`)
    .join(", ");

  let historicalContext = "";
  try {
    const historicalEntries = await Promise.all(
      Array.from(historicalBars.entries())
        .slice(0, MAX_SYMBOLS)
        .map(async ([symbol, barsPromise]) => {
          const bars = await barsPromise;
          if (bars.length === 0) return "";
          const recent = bars.slice(-3); // 3 closes is enough context
          const closes = recent.map((b) => (b.close ?? 0).toFixed(2)).join(",");
          const trend =
            bars[bars.length - 1].close > bars[0].close ? "up" : "down";
          return `${symbol}:[${closes}]${trend}`;
        })
    );
    historicalContext = historicalEntries.filter((x) => x).join(", ");
  } catch {
    historicalContext = "N/A";
  }

  const prompt = `You are a stock analyst. Respond ONLY with valid JSON, no markdown.

Quotes: ${quoteContext}
Technicals: ${technicalContext}
Recent closes: ${historicalContext}

Return this JSON (use real prices from Quotes above):
{"predictions":[{"symbol":"AAPL","currentPrice":150.00,"predictions":[{"timeframe":"1d","predictedPrice":152.00,"confidence":65,"direction":"up","percentChange":1.3}],"reasoning":"brief","riskLevel":"medium","sentiment":{"overall":0.6,"news":0.5,"social":0.5,"technical":0.7},"keyFactors":["factor"]}],"marketOverview":"brief summary","topOpportunities":[{"symbol":"AAPL","name":"Apple Inc","action":"buy","confidence":70,"entryPrice":150.00,"targetPrice":155.00,"stopLoss":147.00,"riskRewardRatio":1.7,"reasoning":"brief","timeframe":"1d","potentialReturn":3.3}],"warnings":[]}`;

  try {
    const text = await callOllama(prompt);

    let parsed: MarketPrediction;
    try {
      // Try direct parse first
      parsed = JSON.parse(text);
    } catch {
      // Extract JSON object from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in Ollama response");
      }
    }

    // Cap confidence at 85%
    if (parsed.predictions) {
      parsed.predictions = parsed.predictions.map((p) => ({
        ...p,
        predictions: (p.predictions ?? []).map((pred) => ({
          ...pred,
          confidence: Math.min(85, pred.confidence ?? 50),
        })),
      }));
    }
    if (parsed.topOpportunities) {
      parsed.topOpportunities = parsed.topOpportunities.map((opp) => ({
        ...opp,
        confidence: Math.min(85, opp.confidence ?? 50),
      }));
    }

    parsed.generatedAt = Date.now();
    return parsed;
  } catch (error) {
    console.error("Ollama prediction error:", error);

    // Graceful fallback — uses real quote prices so the UI still renders
    return {
      predictions: quotes.map((q) => ({
        symbol: q.symbol,
        currentPrice: q.price ?? 0,
        predictions: [
          {
            timeframe: "1d" as const,
            predictedPrice: (q.price ?? 0) * 1.01,
            confidence: 30,
            direction: "up" as const,
            percentChange: 1,
          },
        ],
        reasoning: "Ollama unavailable — algorithmic fallback",
        riskLevel: "high" as const,
        sentiment: { overall: 0.5, news: 0.5, social: 0.5, technical: 0.5 },
        keyFactors: ["AI inference unavailable"],
        timestamp: Date.now(),
      })),
      marketOverview: "AI predictions temporarily unavailable. Showing algorithmic fallback data.",
      topOpportunities: [],
      warnings: [
        `Ollama model "${OLLAMA_MODEL}" unavailable. ` +
        `Ensure Ollama is running (ollama serve) and the model is pulled (ollama pull ${OLLAMA_MODEL}).`
      ],
      generatedAt: Date.now(),
    };
  }
}
