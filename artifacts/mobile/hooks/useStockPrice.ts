import { useQuery } from "@tanstack/react-query";
import { Platform } from "react-native";

interface PriceResult {
  price: number;
  currency: string;
  marketState: string;
}

function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return process.env.EXPO_PUBLIC_API_URL ?? "";
}

function normalizeForGoogle(ticker: string): { symbol: string; exchange: string } | null {
  const ksMatch = ticker.match(/^(\d{6})(\.KS)?$/);
  if (ksMatch) return { symbol: ksMatch[1], exchange: "KRX" };

  const kqMatch = ticker.match(/^(\d{6})\.KQ$/);
  if (kqMatch) return { symbol: kqMatch[1], exchange: "KOSDAQ" };

  if (/^[A-Z]{1,5}$/.test(ticker)) return { symbol: ticker, exchange: "NASDAQ" };

  return null;
}

async function fetchFromGoogleFinanceNative(ticker: string): Promise<PriceResult | null> {
  const normalized = normalizeForGoogle(ticker);
  if (!normalized) return null;

  const exchanges = [normalized.exchange];
  if (normalized.exchange === "NASDAQ") exchanges.push("NYSE");

  for (const exchange of exchanges) {
    try {
      const url = `https://www.google.com/finance/quote/${normalized.symbol}:${exchange}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      if (!res.ok) continue;

      const html = await res.text();
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

async function fetchFromYahooFinanceNative(ticker: string): Promise<PriceResult | null> {
  let normalized = ticker;
  if (/^\d{6}$/.test(ticker)) normalized = `${ticker}.KS`;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(normalized)}?interval=1m&range=1d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const data = await res.json();
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

export async function fetchStockPrice(symbol: string): Promise<PriceResult | null> {
  try {
    if (Platform.OS === "web") {
      const res = await fetch(`${getApiBase()}/api/price/${encodeURIComponent(symbol)}`);
      if (!res.ok) return null;
      return res.json() as Promise<PriceResult>;
    }

    const googleResult = await fetchFromGoogleFinanceNative(symbol);
    if (googleResult && googleResult.price > 0) return googleResult;

    return fetchFromYahooFinanceNative(symbol);
  } catch {
    return null;
  }
}

export function useStockPrice(ticker: string | undefined) {
  return useQuery({
    queryKey: ["stockPrice", ticker],
    queryFn: () => fetchStockPrice(ticker!),
    enabled: !!ticker,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });
}
