import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  type Account,
  type StrategyTag,
  type Trade,
  type TradeEntry,
  type TradeExit,
  DEFAULT_ACCOUNTS,
  normalizeTrades,
} from "../domain/trades";
import {
  createCloudCode,
  fetchCloudSnapshot,
  pushCloudSnapshot,
} from "../lib/cloud-sync";
import {
  exportBackup as downloadBackup,
  exportExcelTemplate as downloadExcelTemplate,
  importFromExcel as readExcelTrades,
  readBackup,
} from "../lib/file-transfer";

const TRADES_KEY = "@trading_journal_trades";
const ACCOUNTS_KEY = "@trading_journal_accounts";
const SYNC_CODE_KEY = "@sync_code";
const LAST_PUSHED_AT_KEY = "@last_pushed_at";
const DAY_MS = 24 * 60 * 60 * 1000;

export type SyncStatus = "idle" | "syncing" | "error" | "ok";

interface TradesContextValue {
  trades: Trade[];
  accounts: Account[];
  loading: boolean;
  syncCode: string | null;
  syncStatus: SyncStatus;
  connectSync: (code: string, forceOverwrite?: boolean) => Promise<"ok" | "error" | "empty_cloud">;
  disconnectSync: () => void;
  createSync: () => Promise<string>;
  addTrade: (ticker: string, name: string, date: string, accountId: string) => Trade;
  addEntry: (tradeId: string, price: number, quantity: number, date?: string) => void;
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
  exportBackup: () => void;
  importBackup: (file: File) => Promise<number>;
  importFromExcel: (file: File) => Promise<{ imported: number; skipped: number }>;
  exportExcelTemplate: () => Promise<void>;
  clearAllData: () => void;
}

const TradesContext = createContext<TradesContextValue | null>(null);

function generateId(): string {
  return `${Date.now()}${Math.random().toString(36).slice(2, 11)}`;
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Unable to save ${key} in browser storage`, error);
  }
}

function setStoredString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error(`Unable to save ${key} in browser storage`, error);
  }
}

function removeStored(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Unable to remove ${key} from browser storage`, error);
  }
}

export function TradesProvider({ children }: { children: ReactNode }) {
  const [trades, setTrades] = useState<Trade[]>(() => normalizeTrades(readStored(TRADES_KEY, [])));
  const [accounts, setAccounts] = useState<Account[]>(() => readStored(ACCOUNTS_KEY, DEFAULT_ACCOUNTS));
  const [syncCode, setSyncCode] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SYNC_CODE_KEY);
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      return Boolean(localStorage.getItem(SYNC_CODE_KEY));
    } catch {
      return false;
    }
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => syncCode ? "syncing" : "idle");
  const syncCodeRef = useRef(syncCode);
  const latestTradesRef = useRef(trades);
  const latestAccountsRef = useRef(accounts);
  const isDirtyRef = useRef(false);
  const lastCloudUpdatedAtRef = useRef(0);
  const loadedCodeRef = useRef<string | null>(null);
  const skipNextPushRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);

  useEffect(() => {
    latestTradesRef.current = trades;
    writeStored(TRADES_KEY, trades);
  }, [trades]);

  useEffect(() => {
    latestAccountsRef.current = accounts;
    writeStored(ACCOUNTS_KEY, accounts);
  }, [accounts]);

  useEffect(() => {
    syncCodeRef.current = syncCode;
  }, [syncCode]);

  useEffect(() => {
    if (!syncCode) {
      setLoading(false);
      setSyncStatus("idle");
      return;
    }
    if (loadedCodeRef.current === syncCode) return;
    loadedCodeRef.current = syncCode;
    let cancelled = false;
    setLoading(true);
    setSyncStatus("syncing");

    const hydrate = async () => {
      const localTrades = latestTradesRef.current;
      const localAccounts = latestAccountsRef.current;
      const snapshot = await fetchCloudSnapshot(syncCode);
      if (cancelled) return;

      if (!snapshot) {
        setSyncStatus("error");
        setLoading(false);
        return;
      }

      const cloudUpdatedAt = snapshot.updatedAt ? new Date(snapshot.updatedAt).getTime() : 0;
      lastCloudUpdatedAtRef.current = Number.isFinite(cloudUpdatedAt) ? cloudUpdatedAt : 0;
      const localPushedAt = Number(localStorage.getItem(LAST_PUSHED_AT_KEY) ?? 0);

      if (localPushedAt > cloudUpdatedAt + 1000 && localTrades.length > 0) {
        isDirtyRef.current = true;
      } else {
        skipNextPushRef.current = true;
        setTrades(normalizeTrades(snapshot.trades));
        setAccounts(snapshot.accounts.length > 0 ? snapshot.accounts : localAccounts);
      }

      setSyncStatus("ok");
      setLoading(false);
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [syncCode]);

  const pushLatest = useCallback(async (retryDelay = 0) => {
    const code = syncCodeRef.current;
    if (!code) return;
    setSyncStatus("syncing");
    const ok = await pushCloudSnapshot(code, latestTradesRef.current, latestAccountsRef.current);
    if (ok) {
      isDirtyRef.current = false;
      lastCloudUpdatedAtRef.current = Date.now();
      setSyncStatus("ok");
      return;
    }
    setSyncStatus("error");
    if (retryDelay > 0 && retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
    }
    if (retryDelay > 0 && retryDelay <= 30_000) {
      retryTimerRef.current = window.setTimeout(
        () => void pushLatest(30_000),
        retryDelay,
      );
    }
  }, []);

  useEffect(() => {
    if (loading || !syncCode) return;
    if (skipNextPushRef.current) {
      skipNextPushRef.current = false;
      return;
    }
    isDirtyRef.current = true;
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
    const timer = window.setTimeout(() => void pushLatest(10_000), 1500);
    return () => window.clearTimeout(timer);
  }, [trades, accounts, syncCode, loading, pushLatest]);

  useEffect(() => {
    if (!syncCode || loading) return;
    const refreshFromCloud = async () => {
      if (isDirtyRef.current) return;
      const snapshot = await fetchCloudSnapshot(syncCode);
      if (!snapshot) {
        setSyncStatus("error");
        return;
      }
      const updatedAt = new Date(snapshot.updatedAt).getTime();
      if (Number.isFinite(updatedAt) && updatedAt > lastCloudUpdatedAtRef.current) {
        skipNextPushRef.current = true;
        lastCloudUpdatedAtRef.current = updatedAt;
        setTrades(normalizeTrades(snapshot.trades));
        if (snapshot.accounts.length > 0) setAccounts(snapshot.accounts);
      }
      setSyncStatus("ok");
    };

    const interval = window.setInterval(() => void refreshFromCloud(), 60_000);
    window.addEventListener("focus", refreshFromCloud);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshFromCloud);
    };
  }, [syncCode, loading]);

  const connectSync = useCallback(async (
    code: string,
    forceOverwrite = false,
  ): Promise<"ok" | "error" | "empty_cloud"> => {
    const upper = code.trim().toUpperCase();
    if (!upper) return "error";
    setSyncStatus("syncing");
    try {
      const snapshot = await fetchCloudSnapshot(upper);
      if (!snapshot) {
        setSyncStatus("error");
        return "error";
      }
      const cloudTrades = normalizeTrades(snapshot.trades);
      const cloudAccounts = snapshot.accounts.length > 0 ? snapshot.accounts : DEFAULT_ACCOUNTS;

      if (!forceOverwrite && cloudTrades.length === 0 && latestTradesRef.current.length > 0) {
        setSyncStatus("idle");
        return "empty_cloud";
      }

      if (forceOverwrite && cloudTrades.length === 0) {
        setStoredString(SYNC_CODE_KEY, upper);
        syncCodeRef.current = upper;
        loadedCodeRef.current = upper;
        setSyncCode(upper);
        const ok = await pushCloudSnapshot(upper, latestTradesRef.current, latestAccountsRef.current);
        setSyncStatus(ok ? "ok" : "error");
        return ok ? "ok" : "error";
      }

      skipNextPushRef.current = true;
      setTrades(cloudTrades);
      setAccounts(cloudAccounts);
      setStoredString(SYNC_CODE_KEY, upper);
      syncCodeRef.current = upper;
      loadedCodeRef.current = upper;
      setSyncCode(upper);
      lastCloudUpdatedAtRef.current = new Date(snapshot.updatedAt).getTime() || 0;
      setSyncStatus("ok");
      return "ok";
    } catch {
      setSyncStatus("error");
      return "error";
    }
  }, []);

  const disconnectSync = useCallback(() => {
    removeStored(SYNC_CODE_KEY);
    syncCodeRef.current = null;
    loadedCodeRef.current = null;
    setSyncCode(null);
    setSyncStatus("idle");
  }, []);

  const createSync = useCallback(async (): Promise<string> => {
    setSyncStatus("syncing");
    try {
      const code = await createCloudCode();
      const ok = await pushCloudSnapshot(code, latestTradesRef.current, latestAccountsRef.current);
      if (!ok) throw new Error("매매 기록을 서버에 저장하지 못했습니다.");
      setStoredString(SYNC_CODE_KEY, code);
      syncCodeRef.current = code;
      loadedCodeRef.current = code;
      lastCloudUpdatedAtRef.current = Date.now();
      setSyncCode(code);
      setSyncStatus("ok");
      return code;
    } catch (error) {
      setSyncStatus("error");
      throw error;
    }
  }, []);

  const addTrade = useCallback((ticker: string, name: string, date: string, accountId: string): Trade => {
    const trade: Trade = {
      id: generateId(),
      ticker,
      name,
      date,
      accountId,
      entries: [],
      exits: [],
      notes: "",
      tags: [],
      createdAt: Date.now(),
    };
    setTrades((previous) => [trade, ...previous]);
    return trade;
  }, []);

  const addEntry = useCallback((tradeId: string, price: number, quantity: number, date?: string) => {
    const timestamp = date === undefined ? Date.now() : Date.parse(`${date}T00:00:00.000Z`);
    if (!Number.isFinite(timestamp)) return;
    setTrades((previous) => previous.map((trade) => trade.id === tradeId
      ? { ...trade, entries: [...trade.entries, { id: generateId(), price, quantity, timestamp }] }
      : trade));
  }, []);

  const addExit = useCallback((tradeId: string, price: number, quantity: number, date: string) => {
    const timestamp = Date.now();
    setTrades((previous) => previous.map((trade) => trade.id === tradeId
      ? { ...trade, exits: [...trade.exits, { id: generateId(), price, quantity, timestamp, date }] }
      : trade));
  }, []);

  const updateEntry = useCallback((
    tradeId: string,
    entryId: string,
    price: number,
    quantity: number,
    timestamp?: number,
  ) => {
    setTrades((previous) => previous.map((trade) => trade.id === tradeId
      ? {
        ...trade,
        entries: trade.entries.map((entry) => {
          if (entry.id !== entryId) return entry;
          if (timestamp === undefined) return { ...entry, price, quantity };
          const timeOffset = ((entry.timestamp % DAY_MS) + DAY_MS) % DAY_MS;
          return { ...entry, price, quantity, timestamp: timestamp + timeOffset };
        }),
      }
      : trade));
  }, []);

  const updateExit = useCallback((
    tradeId: string,
    exitId: string,
    price: number,
    quantity: number,
    date: string,
  ) => {
    setTrades((previous) => previous.map((trade) => trade.id === tradeId
      ? {
        ...trade,
        exits: trade.exits.map((exit) => exit.id === exitId
          ? { ...exit, price, quantity, date }
          : exit),
      }
      : trade));
  }, []);

  const updateNotes = useCallback((tradeId: string, notes: string) => {
    setTrades((previous) => previous.map((trade) => trade.id === tradeId ? { ...trade, notes } : trade));
  }, []);

  const updateTags = useCallback((tradeId: string, tags: StrategyTag[]) => {
    setTrades((previous) => previous.map((trade) => trade.id === tradeId ? { ...trade, tags } : trade));
  }, []);

  const deleteTrade = useCallback((tradeId: string) => {
    setTrades((previous) => previous.filter((trade) => trade.id !== tradeId));
  }, []);

  const deleteEntry = useCallback((tradeId: string, entryId: string) => {
    setTrades((previous) => previous.map((trade) => trade.id === tradeId
      ? { ...trade, entries: trade.entries.filter((entry) => entry.id !== entryId) }
      : trade));
  }, []);

  const deleteExit = useCallback((tradeId: string, exitId: string) => {
    setTrades((previous) => previous.map((trade) => trade.id === tradeId
      ? { ...trade, exits: trade.exits.filter((exit) => exit.id !== exitId) }
      : trade));
  }, []);

  const addAccount = useCallback((name: string) => {
    setAccounts((previous) => [...previous, { id: generateId(), name }]);
  }, []);

  const updateAccount = useCallback((id: string, name: string) => {
    setAccounts((previous) => previous.map((account) => account.id === id ? { ...account, name } : account));
  }, []);

  const deleteAccount = useCallback((id: string) => {
    setAccounts((previous) => previous.filter((account) => account.id !== id));
  }, []);

  const reorderAccounts = useCallback((fromIndex: number, toIndex: number) => {
    setAccounts((previous) => {
      if (toIndex < 0 || toIndex >= previous.length || fromIndex < 0 || fromIndex >= previous.length) {
        return previous;
      }
      const reordered = [...previous];
      const [account] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, account);
      return reordered;
    });
  }, []);

  const exportBackup = useCallback(() => {
    downloadBackup(latestTradesRef.current, latestAccountsRef.current);
  }, []);

  const importBackup = useCallback(async (file: File) => {
    const backup = await readBackup(file);
    setTrades(backup.trades);
    setAccounts(backup.accounts);
    return backup.trades.length;
  }, []);

  const importFromExcel = useCallback(async (file: File) => {
    const imported = await readExcelTrades(file, latestTradesRef.current, latestAccountsRef.current);
    setTrades(imported.trades);
    setAccounts(imported.accounts);
    return { imported: imported.imported, skipped: imported.skipped };
  }, []);

  const exportExcelTemplate = useCallback(() => downloadExcelTemplate(), []);

  const clearAllData = useCallback(() => {
    setTrades([]);
    setAccounts(DEFAULT_ACCOUNTS);
  }, []);

  return (
    <TradesContext.Provider value={{
      trades,
      accounts,
      loading,
      syncCode,
      syncStatus,
      connectSync,
      disconnectSync,
      createSync,
      addTrade,
      addEntry,
      addExit,
      updateEntry,
      updateExit,
      updateNotes,
      updateTags,
      deleteTrade,
      deleteEntry,
      deleteExit,
      addAccount,
      updateAccount,
      deleteAccount,
      reorderAccounts,
      exportBackup,
      importBackup,
      importFromExcel,
      exportExcelTemplate,
      clearAllData,
    }}>
      {children}
    </TradesContext.Provider>
  );
}

export function useTrades(): TradesContextValue {
  const context = useContext(TradesContext);
  if (!context) throw new Error("useTrades must be used within TradesProvider");
  return context;
}

export type { Account, Trade, TradeEntry, TradeExit, StrategyTag };