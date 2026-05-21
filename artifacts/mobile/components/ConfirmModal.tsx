import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ visible, title, message, confirmText = "삭제", onConfirm, onCancel }: Props) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={[styles.box, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text>
          <View style={styles.row}>
            <Pressable
              onPress={onCancel}
              style={[styles.btn, { backgroundColor: colors.background, borderColor: colors.border }]}
            >
              <Text style={[styles.btnText, { color: colors.mutedForeground }]}>취소</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={[styles.btn, { backgroundColor: colors.loss + "20", borderColor: colors.loss + "50" }]}
            >
              <Text style={[styles.btnText, { color: colors.loss }]}>{confirmText}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  box: { width: "82%", borderRadius: 18, borderWidth: 1, padding: 22, gap: 12 },
  title: { fontSize: 16, fontWeight: "700" as const },
  message: { fontSize: 14, lineHeight: 20 },
  row: { flexDirection: "row", gap: 10, marginTop: 4 },
  btn: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 13, alignItems: "center" },
  btnText: { fontSize: 15, fontWeight: "600" as const },
});
