const TICKER_COLORS = [
  "#6699FF", "#00D26A", "#FF9500", "#AF52DE", "#FF6B6B",
  "#00C9A7", "#FFD93D", "#4FC3F7", "#F06292", "#81C784",
  "#FFB74D", "#BA68C8", "#4DD0E1", "#AED581", "#FF8A65",
];

export function formatKRW(value: number): string {
  return Math.round(value).toLocaleString("ko-KR");
}

export function formatKRWSign(value: number): string {
  const rounded = Math.round(value);
  const abs = Math.abs(rounded).toLocaleString("ko-KR");
  return rounded >= 0 ? `+${abs}` : `-${abs}`;
}

export function formatPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function tickerColor(ticker: string): string {
  let hash = 0;
  for (let index = 0; index < ticker.length; index += 1) {
    hash = (hash * 31 + ticker.charCodeAt(index)) >>> 0;
  }
  return TICKER_COLORS[hash % TICKER_COLORS.length];
}

export function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}