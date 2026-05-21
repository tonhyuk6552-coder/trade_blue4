import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import * as XLSX from "xlsx";

import { normalizeDate } from "@/utils/format";

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

export interface TradeResult {
  avgBuy: number;
  avgSell: number;
  totalBought: number;
  totalSold: number;
  remainingQty: number;
  realizedPnL: number;
  roi: number;
  isOpen: boolean;
}

export function calcTradeResult(trade: Trade): TradeResult {
  const totalBought = trade.entries.reduce((sum, e) => sum + e.quantity, 0);
  const totalSold = trade.exits.reduce((sum, e) => sum + e.quantity, 0);
  const totalBuyCost = trade.entries.reduce((sum, e) => sum + e.price * e.quantity, 0);
  const totalSellCost = trade.exits.reduce((sum, e) => sum + e.price * e.quantity, 0);

  const avgBuy = totalBought > 0 ? totalBuyCost / totalBought : 0;
  const avgSell = totalSold > 0 ? totalSellCost / totalSold : 0;
  const remainingQty = totalBought - totalSold;
  const realizedPnL = (avgSell - avgBuy) * totalSold;
  const roi = avgBuy > 0 && totalSold > 0 ? ((avgSell - avgBuy) / avgBuy) * 100 : 0;

  return { avgBuy, avgSell, totalBought, totalSold, remainingQty, realizedPnL, roi, isOpen: remainingQty > 0 };
}

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const TRADES_KEY = "@trading_journal_trades";
const ACCOUNTS_KEY = "@trading_journal_accounts";
const SYNC_CODE_KEY = "@sync_code";
const LAST_PUSHED_AT_KEY = "@last_pushed_at";

function getApiBase(): string {
  // Explicit API URL takes priority (for native apps)
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (apiUrl) return apiUrl;

  // On web, use the main shared-proxy domain (not the Expo subdomain)
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;

  // Last-resort fallback
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}

async function cloudFetch(code: string) {
  try {
    const res = await fetch(`${getApiBase()}/api/sync/${code}`);
    if (!res.ok) return null;
    return res.json() as Promise<{ trades: Trade[]; accounts: Account[]; updatedAt: string }>;
  } catch { return null; }
}

async function cloudPush(code: string, trades: Trade[], accounts: Account[]): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBase()}/api/sync/${code}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trades, accounts }),
    });
    if (res.ok) {
      await AsyncStorage.setItem(LAST_PUSHED_AT_KEY, Date.now().toString());
      return true;
    }
    return false;
  } catch { return false; }
}

async function cloudCreate(trades: Trade[], accounts: Account[]): Promise<string> {
  const res = await fetch(`${getApiBase()}/api/sync/new`, { method: "POST" });
  if (!res.ok) throw new Error("서버 오류");
  const { code } = await res.json() as { code: string };
  await cloudPush(code, trades, accounts);
  return code;
}

interface BackupData {
  version: number;
  exportedAt: string;
  trades: Trade[];
  accounts: Account[];
}

interface TradesContextValue {
  trades: Trade[];
  accounts: Account[];
  loading: boolean;
  syncCode: string | null;
  syncStatus: "idle" | "syncing" | "error" | "ok";
  connectSync: (code: string, forceOverwrite?: boolean) => Promise<"ok" | "error" | "empty_cloud">;
  disconnectSync: () => Promise<void>;
  createSync: () => Promise<string>;
  addTrade: (ticker: string, name: string, date: string, accountId: string) => Trade;
  addEntry: (tradeId: string, price: number, quantity: number) => void;
  addExit: (tradeId: string, price: number, quantity: number, date: string) => void;
  updateEntry: (tradeId: string, entryId: string, price: number, quantity: number, timestamp?: number) => void;
  updateExit: (tradeId: string, exitId: string, price: number, quantity: number, date: string) => void;
  updateNotes: (tradeId: string, notes: string) => void;
  updateTags: (tradeId: string, tags: StrategyTag[]) => void;
  deleteTrade: (tradeId: string) => void;
  deleteEntry: (tradeId: string, entryId: string) => void;
  deleteExit: (tradeId: string, exitId: string) => void;
  addAccount: (name: string) => void;
  updateAccount: (id: string, name: string) => void;
  deleteAccount: (id: string) => void;
  reorderAccounts: (fromIndex: number, toIndex: number) => void;
  exportBackup: () => Promise<void>;
  importBackup: () => Promise<void>;
  importFromExcel: () => Promise<{ imported: number; skipped: number } | null>;
  exportExcelTemplate: () => Promise<void>;
}

const TradesContext = createContext<TradesContextValue | null>(null);

function backfillExit(e: TradeExit): TradeExit {
  return { ...e, date: e.date ?? new Date(e.timestamp).toISOString().split("T")[0] };
}

function normalizeTrades(raw: Trade[]): Trade[] {
  return raw.map((t) => ({
    ...t,
    name: t.name ?? t.ticker,
    date: normalizeDate(t.date),
    tags: t.tags ?? [],
    accountId: t.accountId ?? "acc1",
    exits: (t.exits ?? []).map(backfillExit),
  }));
}

export function TradesProvider({ children }: { children: React.ReactNode }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<Account[]>(DEFAULT_ACCOUNTS);
  const [loading, setLoading] = useState(true);
  const [syncCode, setSyncCode] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error" | "ok">("idle");
  const syncCodeRef = useRef<string | null>(null);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);
  const latestTradesRef = useRef<Trade[]>([]);
  const latestAccountsRef = useRef<Account[]>(DEFAULT_ACCOUNTS);

  useEffect(() => { latestTradesRef.current = trades; }, [trades]);
  useEffect(() => { latestAccountsRef.current = accounts; }, [accounts]);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(TRADES_KEY),
      AsyncStorage.getItem(ACCOUNTS_KEY),
      AsyncStorage.getItem(SYNC_CODE_KEY),
      AsyncStorage.getItem(LAST_PUSHED_AT_KEY),
    ]).then(async ([rawTrades, rawAccounts, storedCode, storedLastPushedAt]) => {
      let localTrades: Trade[] = [];
      let localAccounts: Account[] = DEFAULT_ACCOUNTS;
      if (rawAccounts) {
        try { localAccounts = JSON.parse(rawAccounts); } catch {}
      }
      if (rawTrades) {
        try { localTrades = normalizeTrades(JSON.parse(rawTrades)); } catch {}
      }
      if (storedCode) {
        syncCodeRef.current = storedCode;
        setSyncCode(storedCode);
        setSyncStatus("syncing");
        const data = await cloudFetch(storedCode);
        if (data) {
          const cloudUpdatedAt = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
          const localPushedAt = storedLastPushedAt ? parseInt(storedLastPushedAt, 10) : 0;
          // 로컬이 더 최신이면 (오프라인 작업) → 로컬을 클라우드에 push
          if (localPushedAt > cloudUpdatedAt && localTrades.length > 0) {
            await cloudPush(storedCode, localTrades, localAccounts);
            setTrades(localTrades);
            setAccounts(localAccounts);
          } else {
            const ct = normalizeTrades(data.trades ?? []);
            const ca: Account[] = (data.accounts ?? []).length > 0 ? data.accounts : localAccounts;
            setTrades(ct);
            setAccounts(ca);
            await AsyncStorage.setItem(TRADES_KEY, JSON.stringify(ct));
            await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(ca));
          }
          setSyncStatus("ok");
        } else {
          setTrades(localTrades);
          setAccounts(localAccounts);
          setSyncStatus("error");
        }
      } else {
        setTrades(localTrades);
        setAccounts(localAccounts);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!syncCode || loading) return;
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    isDirtyRef.current = true;
    pushTimerRef.current = setTimeout(async () => {
      if (!syncCodeRef.current) return;
      setSyncStatus("syncing");
      const ok = await cloudPush(syncCodeRef.current, latestTradesRef.current, latestAccountsRef.current);
      if (ok) {
        isDirtyRef.current = false;
        setSyncStatus("ok");
      } else {
        setSyncStatus("error");
        // 재시도: 10초 후 1회, 실패 시 30초 후 다시 시도
        const scheduleRetry = (delayMs: number) => {
          retryTimerRef.current = setTimeout(async () => {
            if (!isDirtyRef.current || !syncCodeRef.current) return;
            setSyncStatus("syncing");
            const retryOk = await cloudPush(syncCodeRef.current, latestTradesRef.current, latestAccountsRef.current);
            if (retryOk) {
              isDirtyRef.current = false;
              setSyncStatus("ok");
            } else {
              setSyncStatus("error");
              if (delayMs < 60_000) scheduleRetry(30_000);
            }
          }, delayMs);
        };
        scheduleRetry(10_000);
      }
    }, 1500);
    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [trades, accounts, syncCode, loading]);

  const connectSync = useCallback(async (code: string, forceOverwrite = false): Promise<"ok" | "error" | "empty_cloud"> => {
    const upper = code.trim().toUpperCase();
    setSyncStatus("syncing");
    try {
      const data = await cloudFetch(upper);
      if (!data) { setSyncStatus("error"); return "error"; }
      const ct = normalizeTrades(data.trades ?? []);
      const ca: Account[] = (data.accounts ?? []).length > 0 ? data.accounts : DEFAULT_ACCOUNTS;

      // 클라우드가 비어있고 로컬에 데이터가 있으면 덮어쓰기 전에 경고
      if (!forceOverwrite && ct.length === 0 && latestTradesRef.current.length > 0) {
        setSyncStatus("idle");
        return "empty_cloud";
      }

      if (forceOverwrite && ct.length === 0) {
        // 로컬 데이터를 이 코드에 업로드
        await AsyncStorage.setItem(SYNC_CODE_KEY, upper);
        syncCodeRef.current = upper;
        setSyncCode(upper);
        await cloudPush(upper, latestTradesRef.current, latestAccountsRef.current);
        setSyncStatus("ok");
        return "ok";
      }

      setTrades(ct);
      setAccounts(ca);
      await AsyncStorage.setItem(TRADES_KEY, JSON.stringify(ct));
      await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(ca));
      await AsyncStorage.setItem(SYNC_CODE_KEY, upper);
      syncCodeRef.current = upper;
      setSyncCode(upper);
      setSyncStatus("ok");
      return "ok";
    } catch { setSyncStatus("error"); return "error"; }
  }, []);

  const disconnectSync = useCallback(async () => {
    await AsyncStorage.removeItem(SYNC_CODE_KEY);
    syncCodeRef.current = null;
    setSyncCode(null);
    setSyncStatus("idle");
  }, []);

  const createSync = useCallback(async (): Promise<string> => {
    setSyncStatus("syncing");
    try {
      const code = await cloudCreate(trades, accounts);
      await AsyncStorage.setItem(SYNC_CODE_KEY, code);
      syncCodeRef.current = code;
      setSyncCode(code);
      setSyncStatus("ok");
      return code;
    } catch (e) {
      setSyncStatus("error");
      throw e;
    }
  }, [trades, accounts]);

  const saveAccounts = (updated: Account[]) => {
    setAccounts(updated);
    AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updated));
  };

  const addTrade = useCallback((ticker: string, name: string, date: string, accountId: string): Trade => {
    const trade: Trade = {
      id: generateId(), ticker, name, date, accountId,
      entries: [], exits: [], notes: "", tags: [], createdAt: Date.now(),
    };
    setTrades((prev) => {
      const updated = [trade, ...prev];
      AsyncStorage.setItem(TRADES_KEY, JSON.stringify(updated));
      return updated;
    });
    return trade;
  }, []);

  const addEntry = useCallback((tradeId: string, price: number, quantity: number) => {
    setTrades((prev) => {
      const updated = prev.map((t) =>
        t.id === tradeId
          ? { ...t, entries: [...t.entries, { id: generateId(), price, quantity, timestamp: Date.now() }] }
          : t
      );
      AsyncStorage.setItem(TRADES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const addExit = useCallback((tradeId: string, price: number, quantity: number, date: string) => {
    setTrades((prev) => {
      const updated = prev.map((t) =>
        t.id === tradeId
          ? { ...t, exits: [...t.exits, { id: generateId(), price, quantity, timestamp: Date.now(), date }] }
          : t
      );
      AsyncStorage.setItem(TRADES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateEntry = useCallback((tradeId: string, entryId: string, price: number, quantity: number, timestamp?: number) => {
    setTrades((prev) => {
      const updated = prev.map((t) =>
        t.id === tradeId
          ? { ...t, entries: t.entries.map((e) => e.id === entryId ? { ...e, price, quantity, ...(timestamp ? { timestamp } : {}) } : e) }
          : t
      );
      AsyncStorage.setItem(TRADES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateExit = useCallback((tradeId: string, exitId: string, price: number, quantity: number, date: string) => {
    setTrades((prev) => {
      const updated = prev.map((t) =>
        t.id === tradeId
          ? { ...t, exits: t.exits.map((e) => e.id === exitId ? { ...e, price, quantity, date } : e) }
          : t
      );
      AsyncStorage.setItem(TRADES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateNotes = useCallback((tradeId: string, notes: string) => {
    setTrades((prev) => {
      const updated = prev.map((t) => (t.id === tradeId ? { ...t, notes } : t));
      AsyncStorage.setItem(TRADES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateTags = useCallback((tradeId: string, tags: StrategyTag[]) => {
    setTrades((prev) => {
      const updated = prev.map((t) => (t.id === tradeId ? { ...t, tags } : t));
      AsyncStorage.setItem(TRADES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const deleteTrade = useCallback((tradeId: string) => {
    setTrades((prev) => {
      const updated = prev.filter((t) => t.id !== tradeId);
      AsyncStorage.setItem(TRADES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const deleteEntry = useCallback((tradeId: string, entryId: string) => {
    setTrades((prev) => {
      const updated = prev.map((t) =>
        t.id === tradeId ? { ...t, entries: t.entries.filter((e) => e.id !== entryId) } : t
      );
      AsyncStorage.setItem(TRADES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const deleteExit = useCallback((tradeId: string, exitId: string) => {
    setTrades((prev) => {
      const updated = prev.map((t) =>
        t.id === tradeId ? { ...t, exits: t.exits.filter((e) => e.id !== exitId) } : t
      );
      AsyncStorage.setItem(TRADES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const addAccount = useCallback((name: string) => {
    setAccounts((prev) => {
      const updated = [...prev, { id: generateId(), name }];
      AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateAccount = useCallback((id: string, name: string) => {
    setAccounts((prev) => {
      const updated = prev.map((a) => (a.id === id ? { ...a, name } : a));
      AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const deleteAccount = useCallback((id: string) => {
    setAccounts((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const reorderAccounts = useCallback((fromIndex: number, toIndex: number) => {
    setAccounts((prev) => {
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const updated = [...prev];
      const [removed] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, removed);
      AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const exportBackup = useCallback(async () => {
    try {
      const currentTrades = await AsyncStorage.getItem(TRADES_KEY);
      const currentAccounts = await AsyncStorage.getItem(ACCOUNTS_KEY);
      const backup: BackupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        trades: currentTrades ? JSON.parse(currentTrades) : [],
        accounts: currentAccounts ? JSON.parse(currentAccounts) : DEFAULT_ACCOUNTS,
      };
      const json = JSON.stringify(backup, null, 2);
      const dateStr = new Date().toISOString().split("T")[0];
      const fileName = `trading_journal_backup_${dateStr}.json`;
      if (Platform.OS === "web") {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = fileName; a.click();
        URL.revokeObjectURL(url);
        Alert.alert("백업 완료", "파일이 다운로드되었습니다.");
        return;
      }
      if (Platform.OS === "android") {
        const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!perm.granted) return;
        const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          perm.directoryUri, fileName, "application/json"
        );
        await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, json, { encoding: "utf8" });
        Alert.alert("백업 완료", `'${fileName}'\n파일이 선택한 폴더에 저장되었습니다.`);
        return;
      }
      const fileUri = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, json, { encoding: "utf8" });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: "application/json", dialogTitle: "매매일지 백업 파일 저장", UTI: "public.json" });
      } else {
        Alert.alert("백업 완료", `파일이 저장되었습니다:\n${fileUri}`);
      }
    } catch {
      Alert.alert("오류", "백업 중 문제가 발생했습니다.");
    }
  }, []);

  const importBackup = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      let json: string;
      if (Platform.OS === "web") {
        const response = await fetch(asset.uri);
        json = await response.text();
      } else {
        json = await FileSystem.readAsStringAsync(asset.uri, { encoding: "utf8" });
      }
      const data: BackupData = JSON.parse(json);
      if (!data.trades || !Array.isArray(data.trades)) {
        Alert.alert("오류", "올바른 백업 파일이 아닙니다.");
        return;
      }
      Alert.alert(
        "백업 불러오기",
        `${data.trades.length}개의 매매 기록을 불러옵니다.\n기존 데이터는 백업 파일의 내용으로 대체됩니다.\n계속하시겠습니까?`,
        [
          { text: "취소", style: "cancel" },
          {
            text: "불러오기", style: "destructive",
            onPress: async () => {
              const normalizedTrades = normalizeTrades(data.trades);
              const normalizedAccounts: Account[] = data.accounts?.length > 0 ? data.accounts : DEFAULT_ACCOUNTS;
              await AsyncStorage.setItem(TRADES_KEY, JSON.stringify(normalizedTrades));
              await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(normalizedAccounts));
              setTrades(normalizedTrades);
              setAccounts(normalizedAccounts);
              Alert.alert("완료", `${normalizedTrades.length}개의 매매 기록을 성공적으로 불러왔습니다.`);
            },
          },
        ]
      );
    } catch {
      Alert.alert("오류", "파일을 불러오는 중 문제가 발생했습니다.\n올바른 백업 파일인지 확인해주세요.");
    }
  }, []);

  const exportExcelTemplate = useCallback(async () => {
    try {
      const headers = ["포지션번호", "날짜", "종목코드", "종목명", "구분", "가격", "수량", "계좌명"];
      const ex1 = [1, "2026-05-08", "005930", "삼성전자", "매수", 75000, 10, "계좌1"];
      const ex2 = [1, "2026-05-09", "005930", "삼성전자", "매수", 74000, 5,  "계좌1"];
      const ex3 = [1, "2026-05-12", "005930", "삼성전자", "매도", 78000, 8,  "계좌1"];
      const ex4 = [2, "2026-05-12", "NVDA",   "엔비디아",  "매수", 950,   2,  "계좌2"];
      const ex5 = [3, "2026-05-14", "035720", "카카오",   "매수", 43000, 20, "계좌1"];
      const ex6 = [3, "2026-05-15", "035720", "카카오",   "매도", 45000, 20, "계좌1"];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ex1, ex2, ex3, ex4, ex5, ex6]);
      ws["!cols"] = [
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 },
        { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 10 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, "매매기록");

      const wbOut = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
      const fileName = "매매일지_양식.xlsx";

      if (Platform.OS === "web") {
        const byteCharacters = atob(wbOut);
        const byteNumbers = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const blob = new Blob([byteNumbers], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = fileName; a.click();
        URL.revokeObjectURL(url);
        Alert.alert("완료", "엑셀 양식 파일이 다운로드되었습니다.");
        return;
      }
      if (Platform.OS === "android") {
        const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!perm.granted) return;
        const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          perm.directoryUri, fileName,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, wbOut, { encoding: "base64" });
        Alert.alert("완료", `'${fileName}'\n파일이 선택한 폴더에 저장되었습니다.`);
        return;
      }
      const fileUri = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, wbOut, { encoding: "base64" });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: "엑셀 양식 저장",
          UTI: "com.microsoft.excel.xlsx",
        });
      } else {
        Alert.alert("완료", `엑셀 양식이 저장되었습니다:\n${fileUri}`);
      }
    } catch {
      Alert.alert("오류", "엑셀 양식 생성 중 문제가 발생했습니다.");
    }
  }, []);

  const importFromExcel = useCallback(async (): Promise<{ imported: number; skipped: number } | null> => {
    try {
      let workbook: XLSX.WorkBook;

      if (Platform.OS === "web") {
        const file = await new Promise<File | null>((resolve) => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";
          let settled = false;
          const settle = (val: File | null) => {
            if (settled) return;
            settled = true;
            resolve(val);
          };
          input.addEventListener("change", () => {
            settle(input.files?.[0] ?? null);
          });
          input.addEventListener("cancel", () => {
            settle(null);
          });
          input.style.display = "none";
          document.body.appendChild(input);
          input.click();
          setTimeout(() => {
            document.body.removeChild(input);
          }, 60000);
        });
        if (!file) return null;
        const arrayBuffer = await file.arrayBuffer();
        workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "*/*"],
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets || result.assets.length === 0) return null;
        const asset = result.assets[0];
        const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: "base64" });
        workbook = XLSX.read(base64, { type: "base64" });
      }

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      // Use raw: true so dates come as Excel serial numbers (integers) rather than
      // locale-formatted strings like "5/8/26" which are ambiguous and hard to parse.
      const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1, raw: true,
      }) as unknown[][];

      if (rows.length < 2) {
        Alert.alert("오류", "데이터가 없습니다. 양식을 확인해주세요.");
        return null;
      }

      const currentAccounts = await AsyncStorage.getItem(ACCOUNTS_KEY);
      const workingAccounts: Account[] = currentAccounts ? JSON.parse(currentAccounts) : [...DEFAULT_ACCOUNTS];

      function findOrCreateAccount(rawName: string): Account {
        const name = rawName.trim();
        if (!name) return workingAccounts[0] ?? DEFAULT_ACCOUNTS[0];
        const exact = workingAccounts.find((a) => a.name === name);
        if (exact) return exact;
        const loose = workingAccounts.find((a) => a.name.trim().toLowerCase() === name.toLowerCase());
        if (loose) return loose;
        const newAcc: Account = { id: generateId(), name };
        workingAccounts.push(newAcc);
        return newAcc;
      }

      // Convert an Excel serial number (days since 1900-01-00) to "YYYY-MM-DD"
      function serialToDate(serial: number): string {
        // Excel serial: 1 = 1900-01-01, adjusted for the spurious 1900 leap year bug
        const d = new Date((serial - 25569) * 86400 * 1000);
        const y = d.getUTCFullYear();
        const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
        const dy = String(d.getUTCDate()).padStart(2, "0");
        return `${y}-${mo}-${dy}`;
      }

      // Convert a raw cell value (number serial or string) to "YYYY-MM-DD"
      function cellToDate(raw: unknown): string {
        if (typeof raw === "number") {
          // Excel date serial (e.g. 46150 → 2026-05-08)
          if (raw > 20000 && raw < 200000) return serialToDate(raw);
          return "";
        }
        const s = String(raw ?? "").trim();
        if (!s) return "";
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        // MM/DD/YYYY
        const mdy4 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (mdy4) return `${mdy4[3]}-${mdy4[1].padStart(2, "0")}-${mdy4[2].padStart(2, "0")}`;
        // MM/DD/YY  (e.g. "5/8/26" → 2026-05-08)
        const mdy2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
        if (mdy2) {
          const yy = parseInt(mdy2[3]);
          const yyyy = yy < 50 ? 2000 + yy : 1900 + yy;
          return `${yyyy}-${mdy2[1].padStart(2, "0")}-${mdy2[2].padStart(2, "0")}`;
        }
        // YYYY/MM/DD
        const ymd = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
        if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
        // Pure integer string → treat as serial
        if (/^\d+$/.test(s)) {
          const n = Number(s);
          if (n > 20000 && n < 200000) return serialToDate(n);
        }
        return normalizeDate(s);
      }

      function normPosNo(raw: unknown): string {
        if (typeof raw === "number") return String(Math.round(raw));
        const trimmed = String(raw ?? "").trim();
        const asNum = parseFloat(trimmed);
        if (!isNaN(asNum)) return String(Math.round(asNum));
        return trimmed;
      }

      const currentTrades = await AsyncStorage.getItem(TRADES_KEY);
      const existingTrades: Trade[] = currentTrades ? JSON.parse(currentTrades) : [];
      const newTrades: Trade[] = [...existingTrades];
      let imported = 0;
      let skipped = 0;

      const headerRow = rows[0].map((h) => String(h ?? "").trim());
      const colIdx = {
        positionNo: headerRow.findIndex((h) => h === "포지션번호"),
        date: headerRow.findIndex((h) => h === "날짜"),
        ticker: headerRow.findIndex((h) => h === "종목코드"),
        name: headerRow.findIndex((h) => h === "종목명"),
        direction: headerRow.findIndex((h) => h === "구분"),
        price: headerRow.findIndex((h) => h === "가격"),
        quantity: headerRow.findIndex((h) => h === "수량"),
        account: headerRow.findIndex((h) => h === "계좌명"),
      };

      if (colIdx.date === -1 || colIdx.price === -1 || colIdx.quantity === -1 || colIdx.direction === -1) {
        Alert.alert("오류", "올바른 양식 파일이 아닙니다.\n'날짜', '구분', '가격', '수량' 열이 필요합니다.");
        return null;
      }

      const hasPositionNo = colIdx.positionNo >= 0;

      if (hasPositionNo) {
        const positionMap = new Map<string, Trade>();
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every((c) => c === null || c === undefined || c === "")) continue;
          const posNo = normPosNo(row[colIdx.positionNo]);
          const date = cellToDate(row[colIdx.date]);
          const directionRaw = String(row[colIdx.direction] ?? "").trim();
          const priceRaw = typeof row[colIdx.price] === "number"
            ? (row[colIdx.price] as number)
            : parseFloat(String(row[colIdx.price] ?? "").replace(/,/g, ""));
          const qtyRaw = typeof row[colIdx.quantity] === "number"
            ? (row[colIdx.quantity] as number)
            : parseFloat(String(row[colIdx.quantity] ?? "").replace(/,/g, ""));
          const tickerRaw = colIdx.ticker >= 0 ? String(row[colIdx.ticker] ?? "").trim() : "";
          const nameRaw = colIdx.name >= 0 ? String(row[colIdx.name] ?? "").trim() : tickerRaw;
          const accountNameRaw = colIdx.account >= 0 ? String(row[colIdx.account] ?? "") : "";
          const isBuy = directionRaw === "매수";
          const isSell = directionRaw === "매도";
          if (!posNo || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || (!isBuy && !isSell) || isNaN(priceRaw) || isNaN(qtyRaw) || priceRaw <= 0 || qtyRaw <= 0) {
            skipped++;
            continue;
          }
          const ticker = tickerRaw || nameRaw.toUpperCase() || "UNKNOWN";
          const name = nameRaw || ticker;
          const account = findOrCreateAccount(accountNameRaw);
          const ts = Date.parse(date) || Date.now();
          if (isBuy) {
            if (!positionMap.has(posNo)) {
              const newTrade: Trade = {
                id: generateId(), ticker, name, date, accountId: account.id,
                entries: [], exits: [], notes: "", tags: [], createdAt: ts,
              };
              positionMap.set(posNo, newTrade);
              newTrades.push(newTrade);
            }
            const trade = positionMap.get(posNo)!;
            trade.entries.push({ id: generateId(), price: priceRaw, quantity: qtyRaw, timestamp: ts });
            imported++;
          } else if (isSell) {
            const trade = positionMap.get(posNo);
            if (trade) {
              trade.exits.push({ id: generateId(), price: priceRaw, quantity: qtyRaw, timestamp: ts, date });
              imported++;
            } else {
              skipped++;
            }
          }
        }
      } else {
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every((c) => c === null || c === undefined || c === "")) continue;
          const date = cellToDate(row[colIdx.date]);
          const directionRaw = String(row[colIdx.direction] ?? "").trim();
          const priceRaw = typeof row[colIdx.price] === "number"
            ? (row[colIdx.price] as number)
            : parseFloat(String(row[colIdx.price] ?? "").replace(/,/g, ""));
          const qtyRaw = typeof row[colIdx.quantity] === "number"
            ? (row[colIdx.quantity] as number)
            : parseFloat(String(row[colIdx.quantity] ?? "").replace(/,/g, ""));
          const tickerRaw = colIdx.ticker >= 0 ? String(row[colIdx.ticker] ?? "").trim() : "";
          const nameRaw = colIdx.name >= 0 ? String(row[colIdx.name] ?? "").trim() : tickerRaw;
          const accountNameRaw = colIdx.account >= 0 ? String(row[colIdx.account] ?? "") : "";
          const isBuy = directionRaw === "매수";
          const isSell = directionRaw === "매도";
          if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || (!isBuy && !isSell) || isNaN(priceRaw) || isNaN(qtyRaw) || priceRaw <= 0 || qtyRaw <= 0) {
            skipped++;
            continue;
          }
          const ticker = tickerRaw || nameRaw.toUpperCase() || "UNKNOWN";
          const name = nameRaw || ticker;
          const account = findOrCreateAccount(accountNameRaw);
          const ts = Date.parse(date) || Date.now();
          if (isBuy) {
            const newTrade: Trade = {
              id: generateId(), ticker, name, date, accountId: account.id,
              entries: [{ id: generateId(), price: priceRaw, quantity: qtyRaw, timestamp: ts }],
              exits: [], notes: "", tags: [], createdAt: ts,
            };
            newTrades.push(newTrade);
            imported++;
          } else if (isSell) {
            const openTrade = newTrades.find((t) =>
              t.ticker === ticker && t.accountId === account.id && calcTradeResult(t).isOpen
            );
            if (openTrade) {
              openTrade.exits.push({ id: generateId(), price: priceRaw, quantity: qtyRaw, timestamp: ts, date });
              imported++;
            } else {
              skipped++;
            }
          }
        }
      }

      await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(workingAccounts));
      await AsyncStorage.setItem(TRADES_KEY, JSON.stringify(newTrades));
      setAccounts(workingAccounts);
      setTrades(normalizeTrades(newTrades));
      return { imported, skipped };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("오류", `엑셀 파일을 읽는 중 문제가 발생했습니다.\n${msg}`);
      return null;
    }
  }, []);

  return (
    <TradesContext.Provider value={{
      trades, accounts, loading,
      syncCode, syncStatus, connectSync, disconnectSync, createSync,
      addTrade, addEntry, addExit, updateEntry, updateExit,
      updateNotes, updateTags,
      deleteTrade, deleteEntry, deleteExit,
      addAccount, updateAccount, deleteAccount, reorderAccounts,
      exportBackup, importBackup,
      exportExcelTemplate, importFromExcel,
    }}>
      {children}
    </TradesContext.Provider>
  );
}

export function useTrades() {
  const ctx = useContext(TradesContext);
  if (!ctx) throw new Error("useTrades must be used within TradesProvider");
  return ctx;
}
