import type { Account, Trade } from "../domain/trades";

export interface CloudSnapshot {
  trades: Trade[];
  accounts: Account[];
  updatedAt: string;
}

function apiUrl(path: string): string {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}${path}`;
}

export async function fetchCloudSnapshot(code: string): Promise<CloudSnapshot | null> {
  try {
    const response = await fetch(apiUrl(`/api/sync/${encodeURIComponent(code)}`), {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const snapshot = await response.json() as CloudSnapshot;
    if (!Array.isArray(snapshot.trades) || !Array.isArray(snapshot.accounts)) return null;
    return snapshot;
  } catch {
    return null;
  }
}

export async function pushCloudSnapshot(
  code: string,
  trades: Trade[],
  accounts: Account[],
): Promise<boolean> {
  try {
    const response = await fetch(apiUrl(`/api/sync/${encodeURIComponent(code)}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trades, accounts }),
    });
    if (!response.ok) return false;
    localStorage.setItem("@last_pushed_at", Date.now().toString());
    return true;
  } catch {
    return false;
  }
}

export async function createCloudCode(): Promise<string> {
  const response = await fetch(apiUrl("/api/sync/new"), { method: "POST" });
  if (!response.ok) throw new Error("동기화 코드를 만들지 못했습니다.");
  const data = await response.json() as { code?: string };
  if (!data.code) throw new Error("서버에서 동기화 코드를 받지 못했습니다.");
  return data.code;
}