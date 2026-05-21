import { Router, type IRouter } from "express";

const router: IRouter = Router();

function normalizeYahooTicker(ticker: string): string {
  if (/^\d{6}$/.test(ticker)) return `${ticker}.KS`;
  if (/^\d{6}\.KQ$/.test(ticker)) return ticker;
  if (/^\d{6}\.KS$/.test(ticker)) return ticker;
  return ticker;
}

router.get("/chart/:ticker", async (req, res) => {
  const { ticker } = req.params;
  const interval = (req.query.interval as string) || "1d";
  const range = (req.query.range as string) || "3mo";

  const normalized = normalizeYahooTicker(ticker);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(normalized)}?interval=${interval}&range=${range}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      res.status(502).json({ error: "Failed to fetch chart data" });
      return;
    }

    const data = (await response.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          meta?: { currency?: string };
          indicators?: { quote?: Array<{ open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }> };
        }>;
      };
    };

    const result = data?.chart?.result?.[0];
    if (!result) {
      res.status(404).json({ error: "No chart data found" });
      return;
    }

    const timestamps: number[] = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0];
    if (!quote) {
      res.status(404).json({ error: "No quote data" });
      return;
    }

    const isDailyOrWeekly = ["1d", "1wk", "1mo"].includes(interval);

    const candles = timestamps
      .map((ts, i) => {
        const open = quote.open?.[i];
        const high = quote.high?.[i];
        const low = quote.low?.[i];
        const close = quote.close?.[i];
        if (open == null || close == null || high == null || low == null) return null;
        const time = isDailyOrWeekly
          ? new Date(ts * 1000).toISOString().slice(0, 10)
          : ts;
        return { time, open, high, low, close };
      })
      .filter(Boolean);

    res.json({ candles, currency: result.meta?.currency ?? "KRW" });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
