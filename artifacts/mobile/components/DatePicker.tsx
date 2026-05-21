import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

interface Props {
  value: string;
  onChange: (date: string) => void;
}

export default function DatePicker({ value, onChange }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const parsed = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const initYear = parsed ? parseInt(parsed[1]) : new Date().getFullYear();
  const initMonth = parsed ? parseInt(parsed[2]) - 1 : new Date().getMonth();

  const [viewYear, setViewYear] = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);

  const today = new Date();
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function select(day: number) {
    const m = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    onChange(`${viewYear}-${m}-${d}`);
    setOpen(false);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  return (
    <>
      <Pressable
        onPress={() => {
          if (parsed) {
            setViewYear(parseInt(parsed[1]));
            setViewMonth(parseInt(parsed[2]) - 1);
          }
          setOpen(true);
        }}
        hitSlop={8}
        style={[styles.iconBtn, { backgroundColor: colors.accent }]}
      >
        <Feather name="calendar" size={18} color={colors.primary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                paddingBottom: insets.bottom + 16,
              },
            ]}
            onPress={() => {}}
          >
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>날짜 선택</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <View style={styles.monthNav}>
              <Pressable onPress={prevMonth} hitSlop={12} style={styles.navBtn}>
                <Feather name="chevron-left" size={20} color={colors.text} />
              </Pressable>
              <Text style={[styles.monthLabel, { color: colors.text }]}>
                {viewYear}년 {viewMonth + 1}월
              </Text>
              <Pressable onPress={nextMonth} hitSlop={12} style={styles.navBtn}>
                <Feather name="chevron-right" size={20} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.dayLabelRow}>
              {DAY_LABELS.map((d, i) => (
                <Text
                  key={d}
                  style={[
                    styles.dayLabel,
                    { color: i === 0 ? colors.loss : i === 6 ? "#6699FF" : colors.mutedForeground },
                  ]}
                >
                  {d}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((day, idx) => {
                if (day === null) return <View key={`e-${idx}`} style={styles.cell} />;
                const m = String(viewMonth + 1).padStart(2, "0");
                const dStr = String(day).padStart(2, "0");
                const dateStr = `${viewYear}-${m}-${dStr}`;
                const isSelected = dateStr === value;
                const isToday =
                  day === today.getDate() &&
                  viewMonth === today.getMonth() &&
                  viewYear === today.getFullYear();
                const col = idx % 7;
                const textColor = col === 0 ? colors.loss : col === 6 ? "#6699FF" : colors.text;

                return (
                  <Pressable key={dateStr} onPress={() => select(day)} style={styles.cell}>
                    <View
                      style={[
                        styles.dayCircle,
                        isSelected && { backgroundColor: colors.primary },
                        !isSelected && isToday && { borderWidth: 1.5, borderColor: colors.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNum,
                          { color: isSelected ? colors.primaryForeground : textColor },
                          isToday && !isSelected && { color: colors.primary, fontWeight: "700" as const },
                        ]}
                      >
                        {day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => {
                const y = today.getFullYear();
                const m = String(today.getMonth() + 1).padStart(2, "0");
                const d = String(today.getDate()).padStart(2, "0");
                onChange(`${y}-${m}-${d}`);
                setOpen(false);
              }}
              style={[styles.todayBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.todayText, { color: colors.primary }]}>오늘 선택</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 46,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 20,
    gap: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sheetTitle: { fontSize: 17, fontWeight: "700" as const },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navBtn: { padding: 4 },
  monthLabel: { fontSize: 16, fontWeight: "700" as const },
  dayLabelRow: { flexDirection: "row" },
  dayLabel: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "600" as const, paddingVertical: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 3 },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNum: { fontSize: 15, fontWeight: "500" as const },
  todayBtn: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  todayText: { fontSize: 15, fontWeight: "700" as const },
});
