import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DatePicker from "@/components/DatePicker";
import { Stock, searchStocks } from "@/constants/stocks";
import { calcTradeResult, useTrades } from "@/context/TradesContext";
import { useColors } from "@/hooks/useColors";
import { formatKRW, normalizeDate } from "@/utils/format";

type Direction = "buy" | "sell";
const ACCOUNT_COLORS = ["#00D26A", "#6699FF", "#FF9500", "#AF52DE"];

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function parseSmartDate(input: string): string {
  return normalizeDate(input);
}

function isValidDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
}

export default function LogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { trades, accounts, addTrade, addEntry, addExit } = useTrades();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [direction, setDirection] = useState<Direction>("buy");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [dateRaw, setDateRaw] = useState(todayStr());
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? "acc1");

  const priceRef = useRef<TextInput>(null);
  const qtyRef = useRef<TextInput>(null);
  const dateRef = useRef<TextInput>(null);

  const recentStocks = useMemo(() => {
    const seen = new Map<string, { name: string; ticker: string }>();
    for (const t of [...trades].sort((a, b) => b.createdAt - a.createdAt)) {
      if (!seen.has(t.ticker)) seen.set(t.ticker, { name: t.name, ticker: t.ticker });
    }
    return Array.from(seen.values());
  }, [trades]);

  const suggestions = useMemo(() => {
    if (!dropdownOpen || !query.trim()) return [];
    return searchStocks(query);
  }, [query, dropdownOpen]);

  const openTrades = trades.filter((t) => calcTradeResult(t).isOpen);
  const matchingOpen = selectedStock
    ? openTrades.filter((t) => t.ticker === selectedStock.ticker)
    : [];

  const resolvedDate = parseSmartDate(dateRaw);
  const dateValid = isValidDate(resolvedDate);
  const showDateHint = dateRaw !== resolvedDate && dateValid;

  function pickStock(stock: Stock) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedStock(stock);
    setQuery(stock.name);
    setDropdownOpen(false);
    setSelectedTradeId(null);
    priceRef.current?.focus();
  }

  function pickRecent(item: { name: string; ticker: string }) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedStock({ name: item.name, ticker: item.ticker, market: "KR" });
    setQuery(item.name);
    setDropdownOpen(false);
    setSelectedTradeId(null);
    priceRef.current?.focus();
  }

  function handleQueryChange(v: string) {
    setQuery(v);
    setSelectedStock(null);
    setDropdownOpen(true);
    setSelectedTradeId(null);
  }

  function handleSubmit() {
    const p = parseFloat(price);
    const q = parseFloat(quantity);
    const finalDate = parseSmartDate(dateRaw);

    if (!selectedStock && !query.trim()) return Alert.alert("입력 오류", "종목을 선택하거나 입력하세요.");
    if (isNaN(p) || p <= 0) return Alert.alert("입력 오류", "올바른 가격을 입력하세요.");
    if (isNaN(q) || q <= 0) return Alert.alert("입력 오류", "올바른 수량을 입력하세요.");
    if (!isValidDate(finalDate)) return Alert.alert("입력 오류", "올바른 날짜를 입력하세요.\n예: 5-8, 2026-05-08");

    const stock = selectedStock ?? {
      name: query.trim(),
      ticker: query.trim().toUpperCase(),
      market: "KR" as const,
    };

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (direction === "buy") {
      let tradeId = selectedTradeId;
      if (!tradeId) {
        const newTrade = addTrade(stock.ticker, stock.name, finalDate, selectedAccountId);
        tradeId = newTrade.id;
      }
      addEntry(tradeId, p, q);
      router.push(`/trade/${tradeId}`);
    } else {
      let tradeId = selectedTradeId;
      if (!tradeId && matchingOpen.length > 0) tradeId = matchingOpen[0].id;
      if (!tradeId) {
        Alert.alert("포지션 없음", "먼저 해당 종목의 매수 주문을 입력해주세요.");
        return;
      }
      addExit(tradeId, p, q, finalDate);
      router.push(`/trade/${tradeId}`);
    }

    setQuery("");
    setSelectedStock(null);
    setPrice("");
    setQuantity("");
    setSelectedTradeId(null);
    setDirection("buy");
    setDateRaw(todayStr());
  }

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;
  const canSubmit = (!!selectedStock || query.trim().length > 0) && price.length > 0 && quantity.length > 0;
  const orderValue =
    price && quantity && !isNaN(parseFloat(price)) && !isNaN(parseFloat(quantity))
      ? parseFloat(price) * parseFloat(quantity)
      : null;

  return (
    <KeyboardAwareScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPadding + 16, paddingBottom: bottomPadding + 100 },
      ]}
      bottomOffset={80}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.text }]}>거래 기록</Text>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>계좌 선택</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          {accounts.map((acc, idx) => {
            const acColor = ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length];
            const isActive = selectedAccountId === acc.id;
            return (
              <Pressable
                key={acc.id}
                onPress={() => setSelectedAccountId(acc.id)}
                style={[styles.accountChip, { backgroundColor: isActive ? acColor + "22" : colors.card, borderColor: isActive ? acColor : colors.border }]}
              >
                <View style={[styles.accountDot, { backgroundColor: acColor }]} />
                <Text style={[styles.accountChipText, { color: isActive ? acColor : colors.mutedForeground }]}>{acc.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>매수 / 매도</Text>
        <View style={[styles.segmented, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {(["buy", "sell"] as Direction[]).map((d) => {
            const isActive = direction === d;
            const activeColor = d === "buy" ? colors.profit : colors.loss;
            return (
              <Pressable
                key={d}
                onPress={() => setDirection(d)}
                style={[styles.segmentBtn, isActive && { backgroundColor: activeColor + "22" }]}
              >
                <Feather name={d === "buy" ? "trending-up" : "trending-down"} size={16} color={isActive ? activeColor : colors.mutedForeground} />
                <Text style={[styles.segmentText, { color: isActive ? activeColor : colors.mutedForeground }]}>
                  {d === "buy" ? "매수" : "매도"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>종목</Text>
        {recentStocks.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
            {recentStocks.map((s) => {
              const isActive = selectedStock?.ticker === s.ticker;
              return (
                <Pressable
                  key={s.ticker}
                  onPress={() => pickRecent(s)}
                  style={[styles.chip, { backgroundColor: isActive ? colors.primary + "22" : colors.card, borderColor: isActive ? colors.primary : colors.border }]}
                >
                  <Text style={[styles.chipText, { color: isActive ? colors.primary : colors.mutedForeground }]}>{s.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
        <View style={styles.inputWrap}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: selectedStock ? colors.primary : colors.border, color: colors.text }]}
            placeholder="종목명 검색 (예: 삼성전자, 엔비디아)"
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={handleQueryChange}
            onFocus={() => setDropdownOpen(true)}
          />
          {selectedStock && (
            <View style={styles.tickerTag}>
              <Text style={[styles.tickerTagText, { color: colors.primary }]}>{selectedStock.ticker}</Text>
            </View>
          )}
        </View>
        {dropdownOpen && suggestions.length > 0 && (
          <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {suggestions.map((s, i) => (
              <Pressable
                key={s.ticker}
                onPress={() => pickStock(s)}
                style={[styles.dropdownItem, i < suggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              >
                <Text style={[styles.dropdownName, { color: colors.text }]}>{s.name}</Text>
                <Text style={[styles.dropdownTicker, { color: colors.mutedForeground }]}>{s.ticker} · {s.market === "KR" ? "국내" : "미국"}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {matchingOpen.length > 0 && (
          <View style={styles.suggestWrap}>
            <Text style={[styles.suggestLabel, { color: colors.mutedForeground }]}>진행 중인 포지션:</Text>
            {matchingOpen.map((t) => {
              const r = calcTradeResult(t);
              const isSelected = selectedTradeId === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setSelectedTradeId(isSelected ? null : t.id)}
                  style={[styles.suggestItem, { backgroundColor: isSelected ? colors.primary + "22" : colors.card, borderColor: isSelected ? colors.primary : colors.border }]}
                >
                  <View style={styles.suggestInfo}>
                    <Text style={[styles.suggestName, { color: colors.text }]}>{t.name}</Text>
                    <Text style={[styles.suggestDetail, { color: colors.mutedForeground }]}>{t.date} · 잔여 {r.remainingQty}주 · 평균매수 {formatKRW(r.avgBuy)}</Text>
                  </View>
                  {isSelected && <Feather name="check-circle" size={18} color={colors.primary} />}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.row}>
        <View style={[styles.section, { flex: 1 }]}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>가격</Text>
          <TextInput
            ref={priceRef}
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="0"
            placeholderTextColor={colors.mutedForeground}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => qtyRef.current?.focus()}
          />
        </View>
        <View style={[styles.section, { flex: 1 }]}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>수량 (주)</Text>
          <TextInput
            ref={qtyRef}
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="0"
            placeholderTextColor={colors.mutedForeground}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => dateRef.current?.focus()}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>날짜</Text>
        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}>
            <TextInput
              ref={dateRef}
              style={[styles.input, {
                backgroundColor: colors.card,
                borderColor: showDateHint ? colors.primary : colors.border,
                color: colors.text,
              }]}
              placeholder="5-8 또는 2026-05-08"
              placeholderTextColor={colors.mutedForeground}
              value={dateRaw}
              onChangeText={setDateRaw}
              onBlur={() => { const p = parseSmartDate(dateRaw); if (isValidDate(p)) setDateRaw(p); }}
              returnKeyType="done"
            />
            {showDateHint && (
              <Text style={[styles.dateHint, { color: colors.primary }]}>→ {resolvedDate} 로 저장됩니다</Text>
            )}
          </View>
          <DatePicker
            value={isValidDate(resolvedDate) ? resolvedDate : todayStr()}
            onChange={(d) => setDateRaw(d)}
          />
        </View>
      </View>

      {orderValue !== null && (
        <View style={[styles.preview, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.previewLabel, { color: colors.mutedForeground }]}>주문 총액</Text>
          <Text style={[styles.previewValue, { color: colors.text }]}>{formatKRW(orderValue)}</Text>
        </View>
      )}

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={({ pressed }) => [
          styles.submitBtn,
          { backgroundColor: canSubmit ? (direction === "buy" ? colors.profit : colors.loss) : colors.accent, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Feather name={direction === "buy" ? "arrow-up-circle" : "arrow-down-circle"} size={20} color={canSubmit ? colors.primaryForeground : colors.mutedForeground} />
        <Text style={[styles.submitText, { color: canSubmit ? colors.primaryForeground : colors.mutedForeground }]}>
          {direction === "buy" ? "매수 기록하기" : "매도 기록하기"}
        </Text>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 20 },
  title: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.5 },
  section: { gap: 8 },
  label: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 0.8 },
  input: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, fontWeight: "500" as const },
  inputWrap: { position: "relative" },
  tickerTag: { position: "absolute", right: 12, top: 0, bottom: 0, justifyContent: "center" },
  tickerTagText: { fontSize: 12, fontWeight: "700" as const },
  segmented: { flexDirection: "row", borderRadius: 14, borderWidth: 1, padding: 4, gap: 4 },
  segmentBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 10 },
  segmentText: { fontSize: 15, fontWeight: "700" as const },
  row: { flexDirection: "row", gap: 12 },
  chips: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  chip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, fontWeight: "600" as const },
  accountChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  accountDot: { width: 7, height: 7, borderRadius: 4 },
  accountChipText: { fontSize: 13, fontWeight: "700" as const },
  dropdown: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  dropdownItem: { padding: 14, gap: 3 },
  dropdownName: { fontSize: 15, fontWeight: "600" as const },
  dropdownTicker: { fontSize: 12 },
  suggestWrap: { gap: 8 },
  suggestLabel: { fontSize: 12 },
  suggestItem: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  suggestInfo: { flex: 1, gap: 3 },
  suggestName: { fontWeight: "700" as const, fontSize: 15 },
  suggestDetail: { fontSize: 12 },
  dateRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  dateHint: { fontSize: 12, fontWeight: "600" as const, marginTop: 5, marginLeft: 4 },
  preview: { borderRadius: 14, borderWidth: 1, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  previewLabel: { fontSize: 13, fontWeight: "500" as const },
  previewValue: { fontSize: 20, fontWeight: "700" as const },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 16, paddingVertical: 18 },
  submitText: { fontSize: 17, fontWeight: "700" as const },
});
