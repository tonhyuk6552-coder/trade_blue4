import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTrades } from "@/context/TradesContext";
import { useColors } from "@/hooks/useColors";

function SettingRow({ icon, label, description, onPress, color, danger, loading }: {
  icon: string; label: string; description: string; onPress: () => void;
  color?: string; danger?: boolean; loading?: boolean;
}) {
  const colors = useColors();
  const rowColor = danger ? colors.loss : (color ?? colors.primary);
  return (
    <Pressable
      onPress={() => {
        if (loading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed || loading ? 0.6 : 1 },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: rowColor + "18" }]}>
        <Feather name={loading ? "loader" : (icon as any)} size={20} color={rowColor} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: danger ? colors.loss : colors.text }]}>{label}</Text>
        <Text style={[styles.rowDesc, { color: colors.mutedForeground }]}>{description}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { trades, exportBackup, importBackup, exportExcelTemplate, importFromExcel,
    syncCode, syncStatus, connectSync, disconnectSync, createSync } = useTrades();
  const [excelImporting, setExcelImporting] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [creating, setCreating] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  async function handleImportExcel() {
    setExcelImporting(true);
    try {
      const result = await importFromExcel();
      if (result !== null) {
        Alert.alert(
          "엑셀 가져오기 완료",
          `가져온 기록: ${result.imported}건\n건너뜀: ${result.skipped}건\n\n건너뛴 항목은 날짜/가격/수량/구분이 올바르지 않거나, 매도 대상 포지션을 찾지 못한 경우입니다.`
        );
      }
    } finally {
      setExcelImporting(false);
    }
  }

  async function handleConnect() {
    const code = codeInput.trim().toUpperCase();
    if (code.length < 4) {
      Alert.alert("오류", "동기화 코드를 입력해주세요.");
      return;
    }
    setConnecting(true);
    try {
      const result = await connectSync(code);
      if (result === "ok") {
        setCodeInput("");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("연결 완료", "동기화가 시작되었습니다. 이제 모든 기기에서 데이터가 자동으로 동기화됩니다.");
      } else if (result === "empty_cloud") {
        Alert.alert(
          "클라우드 데이터 없음",
          "이 코드에는 저장된 거래 기록이 없습니다.\n현재 기기의 데이터를 이 코드에 업로드하여 연결하시겠습니까?",
          [
            { text: "취소", style: "cancel" },
            {
              text: "업로드 후 연결",
              onPress: async () => {
                setConnecting(true);
                try {
                  const forceResult = await connectSync(code, true);
                  if (forceResult === "ok") {
                    setCodeInput("");
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Alert.alert("연결 완료", "현재 데이터가 업로드되고 동기화가 시작되었습니다.");
                  } else {
                    Alert.alert("오류", "연결에 실패했습니다. 잠시 후 다시 시도해주세요.");
                  }
                } finally {
                  setConnecting(false);
                }
              },
            },
          ]
        );
      } else {
        Alert.alert("오류", "코드를 찾을 수 없습니다. 코드를 다시 확인해주세요.");
      }
    } finally {
      setConnecting(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const code = await createSync();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("코드 생성 완료", `동기화 코드: ${code}\n\n다른 기기에서 이 코드를 입력하면 데이터가 연동됩니다.`);
    } catch {
      Alert.alert("오류", "코드 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDisconnect() {
    Alert.alert("동기화 해제", "이 기기의 동기화를 해제합니다. 기존 데이터는 유지됩니다.", [
      { text: "취소", style: "cancel" },
      {
        text: "해제", style: "destructive",
        onPress: async () => {
          await disconnectSync();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  }

  async function handleCopyCode() {
    if (!syncCode) return;
    await Clipboard.setStringAsync(syncCode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("복사 완료", "동기화 코드가 클립보드에 복사되었습니다.");
  }

  const statusColor = syncStatus === "ok" ? colors.profit : syncStatus === "error" ? colors.loss : syncStatus === "syncing" ? "#FF9500" : colors.mutedForeground;
  const statusLabel = syncStatus === "ok" ? "동기화됨" : syncStatus === "error" ? "연결 오류" : syncStatus === "syncing" ? "동기화 중..." : "대기";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPadding + 16, paddingBottom: bottomPadding + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.text }]}>설정</Text>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>기기 간 동기화</Text>

        {syncCode ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.syncConnectedRow}>
              <View style={[styles.syncDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.syncStatus, { color: statusColor }]}>{statusLabel}</Text>
            </View>
            <Text style={[styles.syncLabel, { color: colors.mutedForeground }]}>동기화 코드</Text>
            <Pressable onPress={handleCopyCode} style={[styles.syncCodeBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.syncCodeText, { color: colors.text }]}>{syncCode}</Text>
              <Feather name="copy" size={16} color={colors.mutedForeground} />
            </Pressable>
            <Text style={[styles.syncHint, { color: colors.mutedForeground }]}>
              다른 기기에서 이 코드를 입력하면 데이터가 자동으로 연동됩니다.
            </Text>
            <Pressable
              onPress={handleDisconnect}
              style={[styles.disconnectBtn, { borderColor: colors.loss + "60" }]}
            >
              <Text style={[styles.disconnectBtnText, { color: colors.loss }]}>이 기기에서 동기화 해제</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.infoNote, { color: colors.mutedForeground }]}>
              동기화 코드를 생성하거나 기존 코드를 입력하면 여러 기기에서 동일한 데이터를 사용할 수 있습니다.
            </Text>
            <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput
                style={[styles.codeInput, { color: colors.text }]}
                placeholder="코드 입력 (예: ABCD-1234)"
                placeholderTextColor={colors.mutedForeground}
                value={codeInput}
                onChangeText={(v) => setCodeInput(v.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleConnect}
              />
              <Pressable
                onPress={handleConnect}
                disabled={connecting}
                style={[styles.connectBtn, { backgroundColor: colors.primary, opacity: connecting ? 0.5 : 1 }]}
              >
                <Text style={[styles.connectBtnText, { color: colors.primaryForeground }]}>
                  {connecting ? "연결 중..." : "연결"}
                </Text>
              </Pressable>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Pressable
              onPress={handleCreate}
              disabled={creating}
              style={[styles.createBtn, { backgroundColor: colors.profit + "18", opacity: creating ? 0.5 : 1 }]}
            >
              <Feather name="plus-circle" size={16} color={colors.profit} />
              <Text style={[styles.createBtnText, { color: colors.profit }]}>
                {creating ? "생성 중..." : "새 동기화 코드 생성 (현재 데이터 업로드)"}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>엑셀로 거래 가져오기</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.infoNote, { color: colors.mutedForeground }]}>
            엑셀 양식에 맞게 작성된 파일을 가져오면 매매 기록이 자동으로 추가됩니다.
            {"\n"}먼저 아래에서 양식 파일을 다운로드하세요.
          </Text>
          <View style={[styles.formatBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.formatTitle, { color: colors.text }]}>열 순서</Text>
            <Text style={[styles.formatValue, { color: colors.mutedForeground }]}>
              포지션번호 · 날짜 · 종목코드 · 종목명 · 구분 · 가격 · 수량 · 계좌명
            </Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.formatTitle, { color: colors.text }]}>구분 입력값</Text>
            <View style={styles.tagRow}>
              <View style={[styles.tag, { backgroundColor: colors.profit + "22" }]}>
                <Text style={[styles.tagText, { color: colors.profit }]}>매수</Text>
              </View>
              <View style={[styles.tag, { backgroundColor: colors.loss + "22" }]}>
                <Text style={[styles.tagText, { color: colors.loss }]}>매도</Text>
              </View>
            </View>
          </View>
        </View>
        <SettingRow
          icon="file-text"
          label="엑셀 양식 다운로드"
          description="매매일지_양식.xlsx 파일을 저장합니다"
          onPress={exportExcelTemplate}
          color="#FF9500"
        />
        <SettingRow
          icon="upload"
          label="엑셀 파일로 가져오기"
          description="작성한 엑셀 파일의 거래 기록을 추가합니다"
          onPress={handleImportExcel}
          loading={excelImporting}
          color="#AF52DE"
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>데이터 백업 · 복원</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>저장된 매매 기록</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{trades.length}건</Text>
          </View>
          <Text style={[styles.infoNote, { color: colors.mutedForeground }]}>
            매매 기록을 JSON 파일로 백업하거나 복원할 수 있습니다.
          </Text>
        </View>
        <SettingRow
          icon="download"
          label="백업 파일 내보내기"
          description="전체 매매 기록을 JSON 파일로 저장합니다"
          onPress={exportBackup}
          color="#00D26A"
        />
        <SettingRow
          icon="refresh-cw"
          label="백업 파일 불러오기"
          description="저장된 JSON 백업 파일에서 복원합니다"
          onPress={importBackup}
          color="#6699FF"
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>앱 정보</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>앱 이름</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>매매일지</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>데이터 저장</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{syncCode ? "클라우드 + 로컬" : "로컬"}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 24 },
  title: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.5 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 0.8, marginBottom: 2 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottomWidth: 1 },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: "600" as const },
  infoNote: { fontSize: 13, lineHeight: 19 },
  formatBox: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  formatTitle: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 0.5 },
  formatValue: { fontSize: 13, fontWeight: "500" as const },
  divider: { height: 1 },
  tagRow: { flexDirection: "row", gap: 8 },
  tag: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 },
  tagText: { fontSize: 12, fontWeight: "700" as const },
  row: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, borderWidth: 1, padding: 16 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: "600" as const },
  rowDesc: { fontSize: 12 },
  syncConnectedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  syncDot: { width: 8, height: 8, borderRadius: 4 },
  syncStatus: { fontSize: 13, fontWeight: "600" as const },
  syncLabel: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 0.5 },
  syncCodeBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  syncCodeText: { fontSize: 20, fontWeight: "700" as const, letterSpacing: 3 },
  syncHint: { fontSize: 12, lineHeight: 17 },
  disconnectBtn: { borderRadius: 10, borderWidth: 1, paddingVertical: 10, alignItems: "center" },
  disconnectBtnText: { fontSize: 13, fontWeight: "600" as const },
  inputRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, gap: 8 },
  codeInput: { flex: 1, fontSize: 15, paddingVertical: 12, letterSpacing: 1 },
  connectBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  connectBtnText: { fontSize: 13, fontWeight: "700" as const },
  createBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, paddingVertical: 12 },
  createBtnText: { fontSize: 14, fontWeight: "600" as const },
});
