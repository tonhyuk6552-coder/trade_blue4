import {
  type Account,
  type Trade,
  calcTradeResult,
  normalizeTradeDate,
  normalizeTrades,
  DEFAULT_ACCOUNTS,
} from "../domain/trades";

interface BackupData {
  version: number;
  exportedAt: string;
  trades: Trade[];
  accounts: Account[];
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function generateId(): string {
  return `${Date.now()}${Math.random().toString(36).slice(2, 11)}`;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportBackup(trades: Trade[], accounts: Account[]): void {
  const date = new Date();
  const backup: BackupData = {
    version: 1,
    exportedAt: date.toISOString(),
    trades,
    accounts,
  };
  downloadBlob(
    new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
    `trading_journal_backup_${date.toISOString().slice(0, 10)}.json`,
  );
}

export async function readBackup(file: File): Promise<{ trades: Trade[]; accounts: Account[] }> {
  const parsed = JSON.parse(await file.text()) as Partial<BackupData>;
  if (!Array.isArray(parsed.trades)) {
    throw new Error("올바른 백업 파일이 아닙니다.");
  }
  return {
    trades: normalizeTrades(parsed.trades),
    accounts: Array.isArray(parsed.accounts) && parsed.accounts.length > 0
      ? parsed.accounts
      : DEFAULT_ACCOUNTS,
  };
}

export async function exportExcelTemplate(): Promise<void> {
  const XLSX = await import("xlsx");
  const rows = [
    ["포지션번호", "날짜", "종목코드", "종목명", "구분", "가격", "수량", "계좌명"],
    [1, "2026-05-08", "005930", "삼성전자", "매수", 75000, 10, "계좌1"],
    [1, "2026-05-09", "005930", "삼성전자", "매수", 74000, 5, "계좌1"],
    [1, "2026-05-12", "005930", "삼성전자", "매도", 78000, 8, "계좌1"],
    [2, "2026-05-12", "NVDA", "엔비디아", "매수", 950, 2, "계좌2"],
    [3, "2026-05-14", "035720", "카카오", "매수", 43000, 20, "계좌1"],
    [3, "2026-05-15", "035720", "카카오", "매도", 45000, 20, "계좌1"],
  ];
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 },
    { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(workbook, sheet, "매매기록");
  const output = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  downloadBlob(new Blob([output], { type: XLSX_MIME }), "매매일지_양식.xlsx");
}

function serialToDate(serial: number): string {
  const date = new Date((serial - 25569) * 86400 * 1000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function cellToDate(raw: unknown): string {
  if (typeof raw === "number") {
    return raw > 20000 && raw < 200000 ? serialToDate(raw) : "";
  }
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const mdy4 = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy4) return `${mdy4[3]}-${mdy4[1].padStart(2, "0")}-${mdy4[2].padStart(2, "0")}`;
  const mdy2 = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (mdy2) {
    const year = Number(mdy2[3]);
    return `${year < 50 ? 2000 + year : 1900 + year}-${mdy2[1].padStart(2, "0")}-${mdy2[2].padStart(2, "0")}`;
  }
  const ymd = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  if (/^\d+$/.test(value)) {
    const serial = Number(value);
    if (serial > 20000 && serial < 200000) return serialToDate(serial);
  }
  return normalizeTradeDate(value);
}

function cellNumber(raw: unknown): number {
  return typeof raw === "number"
    ? raw
    : Number.parseFloat(String(raw ?? "").replace(/,/g, ""));
}

function normalizePositionNumber(raw: unknown): string {
  if (typeof raw === "number") return String(Math.round(raw));
  const value = String(raw ?? "").trim();
  const number = Number.parseFloat(value);
  return Number.isNaN(number) ? value : String(Math.round(number));
}

export async function importFromExcel(
  file: File,
  currentTrades: Trade[],
  currentAccounts: Account[],
): Promise<{ trades: Trade[]; accounts: Account[]; imported: number; skipped: number }> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error("워크시트가 없습니다.");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, raw: true });
  if (rows.length < 2) throw new Error("데이터가 없습니다. 양식을 확인해주세요.");

  const accounts = [...currentAccounts];
  if (accounts.length === 0) accounts.push(...DEFAULT_ACCOUNTS);
  const findOrCreateAccount = (rawName: string): Account => {
    const name = rawName.trim();
    if (!name) return accounts[0];
    const exact = accounts.find((account) => account.name === name);
    if (exact) return exact;
    const loose = accounts.find((account) => account.name.trim().toLowerCase() === name.toLowerCase());
    if (loose) return loose;
    const account = { id: generateId(), name };
    accounts.push(account);
    return account;
  };

  const headers = rows[0].map((cell) => String(cell ?? "").trim());
  const columns = {
    positionNo: headers.indexOf("포지션번호"),
    date: headers.indexOf("날짜"),
    ticker: headers.indexOf("종목코드"),
    name: headers.indexOf("종목명"),
    direction: headers.indexOf("구분"),
    price: headers.indexOf("가격"),
    quantity: headers.indexOf("수량"),
    account: headers.indexOf("계좌명"),
  };
  if ([columns.date, columns.direction, columns.price, columns.quantity].some((column) => column < 0)) {
    throw new Error("올바른 양식 파일이 아닙니다. '날짜', '구분', '가격', '수량' 열이 필요합니다.");
  }

  const trades = currentTrades.map((trade) => ({
    ...trade,
    entries: [...trade.entries],
    exits: [...trade.exits],
  }));
  let imported = 0;
  let skipped = 0;
  const hasPositionNo = columns.positionNo >= 0;
  const positionMap = new Map<string, Trade>();

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row || row.every((cell) => cell === null || cell === undefined || cell === "")) continue;
    const date = cellToDate(row[columns.date]);
    const direction = String(row[columns.direction] ?? "").trim();
    const price = cellNumber(row[columns.price]);
    const quantity = cellNumber(row[columns.quantity]);
    const tickerCell = columns.ticker >= 0 ? String(row[columns.ticker] ?? "").trim() : "";
    const nameCell = columns.name >= 0 ? String(row[columns.name] ?? "").trim() : tickerCell;
    const accountName = columns.account >= 0 ? String(row[columns.account] ?? "") : "";
    const isBuy = direction === "매수";
    const isSell = direction === "매도";
    const positionNo = hasPositionNo ? normalizePositionNumber(row[columns.positionNo]) : "";

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || (!isBuy && !isSell)
      || !Number.isFinite(price) || !Number.isFinite(quantity) || price <= 0 || quantity <= 0
      || (hasPositionNo && !positionNo)) {
      skipped += 1;
      continue;
    }

    const ticker = tickerCell || nameCell.toUpperCase() || "UNKNOWN";
    const name = nameCell || ticker;
    const account = findOrCreateAccount(accountName);
    const timestamp = (Date.parse(`${date}T00:00:00.000Z`) || Date.now()) + index;

    if (isBuy) {
      let trade: Trade | undefined;
      if (hasPositionNo) {
        trade = positionMap.get(positionNo);
        if (!trade) {
          trade = {
            id: generateId(), ticker, name, date, accountId: account.id,
            entries: [], exits: [], notes: "", tags: [], createdAt: timestamp,
          };
          positionMap.set(positionNo, trade);
          trades.push(trade);
        }
      } else {
        trade = {
          id: generateId(), ticker, name, date, accountId: account.id,
          entries: [], exits: [], notes: "", tags: [], createdAt: timestamp,
        };
        trades.push(trade);
      }
      trade.entries.push({ id: generateId(), price, quantity, timestamp });
      imported += 1;
      continue;
    }

    const openTrade = hasPositionNo
      ? positionMap.get(positionNo)
      : trades.find((trade) => trade.ticker === ticker
        && trade.accountId === account.id
        && calcTradeResult(trade).isOpen);
    if (openTrade) {
      openTrade.exits.push({ id: generateId(), price, quantity, timestamp, date });
      imported += 1;
    } else {
      skipped += 1;
    }
  }

  return { trades: normalizeTrades(trades), accounts, imported, skipped };
}