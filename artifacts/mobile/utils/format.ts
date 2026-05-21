export function normalizeDate(input: string): string {
  if (!input) return input;
  const s = input.trim().replace(/[./]/g, "-");
  const year = new Date().getFullYear();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;

  const md = s.match(/^(\d{1,2})-(\d{1,2})$/);
  if (md) return `${year}-${md[1].padStart(2, "0")}-${md[2].padStart(2, "0")}`;

  const mmdd = s.match(/^(\d{2})(\d{2})$/);
  if (mmdd) return `${year}-${mmdd[1]}-${mmdd[2]}`;

  return input;
}

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

const TICKER_COLORS = [
  "#6699FF", "#00D26A", "#FF9500", "#AF52DE", "#FF6B6B",
  "#00C9A7", "#FFD93D", "#4FC3F7", "#F06292", "#81C784",
  "#FFB74D", "#BA68C8", "#4DD0E1", "#AED581", "#FF8A65",
];

export function tickerColor(ticker: string): string {
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) hash = (hash * 31 + ticker.charCodeAt(i)) >>> 0;
  return TICKER_COLORS[hash % TICKER_COLORS.length];
}
