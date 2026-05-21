import { Feather } from "@expo/vector-icons";
import { useQueries } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Account, Trade, calcTradeResult, useTrades } from "@/context/TradesContext";
import { ConfirmModal } from "@/components/ConfirmModal";
import { fetchStockPrice, useStockPrice } from "@/hooks/useStockPrice";
import { useColors } from "@/hooks/useColors";
import { formatKRW, formatPct, normalizeDate, tickerColor } from "@/utils/format";

const ACCOUNT_COLORS = ["#00D26A", "#6699FF", "#FF9500", "#AF52DE"];

function AccountCard({
  account, color, pnl, closed, open, index, total, openItems,
  onPress, onLongPress,
}: {
  account: Account; color: string; pnl: number; closed: number; open: number;
  index: number; total: number;
  openItems: Array<{ ticker: string; name: string; qty: number; avgBuy: number }>;
  onPress: () => void; onLongPress: () => void;
}) {
  const colors = useColors();
  const pnlColor = pnl >= 0 ? colors.profit : colors.loss;

  const priceQueries = useQueries({
    queries: openItems.map((item) => ({
      queryKey: ["stockPrice", item.ticker],
      queryFn: () => fetchStockPrice(item.ticker),
      staleTime: 30_000,
      refetchInterval: 60_000,
      retry: 1,
    })),
  });

  const unrealizedPnL = openItems.reduce((sum, item, idx) => {
    const price = priceQueries[idx]?.data?.price;
    if (!price || price <= 0) return sum;
    return sum + (price - item.avgBuy) * item.qty;
  }, 0);
  const hasUnrealized = priceQueries.some((q) => q.data?.price);
  const unrealizedColor = unrealizedPnL >= 0 ? colors.profit : colors.loss;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.accountCard,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={styles.accountCardTop}>
        <View style={[styles.accountDot, { backgroundColor: color }]} />
        <Text style={[styles.accountName, { color: colors.text }]} numberOfLines={1}>{account.name}</Text>
        <Feather name="chevron-right" size={13} color={colors.mutedForeground} />
      </View>
      <Text style={[styles.accountPnL, { color: pnlColor }]}>
        {pnl >= 0 ? "+" : ""}{formatKRW(pnl)}
      </Text>
      <Text style={[styles.accountMeta, { color: colors.mutedForeground }]}>
        종료 {closed} · 진행 {open}
      </Text>
      {hasUnrealized && (
        <View style={[styles.unrealizedRow, { backgroundColor: unrealizedColor + "14" }]}>
          <Text style={[styles.unrealizedLabel, { color: colors.mutedForeground }]}>미실현</Text>
          <Text style={[styles.unrealizedValue, { color: unrealizedColor }]}>
            {unrealizedPnL >= 0 ? "+" : ""}{formatKRW(unrealizedPnL)}
          </Text>
        </View>
      )}
      {openItems.length > 0 && (
        <View style={styles.accountOpenItems}>
          {openItems.map(({ name, qty }) => (
            <Text key={name} style={[styles.accountMeta, { color: colors.primary }]}>
              {name} {qty}주
            </Text>
          ))}
        </View>
      )}
    </Pressable>
  );
}

function OpenPositionRow({ trade }: { trade: Trade }) {
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
        styles.posRow,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <View style={[styles.posAccentBar, { backgroundColor: result.isOpen ? "#00D26A" : "#6B7280" }]} />
      <View style={[styles.posTickerBadge, { backgroundColor: tColor + "18" }]}>
        <Text style={[styles.posBuyLabel, { color: colors.mutedForeground }]}>평균매수가</Text>
        <Text style={[styles.posTickerText, { color: tColor }]} numberOfLines={1} adjustsFontSizeToFit>
          {formatKRW(result.avgBuy)}
        </Text>
      </View>
      <View style={styles.posMid}>
        <Text style={[styles.posName, { color: tColor }]} numberOfLines={1}>{trade.name}</Text>
        <Text style={[styles.posDate, { color: colors.mutedForeground }]}>{displayDate}</Text>
        <View style={styles.posStats}>
          <Text style={[styles.posStat, { color: colors.mutedForeground }]}>매수 {result.totalBought}주</Text>
          {result.totalSold > 0 && (
            <Text style={[styles.posStat, { color: colors.mutedForeground }]}> · 매도 {result.totalSold}주</Text>
          )}
        </View>
        {unrealizedPnL !== null && (
          <View style={[styles.posUnrealizedPill, { backgroundColor: unrealizedColor + "16" }]}>
            <Text style={[styles.posUnrealizedText, { color: unrealizedColor }]}>
              미실현 {unrealizedPnL >= 0 ? "+" : ""}{formatKRW(unrealizedPnL)}
              {" "}({priceData?.price ? formatPct(((priceData.price - result.avgBuy) / result.avgBuy) * 100) : ""})
            </Text>
          </View>
        )}
        {(trade.tags ?? []).length > 0 && (
          <View style={styles.posTagRow}>
            {(trade.tags ?? []).map((tag) => (
              <View key={tag} style={[styles.posTagPill, { backgroundColor: colors.primary + "18" }]}>
                <Text style={[styles.posTagText, { color: colors.primary }]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <View style={styles.posRight}>
        {hasPnL ? (
          <>
            <Text style={[styles.posPnL, { color: pnlColor }]}>
              {result.realizedPnL >= 0 ? "+" : "-"}{formatKRW(Math.abs(result.realizedPnL))}
            </Text>
            <Text style={[styles.posRoi, { color: pnlColor }]}>{formatPct(result.roi)}</Text>
          </>
        ) : (
          <Text style={[styles.posPnL, { color: colors.mutedForeground }]}>—</Text>
        )}
        <View style={[styles.posStatusBadge, { backgroundColor: colors.primary + "18" }]}>
          <Text style={[styles.posStatusText, { color: colors.primary }]}>진행 중</Text>
        </View>
      </View>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

function RecentTradeRow({ trade }: { trade: Trade }) {
  const colors = useColors();
  const router = useRouter();
  const result = useMemo(() => calcTradeResult(trade), [trade]);
  const hasPnL = result.totalSold > 0;
  const pnlColor = result.realizedPnL >= 0 ? colors.profit : colors.loss;
  return (
    <Pressable
      onPress={() => router.push(`/trade/${trade.id}`)}
      style={({ pressed }) => [
        styles.recentRow,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <View style={[styles.recentBadge, { backgroundColor: result.isOpen ? colors.primary + "18" : colors.accent }]}>
        <Text style={[styles.recentTicker, { color: result.isOpen ? colors.primary : colors.mutedForeground }]} numberOfLines={1}>
          {trade.name}
        </Text>
      </View>
      <View style={styles.recentMid}>
        <Text style={[styles.recentDate, { color: colors.mutedForeground }]}>{trade.date}</Text>
        <Text style={[styles.recentStatus, { color: result.isOpen ? colors.primary : colors.mutedForeground }]}>
          {result.isOpen ? `진행 중 · ${result.remainingQty}주` : "종료"}
        </Text>
      </View>
      {hasPnL ? (
        <View style={styles.recentPnLWrap}>
          <Text style={[styles.recentPnL, { color: pnlColor }]}>
            {result.realizedPnL >= 0 ? "+" : "-"}{formatKRW(Math.abs(result.realizedPnL))}
          </Text>
          <Text style={[styles.recentRoi, { color: pnlColor }]}>{formatPct(result.roi)}</Text>
        </View>
      ) : (
        <Text style={[styles.recentPnL, { color: colors.mutedForeground }]}>—</Text>
      )}
      <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
    </Pressable>
  );
}

function EditAccountModal({ visible, account, index, total, tradeCount, onClose, onMoveUp, onMoveDown, onRename, onDelete }: {
  visible: boolean; account: Account | null; index: number; total: number; tradeCount: number;
  onClose: () => void; onMoveUp: () => void; onMoveDown: () => void;
  onRename: (name: string) => void; onDelete: () => void;
}) {
  const colors = useColors();
  const acColor = ACCOUNT_COLORS[index % ACCOUNT_COLORS.length];
  const [nameVal, setNameVal] = useState(account?.name ?? "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => { setNameVal(account?.name ?? ""); }, [account]);

  function handleSaveName() {
    const trimmed = nameVal.trim();
    if (!trimmed) return;
    onRename(trimmed);
  }

  const deleteMsg = tradeCount > 0
    ? `이 계좌에는 ${tradeCount}개의 거래가 있습니다.\n계좌를 삭제하면 거래는 유지되지만 계좌 분류에서 제외됩니다.\n정말 삭제하시겠습니까?`
    : "이 계좌를 삭제하시겠습니까?";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <View style={[styles.modalDot, { backgroundColor: acColor }]} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>{account?.name ?? ""}</Text>
          </View>
          <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>계좌명 변경</Text>
          <View style={[styles.renameRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <TextInput
              style={[styles.renameInput, { color: colors.text }]}
              value={nameVal}
              onChangeText={setNameVal}
              placeholder="계좌명 입력"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />
            <Pressable
              onPress={handleSaveName}
              style={[styles.renameSaveBtn, { backgroundColor: colors.primary, opacity: nameVal.trim() ? 1 : 0.4 }]}
            >
              <Text style={[styles.renameSaveBtnText, { color: colors.primaryForeground }]}>저장</Text>
            </Pressable>
          </View>
          <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>순서 변경</Text>
          <View style={styles.modalOrderRow}>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onMoveUp(); }}
              disabled={index === 0}
              style={[styles.orderBtn, { backgroundColor: colors.background, borderColor: colors.border, opacity: index === 0 ? 0.3 : 1 }]}
            >
              <Feather name="arrow-up" size={18} color={colors.text} />
              <Text style={[styles.orderBtnText, { color: colors.text }]}>앞으로</Text>
            </Pressable>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onMoveDown(); }}
              disabled={index === total - 1}
              style={[styles.orderBtn, { backgroundColor: colors.background, borderColor: colors.border, opacity: index === total - 1 ? 0.3 : 1 }]}
            >
              <Feather name="arrow-down" size={18} color={colors.text} />
              <Text style={[styles.orderBtnText, { color: colors.text }]}>뒤로</Text>
            </Pressable>
          </View>
          <View style={styles.modalBottomRow}>
            <Pressable onPress={() => setShowDeleteConfirm(true)} style={[styles.deleteBtn, { borderColor: colors.loss + "60" }]}>
              <Feather name="trash-2" size={15} color={colors.loss} />
              <Text style={[styles.deleteBtnText, { color: colors.loss }]}>계좌 삭제</Text>
            </Pressable>
            <Pressable onPress={onClose} style={[styles.modalCancelBtn, { borderColor: colors.border }]}>
              <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>닫기</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
      <ConfirmModal
        visible={showDeleteConfirm}
        title="계좌 삭제"
        message={deleteMsg}
        onConfirm={() => { setShowDeleteConfirm(false); onDelete(); }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </Modal>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const { trades, accounts, addAccount, updateAccount, deleteAccount, reorderAccounts } = useTrades();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [addingAccount, setAddingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  const totalStats = useMemo(() => {
    let totalPnL = 0, closed = 0, open = 0;
    for (const t of trades) {
      const r = calcTradeResult(t);
      totalPnL += r.realizedPnL;
      if (r.isOpen) open++;
      else closed++;
    }
    return { totalPnL, closed, open };
  }, [trades]);

  const perAccountStats = useMemo(() => {
    return accounts.map((acc, idx) => {
      let pnl = 0, closed = 0, open = 0;
      const tickerMap = new Map<string, { ticker: string; name: string; qty: number; avgBuy: number }>();
      for (const t of trades.filter((t) => t.accountId === acc.id)) {
        const r = calcTradeResult(t);
        pnl += r.realizedPnL;
        if (r.isOpen) {
          open++;
          if (r.remainingQty > 0) {
            const existing = tickerMap.get(t.ticker);
            if (existing) {
              const totalQty = existing.qty + r.remainingQty;
              existing.avgBuy = (existing.avgBuy * existing.qty + r.avgBuy * r.remainingQty) / totalQty;
              existing.qty = totalQty;
            } else {
              tickerMap.set(t.ticker, { ticker: t.ticker, name: t.name, qty: r.remainingQty, avgBuy: r.avgBuy });
            }
          }
        } else { closed++; }
      }
      const openItems = Array.from(tickerMap.values());
      const tradeCount = trades.filter((t) => t.accountId === acc.id).length;
      return { account: acc, color: ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length], pnl, closed, open, openItems, tradeCount };
    });
  }, [trades, accounts]);

  const openPositions = useMemo(
    () => trades.filter((t) => calcTradeResult(t).isOpen),
    [trades]
  );

  const recentClosed = useMemo(
    () => trades
      .filter((t) => { const r = calcTradeResult(t); return !r.isOpen && r.totalSold > 0; })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5),
    [trades]
  );

  const pnlColor = totalStats.totalPnL >= 0 ? colors.profit : colors.loss;
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  function handleAddAccount() {
    const name = newAccountName.trim();
    if (!name) return;
    if (accounts.some((a) => a.name === name)) {
      return;
    }
    addAccount(name);
    setNewAccountName("");
    setAddingAccount(false);
  }

  function handleAccountPress(accountId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/(tabs)/positions", params: { accountId } });
  }

  function handleAccountLongPress(index: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditingIndex(index);
    setEditModalVisible(true);
  }

  const editingAccount = editingIndex !== null ? accounts[editingIndex] : null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPadding + 16, paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 100 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>전체 손익</Text>
        <Text style={[styles.headerPnL, { color: pnlColor }]}>{totalStats.totalPnL >= 0 ? "+" : ""}{formatKRW(totalStats.totalPnL)}</Text>
        <Pressable onPress={() => router.push("/(tabs)/positions")} style={styles.headerMeta}>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            종료 {totalStats.closed}건
            {totalStats.open > 0 && <Text style={{ color: colors.primary }}> · 진행 중 {totalStats.open}건 ›</Text>}
          </Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>계좌별 현황</Text>
        <View style={styles.sectionActions}>
          <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>길게 눌러 편집</Text>
          <Pressable onPress={() => setAddingAccount(true)} hitSlop={8}>
            <Feather name="plus-circle" size={18} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      {addingAccount && (
        <View style={[styles.addAccountRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.addAccountInput, { color: colors.text }]}
            placeholder="계좌명 입력"
            placeholderTextColor={colors.mutedForeground}
            value={newAccountName}
            onChangeText={setNewAccountName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleAddAccount}
          />
          <Pressable onPress={handleAddAccount} style={[styles.addAccountBtn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.addAccountBtnText, { color: colors.primaryForeground }]}>추가</Text>
          </Pressable>
          <Pressable onPress={() => { setAddingAccount(false); setNewAccountName(""); }} hitSlop={8}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
      )}

      <View style={styles.accountGrid}>
        {perAccountStats.map(({ account, color, pnl, closed, open, openItems }, idx) => (
          <AccountCard
            key={account.id}
            account={account}
            color={color}
            pnl={pnl}
            closed={closed}
            open={open}
            openItems={openItems}
            index={idx}
            total={accounts.length}
            onPress={() => handleAccountPress(account.id)}
            onLongPress={() => handleAccountLongPress(idx)}
          />
        ))}
      </View>


      {openPositions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>진행 중 포지션</Text>
            <Pressable onPress={() => router.push("/(tabs)/positions")} hitSlop={8}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>전체 ›</Text>
            </Pressable>
          </View>
          <View style={styles.list}>
            {openPositions.map((t) => (
              <OpenPositionRow key={t.id} trade={t} />
            ))}
          </View>
        </View>
      )}

      {recentClosed.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>종료된 거래</Text>
            <Pressable onPress={() => router.push("/(tabs)/positions")} hitSlop={8}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>전체 ›</Text>
            </Pressable>
          </View>
          <View style={styles.list}>
            {recentClosed.map((t) => <RecentTradeRow key={t.id} trade={t} />)}
          </View>
        </View>
      )}

      <EditAccountModal
        visible={editModalVisible}
        account={editingAccount}
        index={editingIndex ?? 0}
        total={accounts.length}
        tradeCount={editingIndex !== null ? (perAccountStats[editingIndex]?.tradeCount ?? 0) : 0}
        onClose={() => { setEditModalVisible(false); setEditingIndex(null); }}
        onMoveUp={() => {
          if (editingIndex !== null && editingIndex > 0) {
            reorderAccounts(editingIndex, editingIndex - 1);
            setEditingIndex(editingIndex - 1);
          }
        }}
        onMoveDown={() => {
          if (editingIndex !== null && editingIndex < accounts.length - 1) {
            reorderAccounts(editingIndex, editingIndex + 1);
            setEditingIndex(editingIndex + 1);
          }
        }}
        onRename={(name) => {
          if (editingAccount) {
            updateAccount(editingAccount.id, name);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }}
        onDelete={() => {
          if (editingAccount) {
            deleteAccount(editingAccount.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setEditModalVisible(false);
            setEditingIndex(null);
          }
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  header: { alignItems: "center", paddingVertical: 8 },
  headerSub: { fontSize: 13, letterSpacing: 0.3 },
  headerPnL: { fontSize: 44, fontWeight: "700" as const, letterSpacing: -1, marginVertical: 4 },
  headerMeta: { marginTop: 2 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionHint: { fontSize: 11 },
  sectionTitle: { fontSize: 17, fontWeight: "700" as const },
  seeAll: { fontSize: 13, fontWeight: "600" as const },
  section: { gap: 10 },
  list: { gap: 8 },
  accountGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  addAccountRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, padding: 12 },
  addAccountInput: { flex: 1, fontSize: 15 },
  addAccountBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addAccountBtnText: { fontSize: 13, fontWeight: "700" as const },
  accountCard: { flex: 1, minWidth: "42%", borderRadius: 16, borderWidth: 1, padding: 14, gap: 4 },
  accountCardTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  accountDot: { width: 8, height: 8, borderRadius: 4 },
  accountName: { flex: 1, fontSize: 14, fontWeight: "700" as const },
  accountPnL: { fontSize: 18, fontWeight: "700" as const, letterSpacing: -0.3 },
  accountMeta: { fontSize: 11 },
  accountOpenItems: { marginTop: 4, gap: 2 },
  posRow: { flexDirection: "row", alignItems: "center", borderRadius: 16, padding: 14, borderWidth: 1, gap: 10, overflow: "hidden" },
  posAccentBar: { width: 3, height: "100%", borderRadius: 2, position: "absolute", left: 0, top: 0, bottom: 0 },
  posTickerBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, minWidth: 80, maxWidth: 100, alignItems: "center", gap: 3 },
  posBuyLabel: { fontSize: 9, fontWeight: "600" as const, letterSpacing: 0.5 },
  posTickerText: { fontSize: 12, fontWeight: "700" as const, letterSpacing: 0.2 },
  posMid: { flex: 1, gap: 2 },
  posName: { fontSize: 14, fontWeight: "700" as const },
  posDate: { fontSize: 11, fontWeight: "500" as const },
  posStats: { flexDirection: "row" },
  posStat: { fontSize: 11 },
  posTagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 },
  posTagPill: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  posTagText: { fontSize: 9, fontWeight: "700" as const, letterSpacing: 0.3 },
  posRight: { alignItems: "flex-end", gap: 3 },
  posPnL: { fontSize: 14, fontWeight: "700" as const },
  posRoi: { fontSize: 11, fontWeight: "600" as const },
  posStatusBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  posStatusText: { fontSize: 9, fontWeight: "700" as const, letterSpacing: 0.3 },
  posUnrealizedPill: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, marginTop: 3, alignSelf: "flex-start" },
  posUnrealizedText: { fontSize: 10, fontWeight: "700" as const, letterSpacing: 0.2 },
  recentRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 12, borderWidth: 1, gap: 10 },
  recentBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 90 },
  recentTicker: { fontSize: 12, fontWeight: "700" as const },
  recentMid: { flex: 1, gap: 2 },
  recentDate: { fontSize: 11 },
  recentStatus: { fontSize: 11, fontWeight: "600" as const },
  recentPnLWrap: { alignItems: "flex-end", gap: 1 },
  recentPnL: { fontSize: 13, fontWeight: "700" as const },
  recentRoi: { fontSize: 10, fontWeight: "600" as const },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  modalBox: { width: "85%", borderRadius: 20, borderWidth: 1, padding: 24, gap: 16 },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  modalDot: { width: 12, height: 12, borderRadius: 6 },
  modalTitle: { fontSize: 17, fontWeight: "700" as const },
  modalLabel: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 0.6, textTransform: "uppercase" as const },
  renameRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, gap: 8 },
  renameInput: { flex: 1, fontSize: 15, paddingVertical: 12 },
  renameSaveBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  renameSaveBtnText: { fontSize: 13, fontWeight: "700" as const },
  modalOrderRow: { flexDirection: "row", gap: 10 },
  orderBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingVertical: 12 },
  orderBtnText: { fontSize: 13, fontWeight: "600" as const },
  modalBottomRow: { flexDirection: "row", gap: 10 },
  deleteBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, borderWidth: 1, paddingVertical: 14 },
  deleteBtnText: { fontSize: 14, fontWeight: "600" as const },
  modalCancelBtn: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 14, alignItems: "center" },
  modalCancelText: { fontSize: 15, fontWeight: "600" as const },
  unrealizedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 2 },
  unrealizedLabel: { fontSize: 10, fontWeight: "600" as const, letterSpacing: 0.4 },
  unrealizedValue: { fontSize: 12, fontWeight: "700" as const },
});
