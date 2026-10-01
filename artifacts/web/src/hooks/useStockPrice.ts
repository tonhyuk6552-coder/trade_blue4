import { useQuery } from "@tanstack/react-query";

export interface StockPrice {
  price: number;
  currency: string;
  marketState: string;
}

export async function fetchStockPrice(ticker: string): Promise<StockPrice | null> {
  try {
    const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
    const response = await fetch(`${base}/api/price/${encodeURIComponent(ticker)}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    return await response.json() as StockPrice;
  } catch {
    return null;
  }
}

export function useStockPrice(ticker: string | undefined) {
  return useQuery({
    queryKey: ["stockPrice", ticker],
    queryFn: () => fetchStockPrice(ticker!),
    enabled: Boolean(ticker),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });
}