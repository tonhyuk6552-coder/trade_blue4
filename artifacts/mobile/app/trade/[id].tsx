import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  FlatList, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ConfirmModal } from "@/components/ConfirmModal";
import DatePicker from "@/components/DatePicker";
import EquityCurve from "@/components/EquityCurve";
import { STRATEGY_TAGS, StrategyTag, calcTradeResult, useTrades } from "@/context/TradesContext";
import { useColors } from "@/hooks/useColors";
import { useStockPrice } from "@/hooks/useStockPrice";
import { formatKRW, formatKRWSign, formatPct, normalizeDate } from "@/utils/format";

function EntryRow({ entry, onEdit, onDelete }: {
  entry: { id: string; price: number; quantity: number; timestamp: number };
  onEdit: () => void; onDelete: () => void;
}) {
  const colors = useColors();
  const entryDate = new Date(entry.timestamp).toISOString().slice(0, 10);
  return (
    <View style={[styles.txRow, { borderColor: colors.border }]}>
      <View style={[styles.txBadge, { backgroundColor: colors.profit + "15" }]}>
        <Text style={[styles.txBadgeText, { color: colors.profit }]}>매수</Text>
      </View>
      <View style={styles.txInfo}>
        <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{entryDate}</Text>
        <Text style={[styles.txPrice, { color: colors.text }]}>{formatKRW(entry.price)}</Text>
        <Text style={[styles.txQty, { color: colors.mutedForeground }]}>× {entry.quantity}주</Text>
        <Text style={[styles.txTotal, { color: colors.mutedForeground }]}>{formatKRW(entry.price * entry.quantity)}</Text>
      </View>
      <View style={styles.txActions}>
        <Pressable onPress={onEdit} hitSlop={10}><Feather name="edit-2" size={14} color={colors.mutedForeground} /></Pressable>
        <Pressable onPress={onDelete} hitSlop={10}><Feather name="trash-2" size={14} color={colors.loss} /></Pressable>
      </View>
    </View>
  );
}

function ExitRow({ exit, onEdit, onDelete }: {
  exit: { id: string; price: number; quantity: number; timestamp: number; date: string };
  onEdit: () => void; onDelete: () => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.txRow, { borderColor: colors.border }]}>
      <View style={[styles.txBadge, { backgroundColor: colors.loss + "15" }]}>
        <Text style={[styles.txBadgeText, { color: colors.loss }]}>매도</Text>
      </View>
      <View style={styles.txInfo}>
        <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{normalizeDate(exit.date)}</Text>
        <Text style={[styles.txPrice, { color: colors.text }]}>{formatKRW(exit.price)}</Text>
        <Text style={[styles.txQty, { color: colors.mutedForeground }]}>× {exit.quantity}주</Text>
        <Text style={[styles.txTotal, { color: colors.mutedForeground }]}>{formatKRW(exit.price * exit.quantity)}</Text>
      </View>
      <View style={styles.txActions}>
        <Pressable onPress={onEdit} hitSlop={10}><Feather name="edit-2" size={14} color={colors.mutedForeground} /></Pressable>
        <Pressable onPress={onDelete} hitSlop={10}><Feather name="trash-2" size={14} color={colors.loss} /></Pressable>
      </View>
    </View>
  );
}

function EditModal({ visible, title, initialPrice, initialQty, initialDate, showDate, onClose, onSave }: {
  visible: boolean; title: string; initialPrice: string; initialQty: string; initialDate?: string;
  showDate?: boolean; onClose: () => void; onSave: (p: string, q: string, d: string) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [price, setPrice] = useState(initialPrice);
  const [qty, setQty] = useState(initialQty);
  const [date, setDate] = useState(initialDate ?? "");

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 20 }]}
          onPress={() => {}}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}><Feather name="x" size={20} color={colors.mutedForeground} /></Pressable>
          </View>
          <TextInput
            style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            value={price} onChangeText={setPrice}
            keyboardType="decimal-pad" placeholder="가격" placeholderTextColor={colors.mutedForeground}
          />
          <TextInput
            style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            value={qty} onChangeText={setQty}
            keyboardType="decimal-pad" placeholder="수량" placeholderTextColor={colors.mutedForeground}
          />
          {showDate && (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput
                style={[styles.modalInput, { flex: 1, backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={date} onChangeText={setDate}
                placeholder="날짜 (YYYY-MM-DD)" placeholderTextColor={colors.mutedForeground}
              />
              <DatePicker value={date} onChange={setDate} />
            </View>
          )}
          <Pressable
            onPress={() => onSave(price, qty, date)}
            style={[styles.modalSaveBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.modalSaveText, { color: colors.primaryForeground }]}>저장</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function TradeDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trades, accounts, addEntry, addExit, updateEntry, updateExit, updateNotes, updateTags, deleteTrade, deleteEntry, deleteExit } = useTrades();

  const trade = trades.find((t) => t.id === id);

  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showAddExit, setShowAddExit] = useState(false);
  const [editEntry, setEditEntry] = useState<{ id: string; price: string; qty: string; date: string } | null>(null);
  const [editExit, setEditExit] = useState<{ id: string; price: string; qty: string; date: string } | null>(null);
  const [notesEditing, setNotesEditing] = useState(false);
  const [notesVal, setNotesVal] = useState(trade?.notes ?? "");
  const [confirmTrade, setConfirmTrade] = useState(false);
  const [confirmEntryId, setConfirmEntryId] = useState<string | null>(null);
  const [confirmExitId, setConfirmExitId] = useState<string | null>(null);
  const notesRef = useRef<TextInput>(null);

  const priceInput = useRef("");
  const qtyInput = useRef("");

  const result = useMemo(() => trade ? calcTradeResult(trade) : null, [trade]);

  const { data: priceData } = useStockPrice(result?.isOpen ? trade?.ticker : undefined);

  const unrealizedPnL = useMemo(() => {
    if (!result || !priceData || !result.isOpen) return null;
    return (priceData.price - result.avgBuy) * result.remainingQty;
  }, [result, priceData]);

  const equityData = useMemo(() => {
    if (!trade) return [];
    const sorted = [...trade.exits].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let cumPnL = 0;
    const r = calcTradeResult(trade);
    const avgBuy = r.avgBuy;
    return sorted.map((ex) => {
      const pnl = (ex.price - avgBuy) * ex.quantity;
      cumPnL += pnl;
      return { date: ex.date, pnl: cumPnL };
    });
  }, [trade]);

  if (!trade || !result) {
    return (
      <View style={[styles.notFound, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>거래를 찾을 수 없습니다</Text>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.card }]}>
          <Text style={[{ color: colors.primary }]}>돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  const pnlColor = result.realizedPnL >= 0 ? colors.profit : colors.loss;
  const hasPnL = result.totalSold > 0;
  const accountName = accounts.find((a) => a.id === trade.accountId)?.name ?? "계좌1";
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  function handleDelete() {
    setConfirmTrade(true);
  }

  function handleAddEntry(p: string, q: string) {
    if (!trade) return;
    const price = parseFloat(p), qty = parseFloat(q);
    if (isNaN(price) || isNaN(qty) || price <= 0 || qty <= 0) return;
    addEntry(trade.id, price, qty);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowAddEntry(false);
  }

  function handleAddExit(p: string, q: string, d: string) {
    if (!trade) return;
    const price = parseFloat(p), qty = parseFloat(q);
    const date = normalizeDate(d);
    if (isNaN(price) || isNaN(qty) || price <= 0 || qty <= 0) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    addExit(trade.id, price, qty, date);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowAddExit(false);
  }

  function handleSaveEntry(p: string, q: string, d: string) {
    if (!trade || !editEntry) return;
    const price = parseFloat(p), qty = parseFloat(q);
    if (isNaN(price) || isNaN(qty) || price <= 0 || qty <= 0) return;
    const dateStr = normalizeDate(d);
    const timestamp = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? Date.parse(dateStr) : undefined;
    updateEntry(trade.id, editEntry.id, price, qty, timestamp);
    setEditEntry(null);
  }

  function handleSaveExit(p: string, q: string, d: string) {
    if (!trade || !editExit) return;
    const price = parseFloat(p), qty = parseFloat(q);
    const date = normalizeDate(d);
    if (isNaN(price) || isNaN(qty) || price <= 0 || qty <= 0) return;
    updateExit(trade.id, editExit.id, price, qty, date);
    setEditExit(null);
  }

  function toggleTag(tag: StrategyTag) {
    if (!trade) return;
    const current = trade.tags ?? [];
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    updateTags(trade.id, next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function saveNotes() {
    if (!trade) return;
    updateNotes(trade.id, notesVal);
    setNotesEditing(false);
  }

  const exitDate = trade.exits.length > 0
    ? trade.exits.map((e) => e.date).filter(Boolean).sort().reverse()[0]
    : null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPadding + 16, paddingBottom: Platform.OS === "web" ? 80 : insets.bottom + 80 },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.navRow}>
        <Pressable onPress={() => router.back()} style={[styles.navBtn, { backgroundColor: colors.card, borderColor: colors.border }]} hitSlop={4}>
          <Feather name="arrow-left" size={18} color={colors.text} />
        </Pressable>
        <Pressable onPress={handleDelete} style={[styles.navBtn, { backgroundColor: colors.loss + "15", borderColor: colors.loss + "30" }]} hitSlop={4}>
          <Feather name="trash-2" size={18} color={colors.loss} />
        </Pressable>
      </View>

      <View style={styles.titleBlock}>
        <Text style={[styles.tradeName, { color: colors.text }]}>{trade.name}</Text>
        <Text style={[styles.tradeTicker, { color: colors.mutedForeground }]}>{trade.ticker} · {accountName}</Text>
        <View style={styles.dateRow}>
          <Text style={[styles.tradeDateText, { color: colors.mutedForeground }]}>
            매수 {normalizeDate(trade.date)}{exitDate ? ` → 매도 ${normalizeDate(exitDate)}` : ""}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: result.isOpen ? colors.primary + "18" : colors.accent }]}>
            <Text style={[styles.statusPillText, { color: result.isOpen ? colors.primary : colors.mutedForeground }]}>
              {result.isOpen ? "진행 중" : "종료"}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>평균 매수가</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{formatKRW(result.avgBuy)}</Text>
          </View>
          {result.totalSold > 0 && (
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>평균 매도가</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{formatKRW(result.avgSell)}</Text>
            </View>
          )}
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>총 매수 주수</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{result.totalBought}주</Text>
          </View>
          {result.remainingQty > 0 && (
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>잔여 수량</Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>{result.remainingQty}주</Text>
            </View>
          )}
        </View>
        {hasPnL && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.pnlRow}>
              <View style={styles.pnlItem}>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>실현 손익</Text>
                <Text style={[styles.pnlValue, { color: pnlColor }]}>{formatKRWSign(result.realizedPnL)}</Text>
              </View>
              <View style={styles.pnlItem}>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>수익률</Text>
                <Text style={[styles.pnlValue, { color: pnlColor }]}>{formatPct(result.roi)}</Text>
              </View>
            </View>
          </>
        )}
        {result.isOpen && priceData && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.livePriceRow}>
              <View>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>현재가 (실시간)</Text>
                <Text style={[styles.livePrice, { color: colors.text }]}>{formatKRW(priceData.price)}</Text>
              </View>
              {unrealizedPnL !== null && (
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>평가 손익</Text>
                  <Text style={[styles.pnlValue, { color: unrealizedPnL >= 0 ? colors.profit : colors.loss }]}>
                    {formatKRWSign(unrealizedPnL)}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </View>

      {equityData.length >= 2 && (
        <View style={[styles.curveCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>손익 곡선</Text>
          <EquityCurve data={equityData} height={130} />
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>매수 내역</Text>
          <Pressable onPress={() => setShowAddEntry(true)} hitSlop={8} style={[styles.addBtn, { backgroundColor: colors.profit + "15" }]}>
            <Feather name="plus" size={14} color={colors.profit} />
            <Text style={[styles.addBtnText, { color: colors.profit }]}>추가</Text>
          </Pressable>
        </View>
        {trade.entries.length === 0 ? (
          <Text style={[styles.emptyTx, { color: colors.mutedForeground }]}>매수 내역이 없습니다</Text>
        ) : (
          <View style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {trade.entries.map((e) => (
              <EntryRow
                key={e.id}
                entry={e}
                onEdit={() => setEditEntry({ id: e.id, price: String(e.price), qty: String(e.quantity), date: new Date(e.timestamp).toISOString().slice(0, 10) })}
                onDelete={() => setConfirmEntryId(e.id)}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>매도 내역</Text>
          <Pressable onPress={() => setShowAddExit(true)} hitSlop={8} style={[styles.addBtn, { backgroundColor: colors.loss + "15" }]}>
            <Feather name="plus" size={14} color={colors.loss} />
            <Text style={[styles.addBtnText, { color: colors.loss }]}>추가</Text>
          </Pressable>
        </View>
        {trade.exits.length === 0 ? (
          <Text style={[styles.emptyTx, { color: colors.mutedForeground }]}>매도 내역이 없습니다</Text>
        ) : (
          <View style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {trade.exits.map((e) => (
              <ExitRow
                key={e.id}
                exit={e}
                onEdit={() => setEditExit({ id: e.id, price: String(e.price), qty: String(e.quantity), date: e.date })}
                onDelete={() => setConfirmExitId(e.id)}
              />
            ))}
          </View>
        )}
      </View>


      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>메모</Text>
          {notesEditing ? (
            <Pressable onPress={saveNotes} hitSlop={8} style={[styles.addBtn, { backgroundColor: colors.primary + "18" }]}>
              <Text style={[styles.addBtnText, { color: colors.primary }]}>저장</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => { setNotesEditing(true); setTimeout(() => notesRef.current?.focus(), 100); }} hitSlop={8}>
              <Feather name="edit-2" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => { setNotesEditing(true); setTimeout(() => notesRef.current?.focus(), 100); }}>
          <TextInput
            ref={notesRef}
            style={[styles.notes, {
              backgroundColor: colors.card,
              borderColor: notesEditing ? colors.primary : colors.border,
              color: colors.text,
            }]}
            value={notesVal}
            onChangeText={setNotesVal}
            multiline
            placeholder="거래 메모를 입력하세요..."
            placeholderTextColor={colors.mutedForeground}
            editable={notesEditing}
            onBlur={saveNotes}
          />
        </Pressable>
      </View>

      <EditModal
        visible={showAddEntry}
        title="매수 추가"
        initialPrice=""
        initialQty=""
        showDate={false}
        onClose={() => setShowAddEntry(false)}
        onSave={(p, q) => handleAddEntry(p, q)}
      />
      <EditModal
        visible={showAddExit}
        title="매도 추가"
        initialPrice=""
        initialQty=""
        initialDate={new Date().toISOString().split("T")[0]}
        showDate={true}
        onClose={() => setShowAddExit(false)}
        onSave={handleAddExit}
      />
      {editEntry && (
        <EditModal
          visible={true}
          title="매수 수정"
          initialPrice={editEntry.price}
          initialQty={editEntry.qty}
          initialDate={editEntry.date}
          showDate={true}
          onClose={() => setEditEntry(null)}
          onSave={handleSaveEntry}
        />
      )}
      {editExit && (
        <EditModal
          visible={true}
          title="매도 수정"
          initialPrice={editExit.price}
          initialQty={editExit.qty}
          initialDate={editExit.date}
          showDate={true}
          onClose={() => setEditExit(null)}
          onSave={handleSaveExit}
        />
      )}
      <ConfirmModal
        visible={confirmTrade}
        title="거래 삭제"
        message={`'${trade.name}' 거래 기록을 삭제하시겠습니까?`}
        onConfirm={() => {
          setConfirmTrade(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteTrade(trade.id);
          router.back();
        }}
        onCancel={() => setConfirmTrade(false)}
      />
      <ConfirmModal
        visible={!!confirmEntryId}
        title="매수 내역 삭제"
        message="이 매수 내역을 삭제하시겠습니까?"
        onConfirm={() => {
          if (confirmEntryId) deleteEntry(trade.id, confirmEntryId);
          setConfirmEntryId(null);
        }}
        onCancel={() => setConfirmEntryId(null)}
      />
      <ConfirmModal
        visible={!!confirmExitId}
        title="매도 내역 삭제"
        message="이 매도 내역을 삭제하시겠습니까?"
        onConfirm={() => {
          if (confirmExitId) deleteExit(trade.id, confirmExitId);
          setConfirmExitId(null);
        }}
        onCancel={() => setConfirmExitId(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 20 },
  navRow: { flexDirection: "row", justifyContent: "space-between" },
  navBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  titleBlock: { gap: 4 },
  tradeName: { fontSize: 26, fontWeight: "700" as const, letterSpacing: -0.5 },
  tradeTicker: { fontSize: 13 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  tradeDateText: { fontSize: 12 },
  statusPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 10, fontWeight: "700" as const },
  statsCard: { borderRadius: 18, borderWidth: 1, padding: 18, gap: 14 },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  statItem: { gap: 3, minWidth: "40%" },
  statLabel: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 0.3 },
  statValue: { fontSize: 17, fontWeight: "700" as const },
  divider: { height: 1 },
  pnlRow: { flexDirection: "row", gap: 20 },
  pnlItem: { gap: 3 },
  pnlValue: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.3 },
  livePriceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  livePrice: { fontSize: 18, fontWeight: "700" as const },
  curveCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  section: { gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 17, fontWeight: "700" as const },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  addBtnText: { fontSize: 12, fontWeight: "700" as const },
  txCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  txRow: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, gap: 10 },
  txBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  txBadgeText: { fontSize: 10, fontWeight: "700" as const },
  txInfo: { flex: 1, flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  txDate: { fontSize: 11, fontWeight: "500" as const, width: "100%", marginBottom: -4 },
  txPrice: { fontSize: 15, fontWeight: "700" as const },
  txQty: { fontSize: 13 },
  txTotal: { fontSize: 12 },
  txActions: { flexDirection: "row", gap: 14 },
  emptyTx: { fontSize: 13 },
  tagGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagPill: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  tagPillText: { fontSize: 13, fontWeight: "600" as const },
  notes: { borderRadius: 14, borderWidth: 1, padding: 14, fontSize: 14, lineHeight: 22, minHeight: 100 },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  notFoundText: { fontSize: 16 },
  backBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, padding: 24, gap: 14 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontSize: 17, fontWeight: "700" as const },
  modalInput: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  modalSaveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  modalSaveText: { fontSize: 16, fontWeight: "700" as const },
});
