import type { Trade } from "../domain/trades";
import { calcTradeResult } from "../domain/trades";

export function TradeChart({ trade }: { trade: Trade }) {
  const result = calcTradeResult(trade);
  const events = [...trade.exits].sort((a, b) => a.date.localeCompare(b.date) || a.timestamp - b.timestamp);
  if (!events.length) return <div className="chart-empty">매도 기록이 쌓이면 실현 손익 흐름이 여기에 그려집니다.</div>;
  const exitMap = new Map(result.exitResults.map((item) => [item.exitId, item]));
  let cumulative = 0;
  const points = events.map((exit) => {
    cumulative += exitMap.get(exit.id)?.realizedPnL ?? 0;
    return { date: exit.date, value: cumulative };
  });
  const values = [0, ...points.map((point) => point.value)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (index: number) => 4 + (index / Math.max(1, points.length)) * 92;
  const y = (value: number) => 90 - ((value - min) / span) * 78;
  const plotted = [`${x(0)},${y(0)}`, ...points.map((point, index) => `${x(index + 1)},${y(point.value)}`)].join(" ");
  const area = `4,90 ${plotted} ${x(points.length)},90`;
  return <div className="chart-wrap" data-testid="chart-realized-pnl">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="매도 기록별 누적 실현 손익 그래프">
      <defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#6699ff" stopOpacity=".22" /><stop offset="1" stopColor="#6699ff" stopOpacity="0" /></linearGradient></defs>
      {[18, 42, 66, 90].map((row) => <line key={row} x1="0" x2="100" y1={row} y2={row} className="chart-grid" />)}
      <polygon points={area} className="chart-area" /><polyline points={plotted} className="chart-line" />
    </svg>
  </div>;
}