import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface PriceResult {
  price: number;
  currency: string;
  marketState: string;
}

function normalizeForGoogle(ticker: string): { symbol: string; exchange: string } | null {
  const ksMatch = ticker.match(/^(\d{6})(\.KS)?$/);
  if (ksMatch) return { symbol: ksMatch[1], exchange: "KRX" };

  const kqMatch = ticker.match(/^(\d{6})\.KQ$/);
  if (kqMatch) return { symbol: kqMatch[1], exchange: "KOSDAQ" };

  if (/^[A-Z]{1,5}$/.test(ticker)) return { symbol: ticker, exchange: "NASDAQ" };

  return null;
}

async function fetchFromGoogleFinance(ticker: string): Promise<PriceResult | null> {
  const normalized = normalizeForGoogle(ticker);
  if (!normalized) return null;

  const exchanges = [normalized.exchange];
  if (normalized.exchange === "NASDAQ") exchanges.push("NYSE");

  for (const exchange of exchanges) {
    try {
      const url = `https://www.google.com/finance/quote/${normalized.symbol}:${exchange}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) continue;
      const html = await response.text();

      const priceMatch = html.match(/class="YMlKec fxKbKc"[^>]*>([\d,\.]+)/);
      if (!priceMatch) continue;

      const price = parseFloat(priceMatch[1].replace(/,/g, ""));
      if (isNaN(price) || price <= 0) continue;

      const currency =
        exchange === "KRX" || exchange === "KOSDAQ" ? "KRW" : "USD";

      return { price, currency, marketState: "REGULAR" };
    } catch {
      continue;
    }
  }

  return null;
}

async function fetchFromYahooFinance(ticker: string): Promise<PriceResult | null> {
  let normalized = ticker;
  if (/^\d{6}$/.test(ticker)) normalized = `${ticker}.KS`;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(normalized)}?interval=1m&range=1d`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number;
            currency?: string;
            marketState?: string;
          };
        }>;
      };
    };
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    return {
      price: meta.regularMarketPrice ?? 0,
      currency: meta.currency ?? "KRW",
      marketState: meta.marketState ?? "CLOSED",
    };
  } catch {
    return null;
  }
}

router.get("/price/:ticker", async (req, res) => {
  const raw = req.params.ticker;

  try {
    const googleResult = await fetchFromGoogleFinance(raw);
    if (googleResult && googleResult.price > 0) {
      res.json(googleResult);
      return;
    }

    const yahooResult = await fetchFromYahooFinance(raw);
    if (yahooResult && yahooResult.price > 0) {
      res.json(yahooResult);
      return;
    }

    res.status(404).json({ error: "Price not found" });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch price" });
  }
});

export default router;
