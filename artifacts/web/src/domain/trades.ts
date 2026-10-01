export interface Account {
  id: string;
  name: string;
}

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: "acc1", name: "계좌1" },
  { id: "acc2", name: "계좌2" },
];

export const STRATEGY_TAGS = [
  "추세추종", "눌림목", "돌파", "역추세",
  "갭매매", "스윙", "단타", "손절복기", "기타",
] as const;

export type StrategyTag = typeof STRATEGY_TAGS[number];

export interface TradeEntry {
  id: string;
  price: number;
  quantity: number;
  timestamp: number;
}

export interface TradeExit {
  id: string;
  price: number;
  quantity: number;
  timestamp: number;
  date: string;
}

export interface Trade {
  id: string;
  ticker: string;
  name: string;
  date: string;
  accountId: string;
  entries: TradeEntry[];
  exits: TradeExit[];
  notes: string;
  tags: StrategyTag[];
  createdAt: number;
}

export interface TradeExitResult {
  exitId: string;
  avgBuy: number;
  realizedPnL: number;
  remainingQty: number;
}

export interface TradeResult {
  avgBuy: number;
  avgSell: number;
  totalBought: number;
  totalSold: number;
  remainingQty: number;
  realizedPnL: number;
  roi: number;
  isOpen: boolean;
  exitResults: TradeExitResult[];
}

function getTradeDate(timestamp: number, date?: string): string {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Date(timestamp).toISOString().slice(0, 10);
}

function getGeneratedAt(id: string): number | null {
  const match = id.match(/^\d{13}/);
  if (!match) return null;
  const timestamp = Number(match[0]);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function calcTradeResult(trade: Trade): TradeResult {
  type TradeEvent =
    | { kind: "buy"; timestamp: number; date: string; createdAt: number | null; index: number; price: number; quantity: number }
    | { kind: "sell"; timestamp: number; date: string; createdAt: number | null; index: number; exit: TradeExit };

  const events: TradeEvent[] = [
    ...trade.entries.map((entry, index) => {
      const timestamp = Number.isFinite(entry.timestamp) ? entry.timestamp : 0;
      return {
        kind: "buy" as const,
        timestamp,
        date: getTradeDate(timestamp),
        createdAt: getGeneratedAt(entry.id),
        index,
        price: entry.price,
        quantity: entry.quantity,
      };
    }),
    ...trade.exits.map((exit, index) => {
      const timestamp = Number.isFinite(exit.timestamp) ? exit.timestamp : 0;
      return {
        kind: "sell" as const,
        timestamp,
        date: getTradeDate(timestamp, exit.date),
        createdAt: getGeneratedAt(exit.id),
        index,
        exit,
      };
    }),
  ].sort((a, b) => {
    const dateDifference = a.date.localeCompare(b.date);
    if (dateDifference !== 0) return dateDifference;
    if (a.createdAt !== null && b.createdAt !== null && a.createdAt !== b.createdAt) {
      return a.createdAt - b.createdAt;
    }
    const timestampDifference = a.timestamp - b.timestamp;
    if (timestampDifference !== 0) return timestampDifference;
    if (a.kind !== b.kind) return a.kind === "buy" ? -1 : 1;
    return a.index - b.index;
  });

  let totalBought = 0;
  let totalSold = 0;
  let remainingQty = 0;
  let remainingCost = 0;
  let realizedPnL = 0;
  let realizedCost = 0;
  let totalSellCost = 0;
  const exitResults: TradeExitResult[] = [];

  for (const event of events) {
    if (event.kind === "buy") {
      totalBought += event.quantity;
      remainingQty += event.quantity;
      remainingCost += event.price * event.quantity;
      continue;
    }

    totalSold += event.exit.quantity;
    totalSellCost += event.exit.price * event.exit.quantity;
    const averageCost = remainingQty > 0 ? remainingCost / remainingQty : 0;
    const matchedQuantity = Math.min(event.exit.quantity, remainingQty);
    const costBasis = averageCost * matchedQuantity;
    const exitPnL = (event.exit.price - averageCost) * matchedQuantity;
    remainingQty -= matchedQuantity;
    remainingCost = Math.max(0, remainingCost - costBasis);
    realizedCost += costBasis;
    realizedPnL += exitPnL;
    exitResults.push({
      exitId: event.exit.id,
      avgBuy: averageCost,
      realizedPnL: exitPnL,
      remainingQty,
    });
  }

  const avgBuy = remainingQty > 0 ? remainingCost / remainingQty : 0;
  const avgSell = totalSold > 0 ? totalSellCost / totalSold : 0;
  const roi = realizedCost > 0 ? (realizedPnL / realizedCost) * 100 : 0;

  return {
    avgBuy,
    avgSell,
    totalBought,
    totalSold,
    remainingQty,
    realizedPnL,
    roi,
    isOpen: remainingQty > 0,
    exitResults,
  };
}

export function normalizeTrades(raw: Trade[]): Trade[] {
  return raw.map((trade) => ({
    ...trade,
    name: trade.name ?? trade.ticker,
    date: normalizeTradeDate(trade.date),
    tags: trade.tags ?? [],
    accountId: trade.accountId ?? "acc1",
    entries: trade.entries ?? [],
    exits: (trade.exits ?? []).map((exit) => ({
      ...exit,
      date: exit.date ?? new Date(exit.timestamp).toISOString().slice(0, 10),
    })),
    notes: trade.notes ?? "",
  }));
}

export function normalizeTradeDate(input: string): string {
  if (!input) return input;
  const value = input.trim().replace(/[./]/g, "-");
  const year = new Date().getFullYear();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const ymd = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  const md = value.match(/^(\d{1,2})-(\d{1,2})$/);
  if (md) return `${year}-${md[1].padStart(2, "0")}-${md[2].padStart(2, "0")}`;
  const mmdd = value.match(/^(\d{2})(\d{2})$/);
  if (mmdd) return `${year}-${mmdd[1]}-${mmdd[2]}`;
  return input;
}

export function parseTradeDate(input: string): string | null {
  const normalized = normalizeTradeDate(input);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;

  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day) {
    return null;
  }
  return normalized;
}