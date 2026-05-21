import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { STRATEGY_TAGS, StrategyTag, Trade, calcTradeResult, useTrades } from "@/context/TradesContext";
import { useColors } from "@/hooks/useColors";
import { useStockPrice } from "@/hooks/useStockPrice";
import { formatKRW, formatPct, normalizeDate, tickerColor } from "@/utils/format";

type Filter = "all" | "open" | "closed";
const FILTER_LABELS: Record<Filter, string> = { all: "전체", open: "진행 중", closed: "종료" };
const ACCOUNT_COLORS = ["#00D26A", "#6699FF", "#FF9500", "#AF52DE"];

function TradeRow({ trade, accountColor }: { trade: Trade; accountColor: string }) {
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

export default function PositionsScreen() {
  const colors = useColors();
  const { trades, accounts } = useTrades();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ accountId?: string }>();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [tagFilter, setTagFilter] = useState<StrategyTag | null>(null);
  const [accountFilter, setAccountFilter] = useState<string | null>(params.accountId ?? null);

  useEffect(() => {
    if (params.accountId) setAccountFilter(params.accountId);
  }, [params.accountId]);

  const accountColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    accounts.forEach((a, i) => { m[a.id] = ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]; });
    return m;
  }, [accounts]);

  const filtered = useMemo(() => {
    const sorted = [...trades].sort((a, b) => b.createdAt - a.createdAt);
    return sorted.filter((t) => {
      const r = calcTradeResult(t);
      const passStatus = filter === "all" || (filter === "open" ? r.isOpen : !r.isOpen);
      const passTag = !tagFilter || (t.tags ?? []).includes(tagFilter);
      const passAccount = !accountFilter || t.accountId === accountFilter;
      return passStatus && passTag && passAccount;
    });
  }, [trades, filter, tagFilter, accountFilter]);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.headerWrap, { paddingTop: topPadding + 16, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>거래 내역</Text>

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

        <View style={[styles.filterRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {(["all", "open", "closed"] as Filter[]).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filterBtn, filter === f && { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.filterText, { color: filter === f ? colors.primaryForeground : colors.mutedForeground }]}>
                {FILTER_LABELS[f]}
              </Text>
            </Pressable>
          ))}
        </View>

      </View>

      <FlatList
        data={filtered}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: bottomPadding + 100, gap: 10 }}
        scrollEnabled={!!filtered.length}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <TradeRow trade={item} accountColor={accountColorMap[item.accountId] ?? ACCOUNT_COLORS[0]} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Feather name="inbox" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>거래 내역이 없습니다</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>아래 + 버튼으로 첫 거래를 입력해보세요</Text>
          </View>
        }
      />

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/(tabs)/log");
        }}
        style={({ pressed }) => [
          styles.fab,
          { bottom: bottomPadding + 90, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Feather name="plus" size={28} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrap: { paddingHorizontal: 20, paddingBottom: 8, gap: 10 },
  title: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.5 },
  chipRow: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 12, fontWeight: "600" as const },
  filterRow: { flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 4, gap: 4 },
  filterBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  filterText: { fontSize: 13, fontWeight: "600" as const },
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
  emptyWrap: { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 17, fontWeight: "600" as const, marginTop: 8 },
  emptySub: { fontSize: 14 },
  fab: {
    position: "absolute",
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#6699FF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
});
