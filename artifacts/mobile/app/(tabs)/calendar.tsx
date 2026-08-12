import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Trade, calcTradeResult, useTrades } from "@/context/TradesContext";
import { useColors } from "@/hooks/useColors";
import { useStockPrice } from "@/hooks/useStockPrice";
import { formatKRW, formatPct, normalizeDate, tickerColor } from "@/utils/format";

const ACCOUNT_COLORS = ["#00D26A", "#6699FF", "#FF9500", "#AF52DE"];

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function CalendarTradeRow({ trade }: { trade: Trade }) {
  const colors = useColors();
  const router = useRouter();
  const result = useMemo(() => calcTradeResult(trade), [trade]);
  const pnlColor = result.realizedPnL >= 0 ? colors.profit : colors.loss;
  const hasPnL = result.totalSold > 0;
  const displayDate = normalizeDate(trade.date);
  const tColor = result.isOpen ? tickerColor(trade.ticker) : colors.mutedForeground;
  const hasRemaining = result.isOpen && result.remainingQty > 0;

  const { data: priceData } = useStockPrice(hasRemaining ? trade.ticker : undefined);
  const unrealizedPnL = priceData?.price && hasRemaining
    ? (priceData.price - result.avgBuy) * result.remainingQty
    : null;
  const unrealizedColor = unrealizedPnL !== null
    ? (unrealizedPnL >= 0 ? colors.profit : colors.loss)
    : colors.mutedForeground;

  return (
    <Pressable
      onPress={() => router.push(`/trade/${trade.id}`)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: result.isOpen ? "#00D26A" : "#6B7280" }]} />
      <View style={[styles.tickerBadge, { backgroundColor: tColor + "18" }]}>
        <Text style={[styles.buyLabel, { color: colors.mutedForeground }]}>평균매수가</Text>
        <Text style={[styles.tickerText, { color: tColor }]} numberOfLines={1} adjustsFontSizeToFit>
          {formatKRW(result.avgBuy)}
        </Text>
      </View>
      <View style={styles.rowMid}>
        <Text style={[styles.rowName, { color: tColor }]} numberOfLines={1}>{trade.name}</Text>
        <Text style={[styles.rowDate, { color: colors.mutedForeground }]}>{displayDate}</Text>
        <View style={styles.rowStats}>
          <Text style={[styles.rowStat, { color: colors.mutedForeground }]}>매수 {result.totalBought}주</Text>
          {result.totalSold > 0 && (
            <Text style={[styles.rowStat, { color: colors.mutedForeground }]}> · 매도 {result.totalSold}주</Text>
          )}
        </View>
        {unrealizedPnL !== null && (
          <View style={[styles.unrealizedPill, { backgroundColor: unrealizedColor + "16" }]}>
            <Text style={[styles.unrealizedText, { color: unrealizedColor }]}>
              미실현 {unrealizedPnL >= 0 ? "+" : ""}{formatKRW(unrealizedPnL)}
              {" "}({priceData?.price ? formatPct(((priceData.price - result.avgBuy) / result.avgBuy) * 100) : ""})
            </Text>
          </View>
        )}
        {(trade.tags ?? []).length > 0 && (
          <View style={styles.rowTags}>
            {(trade.tags ?? []).map((tag) => (
              <View key={tag} style={[styles.rowTagPill, { backgroundColor: colors.primary + "18" }]}>
                <Text style={[styles.rowTagText, { color: colors.primary }]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <View style={styles.rowRight}>
        {hasPnL ? (
          <>
            <Text style={[styles.rowPnL, { color: pnlColor }]}>
              {result.realizedPnL >= 0 ? "+" : "-"}{formatKRW(Math.abs(result.realizedPnL))}
            </Text>
            <Text style={[styles.rowRoi, { color: pnlColor }]}>{formatPct(result.roi)}</Text>
          </>
        ) : (
          <Text style={[styles.rowPnL, { color: colors.mutedForeground }]}>—</Text>
        )}
        <View style={[styles.statusBadge, { backgroundColor: result.isOpen ? colors.primary + "18" : colors.accent }]}>
          <Text style={[styles.statusText, { color: result.isOpen ? colors.primary : colors.mutedForeground }]}>
            {result.isOpen ? "진행 중" : "종료"}
          </Text>
        </View>
      </View>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function CalendarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { trades, accounts } = useTrades();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState<string | null>(null);

  const filteredTrades = useMemo(
    () => accountFilter ? trades.filter((t) => t.accountId === accountFilter) : trades,
    [trades, accountFilter]
  );

  const { buyMap, exitMap } = useMemo(() => {
    const buyMap: Record<string, Trade[]> = {};
    const exitMap: Record<string, { pnl: number; exits: { trade: Trade; price: number; qty: number }[] }> = {};

    for (const t of filteredTrades) {
      if (t.date) {
        if (!buyMap[t.date]) buyMap[t.date] = [];
        buyMap[t.date].push(t);
      }
      const result = calcTradeResult(t);
      for (const ex of t.exits) {
        const d = ex.date;
        if (!d) continue;
        if (!exitMap[d]) exitMap[d] = { pnl: 0, exits: [] };
        const exitResult = result.exitResults.find((item) => item.exitId === ex.id);
        const exitPnL = exitResult?.realizedPnL ?? 0;
        exitMap[d].pnl += exitPnL;
        exitMap[d].exits.push({ trade: t, price: ex.price, qty: ex.quantity });
      }
    }
    return { buyMap, exitMap };
  }, [filteredTrades]);

  const monthStats = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    let totalPnL = 0;
    for (const [date, data] of Object.entries(exitMap)) {
      if (date.startsWith(prefix)) totalPnL += data.pnl;
    }
    return { totalPnL };
  }, [exitMap, year, month]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
    setSelectedDate(null);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
    setSelectedDate(null);
  }

  const selectedTrades = useMemo(() => {
    if (!selectedDate) return [];
    const seen = new Set<string>();
    const result: Trade[] = [];
    for (const t of buyMap[selectedDate] ?? []) {
      if (!seen.has(t.id)) { seen.add(t.id); result.push(t); }
    }
    for (const { trade } of exitMap[selectedDate]?.exits ?? []) {
      if (!seen.has(trade.id)) { seen.add(trade.id); result.push(trade); }
    }
    return result;
  }, [selectedDate, buyMap, exitMap]);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;
  const pnlColor = monthStats.totalPnL >= 0 ? colors.profit : colors.loss;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPadding + 16, paddingBottom: bottomPadding + 100, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <Pressable onPress={prevMonth} hitSlop={12} style={styles.navBtn}>
          <Feather name="chevron-left" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.monthTitle, { color: colors.text }]}>{year}년 {month + 1}월</Text>
          <Text style={[styles.monthPnL, { color: pnlColor }]}>
            {monthStats.totalPnL >= 0 ? "+" : ""}{formatKRW(monthStats.totalPnL)}
          </Text>
        </View>
        <Pressable onPress={nextMonth} hitSlop={12} style={styles.navBtn}>
          <Feather name="chevron-right" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={() => setAccountFilter(null)}
          style={[styles.chip, { backgroundColor: accountFilter === null ? colors.primary : colors.card, borderColor: accountFilter === null ? colors.primary : colors.border }]}
        >
          <Text style={[styles.chipText, { color: accountFilter === null ? colors.primaryForeground : colors.mutedForeground }]}>전체 계좌</Text>
        </Pressable>
        {accounts.map((acc, idx) => {
          const acColor = ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length];
          const isActive = accountFilter === acc.id;
          return (
            <Pressable
              key={acc.id}
              onPress={() => setAccountFilter(isActive ? null : acc.id)}
              style={[styles.chip, { backgroundColor: isActive ? acColor + "22" : colors.card, borderColor: isActive ? acColor : colors.border }]}
            >
              <View style={[styles.chipDot, { backgroundColor: acColor }]} />
              <Text style={[styles.chipText, { color: isActive ? acColor : colors.mutedForeground }]}>{acc.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.calCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.dayLabelRow}>
          {DAY_LABELS.map((d, i) => (
            <Text
              key={d}
              style={[styles.dayLabel, { color: i === 0 ? colors.loss : i === 6 ? "#6699FF" : colors.mutedForeground }]}
            >
              {d}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((day, idx) => {
            if (day === null) return <View key={`e-${idx}`} style={styles.cell} />;
            const dateStr = toDateStr(year, month, day);
            const isSelected = selectedDate === dateStr;
            const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
            const col = idx % 7;
            const textColor = col === 0 ? colors.loss : col === 6 ? "#6699FF" : colors.text;
            const exitData = exitMap[dateStr];
            const exitPnL = exitData?.pnl ?? 0;
            const hasExit = !!exitData && exitData.exits.length > 0;
            const buyTrades = buyMap[dateStr] ?? [];
            const hasBuy = buyTrades.length > 0;
            const anyOpen = buyTrades.some((t) => calcTradeResult(t).isOpen);
            const dotColor = hasBuy ? (anyOpen ? colors.profit : colors.mutedForeground) : null;

            return (
              <Pressable
                key={dateStr}
                onPress={() => setSelectedDate(isSelected ? null : dateStr)}
                style={[styles.cell, isSelected && { backgroundColor: colors.primary + "22", borderRadius: 10 }]}
              >
                <View style={[styles.dayCircle, isToday && { backgroundColor: colors.primary }]}>
                  <Text
                    style={[
                      styles.dayNum,
                      { color: isToday ? colors.primaryForeground : textColor },
                      isSelected && !isToday && { color: colors.primary, fontWeight: "700" as const },
                    ]}
                  >
                    {day}
                  </Text>
                </View>
                {dotColor ? (
                  <View style={[styles.dot, { backgroundColor: dotColor }]} />
                ) : (
                  <View style={styles.dotPlaceholder} />
                )}
                {hasExit ? (
                  <Text
                    style={[styles.cellPnL, { color: exitPnL >= 0 ? colors.profit : colors.loss }]}
                    numberOfLines={1}
                  >
                    {exitPnL >= 0 ? "+" : "-"}{Math.abs(Math.round(exitPnL)).toLocaleString("ko-KR")}
                  </Text>
                ) : (
                  <View style={styles.dotPlaceholder} />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {selectedDate && (
        <View style={styles.selectedSection}>
          <Text style={[styles.selectedTitle, { color: colors.text }]}>
            {selectedDate.replace(/-/g, ".")} 거래
          </Text>
          {selectedTrades.length === 0 ? (
            <Text style={[styles.noTrades, { color: colors.mutedForeground }]}>이 날 거래 내역이 없습니다</Text>
          ) : (
            selectedTrades.map((t) => <CalendarTradeRow key={t.id} trade={t} />)
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  navBtn: { padding: 4 },
  headerCenter: { alignItems: "center", gap: 2 },
  monthTitle: { fontSize: 20, fontWeight: "700" as const, letterSpacing: -0.3 },
  monthPnL: { fontSize: 15, fontWeight: "700" as const },
  calCard: { marginHorizontal: 20, borderRadius: 20, borderWidth: 1, padding: 12, gap: 4 },
  dayLabelRow: { flexDirection: "row", marginBottom: 4 },
  dayLabel: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "600" as const, paddingVertical: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 4, gap: 2 },
  dayCircle: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  dayNum: { fontSize: 13, fontWeight: "500" as const },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dotPlaceholder: { width: 5, height: 5 },
  cellPnL: { fontSize: 8, fontWeight: "600" as const, letterSpacing: -0.2 },
  chipRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingVertical: 2 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 12, fontWeight: "600" as const },
  selectedSection: { paddingHorizontal: 20, gap: 10 },
  selectedTitle: { fontSize: 17, fontWeight: "700" as const },
  noTrades: { fontSize: 14, paddingVertical: 4 },
  row: { flexDirection: "row", alignItems: "center", borderRadius: 16, padding: 14, borderWidth: 1, gap: 10, overflow: "hidden" },
  accentBar: { width: 3, height: "100%", borderRadius: 2, position: "absolute", left: 0, top: 0, bottom: 0 },
  tickerBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, minWidth: 80, maxWidth: 100, alignItems: "center", gap: 3 },
  buyLabel: { fontSize: 9, fontWeight: "600" as const, letterSpacing: 0.5 },
  tickerText: { fontSize: 12, fontWeight: "700" as const, letterSpacing: 0.2 },
  rowMid: { flex: 1, gap: 2 },
  rowName: { fontSize: 14, fontWeight: "700" as const },
  rowDate: { fontSize: 11, fontWeight: "500" as const },
  rowStats: { flexDirection: "row" },
  rowStat: { fontSize: 11 },
  rowTags: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 },
  rowTagPill: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  rowTagText: { fontSize: 9, fontWeight: "700" as const, letterSpacing: 0.3 },
  rowRight: { alignItems: "flex-end", gap: 3 },
  rowPnL: { fontSize: 14, fontWeight: "700" as const },
  rowRoi: { fontSize: 11, fontWeight: "600" as const },
  statusBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 9, fontWeight: "700" as const, letterSpacing: 0.3 },
  unrealizedPill: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, marginTop: 3, alignSelf: "flex-start" },
  unrealizedText: { fontSize: 10, fontWeight: "700" as const, letterSpacing: 0.2 },
});
