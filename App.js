import React, { useEffect, useMemo, useState } from "react";
import "./global.css";
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  useColorScheme,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { Archive, BarChart3, BookOpen, Briefcase, Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Database, Dumbbell, Edit3, Heart, Laptop, Moon, Plus, Settings2, Sun, Tag, Trash2 } from "lucide-react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import Constants from "expo-constants";
import { initialState, loadState, saveState } from "./src/storage";
import { getReportMetrics, isCheckInComplete, isScheduledOnDate } from "./src/analytics";

const dateKey = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};
const todayKey = () => dateKey(new Date());
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const itemIcons = { Check, BookOpen, Briefcase, Dumbbell, Heart, Tag };
const itemColors = ["#5865F2", "#22A06B", "#D64545", "#D97706", "#8B5CF6"];
const light = {
  background: "#F7F8FC",
  surface: "#FFFFFF",
  text: "#172033",
  muted: "#748096",
  border: "#E4E8F0",
  primary: "#5865F2",
  primarySoft: "#ECEEFF",
  success: "#22A06B",
  danger: "#D64545",
};
const dark = {
  background: "#10131A",
  surface: "#1A1F2B",
  text: "#F4F6FB",
  muted: "#9AA5B8",
  border: "#2D3545",
  primary: "#8B93FF",
  primarySoft: "#2B2F58",
  success: "#45C98A",
  danger: "#FF8080",
};

export default function App() {
  return <SafeAreaProvider><DaymarkApp /></SafeAreaProvider>;
}

function DaymarkApp() {
  const systemScheme = useColorScheme();
  const [state, setState] = useState(null);
  const [tab, setTab] = useState("Today");
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState("");
  const [scheduleDraft, setScheduleDraft] = useState("daily");
  const [categoryDraft, setCategoryDraft] = useState("General");
  const [iconDraft, setIconDraft] = useState("Check");
  const [colorDraft, setColorDraft] = useState(itemColors[0]);
  const [trackingTypeDraft, setTrackingTypeDraft] = useState("binary");
  const [targetDraft, setTargetDraft] = useState("1");
  const [unitDraft, setUnitDraft] = useState("times");
  const [scheduleDaysDraft, setScheduleDaysDraft] = useState([]);

  useEffect(() => {
    loadState().then(setState);
  }, []);
  useEffect(() => {
    if (state) saveState(state);
  }, [state]);

  const isDark =
    state?.theme === "dark" ||
    (state?.theme === "system" && systemScheme === "dark");
  const colors = isDark ? dark : light;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (!state)
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.muted}>Loading Daymark…</Text>
      </SafeAreaView>
    );
  if (!state.onboardingComplete) return <Welcome styles={styles} theme={state.theme} setState={setState} />;

  const activeItems = state.items.filter((item) => !item.archived && isScheduledOnDate(item, new Date()));
  const completed = activeItems.filter(
    (item) => isCheckInComplete(item, state.checkIns[`${item.id}:${todayKey()}`]),
  ).length;
  const updateTodayValue = (item, value) => setState((current) => ({
    ...current,
    checkIns: { ...current.checkIns, [`${item.id}:${todayKey()}`]: value },
  }));
  const toggleItem = (item) => updateTodayValue(item, isCheckInComplete(item, state.checkIns[`${item.id}:${todayKey()}`]) ? 0 : (item.trackingType === "binary" ? true : item.target));

  const addOrEdit = () => {
    const name = draft.trim();
    if (!name) return;
    const scheduleDays = scheduleDraft === "custom" && !scheduleDaysDraft.length ? [1, 2, 3, 4, 5] : scheduleDaysDraft;
    setState((current) => ({
      ...current,
      items: editing
        ? current.items.map((item) =>
            item.id === editing
              ? { ...item, name, schedule: scheduleDraft, scheduleDays, category: categoryDraft, icon: iconDraft, color: colorDraft, trackingType: trackingTypeDraft, target: Math.max(1, Number(targetDraft) || 1), unit: unitDraft.trim() || "times", updatedAt: Date.now() }
              : item,
          )
        : [
            ...current.items,
            { id: uid(), name, schedule: scheduleDraft, scheduleDays, category: categoryDraft, icon: iconDraft, color: colorDraft, trackingType: trackingTypeDraft, target: Math.max(1, Number(targetDraft) || 1), unit: unitDraft.trim() || "times", sortOrder: current.items.length, createdAt: Date.now(), archived: false },
          ],
    }));
    setDraft("");
    setEditing(null);
    setScheduleDraft("daily");
    setCategoryDraft("General");
    setIconDraft("Check");
    setColorDraft(itemColors[0]);
    setTrackingTypeDraft("binary");
    setTargetDraft("1");
    setUnitDraft("times");
    setScheduleDaysDraft([]);
  };

  const editItem = (item) => {
    setEditing(item.id);
    setDraft(item.name);
    setScheduleDraft(item.schedule || "daily");
    setCategoryDraft(item.category || "General");
    setIconDraft(item.icon || "Check");
    setColorDraft(item.color || itemColors[0]);
    setTrackingTypeDraft(item.trackingType || "binary");
    setTargetDraft(String(item.target || 1));
    setUnitDraft(item.unit || (item.trackingType === "duration" ? "minutes" : "times"));
    setScheduleDaysDraft(item.scheduleDays || []);
    setTab("Items");
  };
  const archiveItem = (itemId) =>
    setState((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId ? { ...item, archived: true } : item,
      ),
    }));
  const restoreItem = (itemId) => setState((current) => ({
    ...current,
    items: current.items.map((item) => item.id === itemId ? { ...item, archived: false, updatedAt: Date.now() } : item),
  }));
  const deleteItem = (itemId) =>
    Alert.alert("Delete item?", "Its check-in history will also be removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          setState((current) => ({
            ...current,
            items: current.items.filter((item) => item.id !== itemId),
          })),
      },
    ]);
  const clearData = () => Alert.alert("Clear all data?", "This permanently removes all items and check-in history from this device.", [
    { text: "Cancel", style: "cancel" },
    { text: "Clear data", style: "destructive", onPress: () => setState({ ...initialState }) },
  ]);
  const moveItem = (itemId, direction) => setState((current) => {
    const items = [...current.items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const index = items.findIndex((item) => item.id === itemId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= items.length) return current;
    [items[index], items[target]] = [items[target], items[index]];
    return { ...current, items: items.map((item, order) => ({ ...item, sortOrder: order })) };
  });
  const exportBackup = async () => {
    try {
      const uri = `${FileSystem.documentDirectory}daymark-backup.json`;
      await FileSystem.writeAsStringAsync(uri, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...state }, null, 2));
      Alert.alert("Backup saved", `Saved locally at ${uri}`);
    } catch { Alert.alert("Export failed", "Daymark could not create the backup file."); }
  };
  const importBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const imported = JSON.parse(await FileSystem.readAsStringAsync(result.assets[0].uri));
      if (!Array.isArray(imported.items) || !imported.checkIns || typeof imported.checkIns !== "object") throw new Error("Invalid backup");
      setState({ items: imported.items, checkIns: imported.checkIns, theme: imported.theme || "system", reminders: imported.reminders || { enabled: false, hour: 8, minute: 0 } });
      Alert.alert("Backup imported", "Your Daymark data has been restored.");
    } catch { Alert.alert("Import failed", "Choose a valid Daymark JSON backup file."); }
  };
  const setReminderEnabled = async (enabled) => {
    if (Platform.OS !== "android") {
      Alert.alert("Android reminder", "Reminders are currently enabled for the Android-first v1.");
      return;
    }
    if (Constants.appOwnership === "expo") {
      Alert.alert("Development build required", "Expo Go cannot load this notification module. Run this app in an Android development build to enable reminders.");
      return;
    }
    try {
      const Notifications = await import("expo-notifications");
      if (enabled) {
        const permission = await Notifications.requestPermissionsAsync();
        if (!permission.granted) {
          Alert.alert("Permission needed", "Allow notifications to receive your daily reminder.");
          return;
        }
        await Notifications.setNotificationChannelAsync("daymark-reminders", { name: "Daymark reminders", importance: Notifications.AndroidImportance.DEFAULT });
        await Notifications.cancelAllScheduledNotificationsAsync();
        await Notifications.scheduleNotificationAsync({ content: { title: "Daymark", body: "Mark today’s progress." }, trigger: { hour: 8, minute: 0, repeats: true, channelId: "daymark-reminders" } });
      } else {
        await Notifications.cancelAllScheduledNotificationsAsync();
      }
    } catch {
      Alert.alert("Notifications unavailable", "Use an Android development build with the notifications module installed.");
      return;
    }
    setState((current) => ({ ...current, reminders: { ...(current.reminders || {}), enabled } }));
  };

  return (
    <SafeAreaView className="flex-1" style={styles.root}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
    <View className="flex-row items-center justify-between" style={styles.header}>
        <View>
          <Text className="text-2xl font-extrabold" style={styles.brand}>Daymark</Text>
          <Text style={styles.muted}>Small steps, clearly marked.</Text>
        </View>
        <View style={styles.datePill}>
          <Calendar size={16} color={colors.primary} />
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {tab === "Today" && (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>TODAY’S PROGRESS</Text>
              <Text style={styles.heroNumber}>
                {completed}
                <Text style={styles.heroTotal}>/{activeItems.length}</Text>
              </Text>
              <Text style={styles.heroSub}>
                {activeItems.length
                  ? `${Math.round((completed / activeItems.length) * 100)}% complete`
                  : "Add your first item below"}
              </Text>
            </View>
            <Text style={styles.sectionTitle}>Your items</Text>
            {activeItems.length === 0 && (
              <Empty text="No tracked items yet. Add one to get started." />
            )}
            {activeItems.map((item) => {
              const value = state.checkIns[`${item.id}:${todayKey()}`] || 0;
              const done = isCheckInComplete(item, value);
              return (
                <View key={item.id}>
                <TouchableOpacity style={styles.itemRow} onPress={() => toggleItem(item)}>
                  <View style={[styles.checkbox, done && styles.checkboxDone]}>
                    {done && <Check size={16} strokeWidth={3} color="#FFFFFF" />}
                  </View>
                  <View style={styles.todayItemContent}>
                    <Text style={[styles.itemName, done && styles.itemDone]}>{item.name}</Text>
                    <Text style={styles.itemSchedule}>{item.trackingType === "binary" ? "Done / not done" : `Target: ${item.target} ${item.unit}`}</Text>
                  </View>
                  {item.trackingType !== "binary" && <TextInput value={String(value)} onChangeText={(next) => updateTodayValue(item, Math.max(0, Number(next) || 0))} keyboardType="decimal-pad" style={styles.todayValueInput} />}
                <ChevronRight size={22} color={colors.muted} />
                </TouchableOpacity>
                <TextInput placeholder="Add a note" placeholderTextColor="#8B95A7" value={state.notes?.[`${item.id}:${todayKey()}`] || ""} onChangeText={(note) => setState((current) => ({ ...current, notes: { ...(current.notes || {}), [`${item.id}:${todayKey()}`]: note } }))} style={styles.noteInput} />
                </View>
              );
            })}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                setTab("Items");
                setEditing(null);
                setDraft("");
                setScheduleDraft("daily");
                setCategoryDraft("General");
                setIconDraft("Check");
                setColorDraft(itemColors[0]);
                setTrackingTypeDraft("binary");
                setTargetDraft("1");
                setUnitDraft("times");
                setScheduleDaysDraft([]);
              }}
            >
              <View style={styles.buttonContent}><Plus size={18} color={colors.primary} /><Text style={styles.primaryButtonText}>Add item</Text></View>
            </TouchableOpacity>
          </>
        )}
        {tab === "Reports" && (
          <Reports state={state} setState={setState} styles={styles} colors={colors} />
        )}
        {tab === "Items" && (
          <Items
            state={state}
            styles={styles}
            draft={draft}
            editing={editing}
            setDraft={setDraft}
            addOrEdit={addOrEdit}
            setEditing={setEditing}
            scheduleDraft={scheduleDraft}
            setScheduleDraft={setScheduleDraft}
            categoryDraft={categoryDraft}
            setCategoryDraft={setCategoryDraft}
            iconDraft={iconDraft}
            setIconDraft={setIconDraft}
            colorDraft={colorDraft}
            setColorDraft={setColorDraft}
            trackingTypeDraft={trackingTypeDraft}
            setTrackingTypeDraft={setTrackingTypeDraft}
            targetDraft={targetDraft}
            setTargetDraft={setTargetDraft}
            unitDraft={unitDraft}
            setUnitDraft={setUnitDraft}
            scheduleDaysDraft={scheduleDaysDraft}
            setScheduleDaysDraft={setScheduleDaysDraft}
            editItem={editItem}
            archiveItem={archiveItem}
            deleteItem={deleteItem}
            restoreItem={restoreItem}
            moveItem={moveItem}
          />
        )}
        {tab === "Settings" && (
          <Settings
            state={state}
            setState={setState}
            styles={styles}
            colors={colors}
            onExport={exportBackup}
            onImport={importBackup}
            reminderEnabled={!!state.reminders?.enabled}
            onToggleReminder={setReminderEnabled}
            onClearData={clearData}
          />
        )}
      </ScrollView>
      <View style={styles.nav}>
        {[
          ["Today", Check],
          ["Reports", BarChart3],
          ["Items", Plus],
          ["Settings", Settings2],
        ].map(([name, Icon]) => (
          <TouchableOpacity
            key={name}
            style={styles.navItem}
            onPress={() => setTab(name)}
          >
            <Icon size={20} strokeWidth={2.2} color={tab === name ? colors.primary : colors.muted} />
            <Text style={[styles.navLabel, tab === name && styles.navActive]}>
              {name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

function Welcome({ styles, theme, setState }) {
  return (
    <SafeAreaView style={styles.welcome}>
      <View style={styles.welcomeMark}><Check size={42} color="#FFFFFF" strokeWidth={3} /></View>
      <Text style={styles.welcomeTitle}>Welcome to Daymark</Text>
      <Text style={styles.welcomeText}>A calm, private place to mark the small things you want to keep doing.</Text>
      <Text style={styles.welcomeLabel}>Choose a theme</Text>
      <View style={styles.welcomeThemes}>
        {["system", "light", "dark"].map((mode) => <TouchableOpacity key={mode} style={[styles.scheduleButton, theme === mode && styles.scheduleButtonActive]} onPress={() => setState((current) => ({ ...current, theme: mode }))}><Text style={[styles.scheduleText, theme === mode && styles.scheduleTextActive]}>{mode[0].toUpperCase() + mode.slice(1)}</Text></TouchableOpacity>)}
      </View>
      <TouchableOpacity style={styles.smallButton} onPress={() => setState((current) => ({ ...current, onboardingComplete: true }))}><Text style={styles.welcomeButtonText}>Get started</Text></TouchableOpacity>
    </SafeAreaView>
  );
}

function Empty({ text }) {
  return (
    <View style={{ paddingVertical: 28 }}>
      <Text style={{ color: "#748096", textAlign: "center" }}>{text}</Text>
    </View>
  );
}

function Reports({ state, setState, styles, colors }) {
  const [period, setPeriod] = useState("week");
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [anchorDate, setAnchorDate] = useState(new Date());
  const report = getReportMetrics(state, period, anchorDate);
  const maxRate = Math.max(...report.series.map((bucket) => bucket.rate), 1);
  const periodLabels = [["day", "Day"], ["week", "Week"], ["month", "Month"], ["quarter", "Quarter"], ["half-year", "Half-year"], ["year", "Year"]];
  const historyDates = Array.from({ length: 28 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (27 - index));
    return date;
  });
  const activeItems = state.items.filter((item) => !item.archived);
  const selectedItem = activeItems.find((item) => item.id === selectedItemId) || activeItems[0];
  const toggleHistoricalCheckIn = (item, date) => {
    if (!item || !isScheduledOnDate(item, date)) return;
    const key = `${item.id}:${dateKey(date)}`;
    setState((current) => ({
      ...current,
      checkIns: { ...current.checkIns, [key]: isCheckInComplete(item, current.checkIns[key]) ? 0 : (item.trackingType === "binary" ? true : item.target) },
    }));
  };
  return (
    <>
      <Text style={styles.pageTitle}>Reports</Text>
      <Text style={styles.muted}>Completion analytics by period.</Text>
      <View style={styles.reportDateNav}><TouchableOpacity onPress={() => setAnchorDate((date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1))}><ChevronLeft size={18} color={colors.primary} /></TouchableOpacity><Text style={styles.dateText}>{anchorDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</Text><TouchableOpacity onPress={() => setAnchorDate((date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1))}><ChevronRight size={18} color={colors.primary} /></TouchableOpacity></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodScroller} contentContainerStyle={styles.periodRow}>
        {periodLabels.map(([value, label]) => (
          <TouchableOpacity key={value} style={[styles.periodButton, period === value && styles.periodButtonActive]} onPress={() => setPeriod(value)}>
            <Text style={[styles.periodText, period === value && styles.periodTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.metricGrid}>
        <Metric label="Completion" value={`${report.rate}%`} styles={styles} />
        <Metric label="Completed" value={String(report.completed)} styles={styles} />
        <Metric label="Tracked" value={String(report.items.length)} styles={styles} />
        <Metric label="Missed" value={String(report.missed)} styles={styles} />
      </View>
      <View style={styles.metricGrid}><Metric label="Current streak" value={`${report.currentStreak}d`} styles={styles} /><Metric label="Best streak" value={`${report.bestStreak}d`} styles={styles} /></View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{periodLabels.find(([value]) => value === period)[1]} activity</Text>
        <View style={styles.chart}>
          {report.series.map((bucket, index) => (
            <View key={`${bucket.label}-${index}`} style={styles.barGroup}>
              <Text style={styles.barValue}>{bucket.possible ? `${bucket.rate}%` : "—"}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${Math.max(8, (bucket.rate / maxRate) * 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.barLabel}>{bucket.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Item performance</Text>
        {report.items.length ? (
          report.items.map((item) => {
            const done = report.series.reduce((total, bucket) => total + bucket.dates.filter((date) => isScheduledOnDate(item, date) && isCheckInComplete(item, state.checkIns[`${item.id}:${dateKey(date)}`])).length, 0);
            const possible = report.series.reduce((total, bucket) => total + bucket.dates.filter((date) => isScheduledOnDate(item, date)).length, 0);
            return (
              <View key={item.id} style={styles.performanceRow}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.performanceValue}>{done}/{possible}</Text>
              </View>
            );
          })
        ) : (
          <Empty text="Complete a few days to see trends here." />
        )}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>28-day calendar heatmap</Text>
        <Text style={styles.muted}>Tap an item below, then tap a date to edit its history.</Text>
        <View style={styles.heatmap}>
          {historyDates.map((date) => {
            const scheduled = activeItems.filter((item) => isScheduledOnDate(item, date));
            const completed = scheduled.filter((item) => isCheckInComplete(item, state.checkIns[`${item.id}:${dateKey(date)}`])).length;
            const rate = scheduled.length ? completed / scheduled.length : 0;
            return (
              <View key={dateKey(date)} style={styles.heatmapCellWrap}>
                <View style={[styles.heatmapCell, { backgroundColor: scheduled.length ? (rate === 1 ? colors.success : rate > 0 ? colors.primary : colors.border) : colors.background }]} />
                <Text style={styles.heatmapLabel}>{date.getDate()}</Text>
              </View>
            );
          })}
        </View>
        {activeItems.length ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.itemFilterRow}>
              {activeItems.map((item) => (
                <TouchableOpacity key={item.id} style={[styles.itemFilter, selectedItem?.id === item.id && styles.itemFilterActive]} onPress={() => setSelectedItemId(item.id)}>
                  <Text style={[styles.itemFilterText, selectedItem?.id === item.id && styles.itemFilterTextActive]}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.historyHint}>{selectedItem?.name} · tap dates to toggle completion</Text>
            <View style={styles.historyGrid}>
              {historyDates.map((date) => {
                const key = `${selectedItem.id}:${dateKey(date)}`;
                const done = isCheckInComplete(selectedItem, state.checkIns[key]);
                const scheduled = isScheduledOnDate(selectedItem, date);
                return (
                  <TouchableOpacity key={dateKey(date)} disabled={!scheduled} onPress={() => toggleHistoricalCheckIn(selectedItem, date)} style={[styles.historyCell, done && styles.historyCellDone, !scheduled && styles.historyCellDisabled]}>
                    <Text style={[styles.historyCellText, done && styles.historyCellTextDone]}>{date.getDate()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : <Empty text="Add an item to start editing history." />}
      </View>
    </>
  );
}
function Metric({ label, value, styles }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

function Items({
  state,
  styles,
  draft,
  editing,
  setDraft,
  scheduleDraft,
  setScheduleDraft,
  categoryDraft,
  setCategoryDraft,
  iconDraft,
  setIconDraft,
  colorDraft,
  setColorDraft,
  trackingTypeDraft,
  setTrackingTypeDraft,
  targetDraft,
  setTargetDraft,
  unitDraft,
  setUnitDraft,
  scheduleDaysDraft,
  setScheduleDaysDraft,
  addOrEdit,
  setEditing,
  editItem,
  archiveItem,
  deleteItem,
  moveItem,
  restoreItem,
}) {
  const active = state.items.filter((item) => !item.archived).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const archived = state.items.filter((item) => item.archived).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  return (
    <>
      <Text style={styles.pageTitle}>Items</Text>
      <Text style={styles.muted}>Manage what you want to track each day.</Text>
      <View style={styles.addBox}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="e.g. Read for 20 minutes"
          placeholderTextColor="#8B95A7"
          style={styles.input}
          onSubmitEditing={addOrEdit}
        />
        <TouchableOpacity style={styles.smallButton} onPress={addOrEdit}>
          <Text style={styles.smallButtonText}>{editing ? "Save" : "Add"}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.schedulePicker}>
        <Text style={styles.scheduleLabel}>Schedule</Text>
        {[['daily', 'Every day'], ['weekdays', 'Weekdays'], ['custom', 'Custom']].map(([value, label]) => (
          <TouchableOpacity key={value} style={[styles.scheduleButton, scheduleDraft === value && styles.scheduleButtonActive]} onPress={() => setScheduleDraft(value)}>
            <Text style={[styles.scheduleText, scheduleDraft === value && styles.scheduleTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {scheduleDraft === "custom" && <View style={styles.schedulePicker}>
        {[['S', 0], ['M', 1], ['T', 2], ['W', 3], ['T', 4], ['F', 5], ['S', 6]].map(([label, day]) => (
          <TouchableOpacity key={`${label}-${day}`} style={[styles.dayButton, scheduleDaysDraft.includes(day) && styles.scheduleButtonActive]} onPress={() => setScheduleDaysDraft((days) => days.includes(day) ? days.filter((value) => value !== day) : [...days, day])}><Text style={[styles.scheduleText, scheduleDaysDraft.includes(day) && styles.scheduleTextActive]}>{label}</Text></TouchableOpacity>
        ))}
      </View>}
      <TextInput value={categoryDraft} onChangeText={setCategoryDraft} placeholder="Category (e.g. Health)" placeholderTextColor="#8B95A7" style={styles.categoryInput} />
      <Text style={styles.scheduleLabel}>Tracking</Text>
      <View style={styles.schedulePicker}>
        {[['binary', 'Done'], ['quantity', 'Quantity'], ['duration', 'Duration']].map(([value, label]) => (
          <TouchableOpacity key={value} style={[styles.scheduleButton, trackingTypeDraft === value && styles.scheduleButtonActive]} onPress={() => { setTrackingTypeDraft(value); if (value === "duration") setUnitDraft("minutes"); if (value === "quantity") setUnitDraft("times"); }}>
            <Text style={[styles.scheduleText, trackingTypeDraft === value && styles.scheduleTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {trackingTypeDraft !== "binary" && <View style={styles.targetRow}>
        <TextInput value={targetDraft} onChangeText={setTargetDraft} keyboardType="decimal-pad" placeholder="Target" placeholderTextColor="#8B95A7" style={styles.targetInput} />
        <TextInput value={unitDraft} onChangeText={setUnitDraft} placeholder="Unit" placeholderTextColor="#8B95A7" style={styles.targetInput} />
      </View>}
      <Text style={styles.scheduleLabel}>Icon</Text>
      <View style={styles.iconPicker}>
        {Object.entries(itemIcons).map(([name, Icon]) => (
          <TouchableOpacity key={name} style={[styles.iconChoice, iconDraft === name && styles.iconChoiceActive]} onPress={() => setIconDraft(name)}>
            <Icon size={17} color={colorDraft} />
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.scheduleLabel}>Color</Text>
      <View style={styles.colorPicker}>
        {itemColors.map((color) => <TouchableOpacity key={color} onPress={() => setColorDraft(color)} style={[styles.colorChoice, { backgroundColor: color }, colorDraft === color && styles.colorChoiceActive]} />)}
      </View>
      {editing && (
        <TouchableOpacity
          onPress={() => {
            setEditing(null);
            setDraft("");
            setScheduleDraft("daily");
            setCategoryDraft("General");
            setIconDraft("Check");
            setColorDraft(itemColors[0]);
            setTrackingTypeDraft("binary");
            setTargetDraft("1");
            setUnitDraft("times");
            setScheduleDaysDraft([]);
          }}
        >
          <Text style={styles.cancelText}>Cancel editing</Text>
        </TouchableOpacity>
      )}
      {active.map((item) => (
        <View key={item.id} style={styles.manageRow}>
            <View style={styles.itemSummary}>
              {React.createElement(itemIcons[item.icon] || Check, { size: 18, color: item.color || styles.actionIcon.color })}
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemSchedule}>{item.category || "General"} · {item.trackingType === "binary" ? "Done" : `${item.target} ${item.unit}`} · {item.schedule === "weekdays" ? "Weekdays" : "Every day"}</Text>
            </View>
          <View style={styles.rowActions}>
            <TouchableOpacity accessibilityLabel="Move item up" onPress={() => moveItem(item.id, -1)}><ChevronUp size={18} color={styles.actionIcon.color} /></TouchableOpacity>
            <TouchableOpacity accessibilityLabel="Move item down" onPress={() => moveItem(item.id, 1)}><ChevronDown size={18} color={styles.actionIcon.color} /></TouchableOpacity>
            <TouchableOpacity onPress={() => editItem(item)}>
              <Edit3 size={18} color={styles.actionIcon.color} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => archiveItem(item.id)}>
              <Archive size={18} color={styles.actionIcon.color} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteItem(item.id)}>
              <Trash2 size={18} color={styles.deleteIcon.color} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
      {!active.length && <Empty text="Your item list is empty." />}
      {!!archived.length && <>
        <Text style={styles.sectionTitle}>Archived</Text>
        {archived.map((item) => (
          <View key={item.id} style={styles.manageRow}>
            <View style={styles.itemSummary}><Text style={styles.itemName}>{item.name}</Text><Text style={styles.itemSchedule}>{item.category || "General"}</Text></View>
            <TouchableOpacity onPress={() => restoreItem(item.id)}><Text style={styles.actionText}>Restore</Text></TouchableOpacity>
          </View>
        ))}
      </>}
    </>
  );
}

function Settings({ state, setState, styles, colors, onExport, onImport, reminderEnabled, onToggleReminder, onClearData }) {
  return (
    <>
      <Text style={styles.pageTitle}>Settings</Text>
      <Text style={styles.muted}>Personalize Daymark.</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Reminders</Text>
        <View style={styles.settingRow}>
          <Text style={styles.itemName}>Daily 8:00 AM reminder</Text>
          <Switch value={reminderEnabled} onValueChange={onToggleReminder} trackColor={{ false: colors.border, true: colors.primarySoft }} thumbColor={reminderEnabled ? colors.primary : colors.muted} />
        </View>
        <Text style={styles.muted}>Android notifications are scheduled locally on this device.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Theme</Text>
        {[['system', Laptop], ['light', Sun], ['dark', Moon]].map(([mode, ModeIcon]) => (
          <TouchableOpacity
            key={mode}
            style={styles.settingRow}
            onPress={() => setState((current) => ({ ...current, theme: mode }))}
          >
            <ModeIcon size={18} color={colors.muted} style={styles.settingIcon} />
            <Text style={styles.itemName}>
              {mode[0].toUpperCase() + mode.slice(1)}
            </Text>
            <View
              style={[
                styles.radio,
                state.theme === mode && { backgroundColor: colors.primary },
              ]}
            >
              {state.theme === mode && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.card}>
        <View style={styles.cardTitleRow}><Database size={18} color={colors.primary} /><Text style={styles.cardTitle}>Storage</Text></View>
        <Text style={styles.muted}>
          Your tracker data is stored locally on this device.
        </Text>
        <View style={styles.backupActions}>
          <TouchableOpacity style={styles.backupButton} onPress={onExport}><Text style={styles.backupButtonText}>Export JSON</Text></TouchableOpacity>
          <TouchableOpacity style={styles.backupButton} onPress={onImport}><Text style={styles.backupButtonText}>Import JSON</Text></TouchableOpacity>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>About and privacy</Text>
        <Text style={styles.muted}>Daymark works offline. Your tracker data stays on this device unless you explicitly export a JSON backup.</Text>
        <TouchableOpacity style={styles.dangerButton} onPress={onClearData}><Text style={styles.deleteText}>Clear all local data</Text></TouchableOpacity>
      </View>
    </>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    welcome: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: c.background },
    welcomeMark: { width: 84, height: 84, borderRadius: 26, backgroundColor: c.primary, alignItems: "center", justifyContent: "center", marginBottom: 24 },
    welcomeTitle: { color: c.text, fontSize: 30, fontWeight: "800", textAlign: "center", marginBottom: 10 },
    welcomeText: { color: c.muted, fontSize: 16, lineHeight: 24, textAlign: "center", maxWidth: 330, marginBottom: 28 },
    welcomeLabel: { color: c.text, fontWeight: "800", marginBottom: 10 },
    welcomeThemes: { flexDirection: "row", gap: 8, marginBottom: 18 },
    welcomeButtonText: { color: "#FFFFFF", fontWeight: "800", textAlign: "center" },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 10,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    brand: { fontSize: 26, fontWeight: "800", color: c.text },
    muted: { color: c.muted, fontSize: 14 },
    datePill: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    dateText: { color: c.text, fontWeight: "700" },
    content: { padding: 20, paddingTop: 8, paddingBottom: 110 },
    hero: {
      backgroundColor: c.primary,
      borderRadius: 24,
      padding: 22,
      marginBottom: 26,
    },
    heroLabel: {
      color: "#DDE1FF",
      fontWeight: "800",
      fontSize: 12,
      letterSpacing: 1,
    },
    heroNumber: {
      color: "#FFFFFF",
      fontSize: 52,
      fontWeight: "800",
      marginTop: 8,
    },
    heroTotal: { color: "#DDE1FF", fontSize: 26 },
    heroSub: { color: "#FFFFFF", fontSize: 15 },
    sectionTitle: {
      color: c.text,
      fontSize: 18,
      fontWeight: "800",
      marginBottom: 12,
    },
    pageTitle: { color: c.text, fontSize: 28, fontWeight: "800", marginTop: 8 },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    checkbox: {
      width: 25,
      height: 25,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: c.border,
      marginRight: 13,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxDone: { backgroundColor: c.success, borderColor: c.success },
    check: { color: "#fff", fontWeight: "800" },
    itemName: { color: c.text, fontSize: 16, flex: 1 },
    todayItemContent: { flex: 1 },
    todayValueInput: { minWidth: 58, borderWidth: 1, borderColor: c.border, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 6, color: c.text, textAlign: "center", marginRight: 7 },
    noteInput: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: c.text, fontSize: 12, marginTop: -4, marginBottom: 10 },
    itemDone: { textDecorationLine: "line-through", color: c.muted },
    chevron: { color: c.muted, fontSize: 24 },
    primaryButton: {
      backgroundColor: c.primarySoft,
      padding: 16,
      borderRadius: 16,
      alignItems: "center",
      marginTop: 6,
    },
    primaryButtonText: { color: c.primary, fontSize: 16, fontWeight: "800" },
    buttonContent: { flexDirection: "row", alignItems: "center", gap: 8 },
    nav: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingBottom: 10,
      paddingTop: 9,
    },
    navItem: { flex: 1, alignItems: "center" },
    navIcon: { color: c.muted, fontSize: 20, marginBottom: 3 },
    navLabel: { color: c.muted, fontSize: 11, fontWeight: "700" },
    navActive: { color: c.primary },
    periodScroller: { marginTop: 18, marginHorizontal: -4 },
    periodRow: { gap: 8, paddingHorizontal: 4 },
    periodButton: { borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 9 },
    periodButtonActive: { backgroundColor: c.primary, borderColor: c.primary },
    periodText: { color: c.muted, fontWeight: "700", fontSize: 12 },
    periodTextActive: { color: "#FFFFFF" },
    reportDateNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginTop: 14 },
    metricGrid: { flexDirection: "row", gap: 8, marginVertical: 18 },
    metric: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 14,
      borderColor: c.border,
      borderWidth: 1,
    },
    metricValue: {
      color: c.text,
      fontSize: 22,
      fontWeight: "800",
      marginBottom: 4,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 18,
      padding: 16,
      marginBottom: 14,
      borderColor: c.border,
      borderWidth: 1,
    },
    cardTitle: {
      color: c.text,
      fontSize: 17,
      fontWeight: "800",
      marginBottom: 16,
    },
    cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    backupActions: { flexDirection: "row", gap: 8, marginTop: 14 },
    backupButton: { flex: 1, borderWidth: 1, borderColor: c.primary, borderRadius: 11, paddingVertical: 10, alignItems: "center" },
    backupButtonText: { color: c.primary, fontWeight: "800", fontSize: 12 },
    dangerButton: { borderWidth: 1, borderColor: c.danger, borderRadius: 11, paddingVertical: 10, alignItems: "center", marginTop: 14 },
    chart: {
      height: 170,
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-around",
    },
    barGroup: {
      alignItems: "center",
      flex: 1,
      height: "100%",
      justifyContent: "flex-end",
    },
    barTrack: {
      height: 120,
      width: 18,
      justifyContent: "flex-end",
      backgroundColor: c.background,
      borderRadius: 9,
      overflow: "hidden",
    },
    bar: { backgroundColor: c.primary, width: "100%", borderRadius: 9 },
    barValue: { color: c.muted, fontSize: 11, height: 18 },
    barLabel: { color: c.muted, fontSize: 11, marginTop: 8 },
    heatmap: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 16, marginBottom: 14 },
    heatmapCellWrap: { width: 22, alignItems: "center", gap: 3 },
    heatmapCell: { width: 18, height: 18, borderRadius: 5 },
    heatmapLabel: { color: c.muted, fontSize: 9 },
    itemFilterRow: { gap: 8, paddingVertical: 8 },
    itemFilter: { borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: c.background },
    itemFilterActive: { borderColor: c.primary, backgroundColor: c.primarySoft },
    itemFilterText: { color: c.muted, fontSize: 12, fontWeight: "700" },
    itemFilterTextActive: { color: c.primary },
    historyHint: { color: c.muted, fontSize: 12, marginTop: 8, marginBottom: 10 },
    historyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    historyCell: { width: 28, height: 28, borderRadius: 7, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
    historyCellDone: { backgroundColor: c.success, borderColor: c.success },
    historyCellDisabled: { backgroundColor: c.background, opacity: 0.45 },
    historyCellText: { color: c.muted, fontSize: 10, fontWeight: "700" },
    historyCellTextDone: { color: "#FFFFFF" },
    performanceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    performanceValue: { color: c.primary, fontWeight: "800" },
    addBox: { flexDirection: "row", marginVertical: 20, gap: 8 },
    categoryInput: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11, color: c.text, fontSize: 15, marginBottom: 14 },
    targetRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
    targetInput: { flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 10, color: c.text, fontSize: 15 },
    input: {
      flex: 1,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 13,
      paddingHorizontal: 14,
      color: c.text,
      fontSize: 15,
    },
    smallButton: {
      backgroundColor: c.primary,
      borderRadius: 13,
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    smallButtonText: { color: "#fff", fontWeight: "800" },
    iconPicker: { flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 14 },
    iconChoice: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", backgroundColor: c.surface },
    iconChoiceActive: { borderColor: c.primary, backgroundColor: c.primarySoft },
    colorPicker: { flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 16 },
    colorChoice: { width: 25, height: 25, borderRadius: 13, borderWidth: 2, borderColor: "transparent" },
    colorChoiceActive: { borderColor: c.text },
    cancelText: { color: c.muted, marginBottom: 14 },
    manageRow: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 15,
      padding: 15,
      marginBottom: 10,
    },
    itemSummary: { flex: 1 },
    itemSchedule: { color: c.muted, fontSize: 12, marginTop: 4 },
    rowActions: { flexDirection: "row", gap: 16, marginTop: 12 },
    actionText: { color: c.primary, fontWeight: "700" },
    actionIcon: { color: c.primary },
    orderText: { color: c.primary, fontSize: 20, fontWeight: "800" },
    deleteText: { color: c.danger, fontWeight: "700" },
    deleteIcon: { color: c.danger },
    settingIcon: { marginRight: 10 },
    schedulePicker: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
    scheduleLabel: { color: c.muted, fontSize: 13, marginRight: 2 },
    scheduleButton: { borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
    scheduleButtonActive: { backgroundColor: c.primarySoft, borderColor: c.primary },
    dayButton: { borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7 },
    scheduleText: { color: c.muted, fontSize: 12, fontWeight: "700" },
    scheduleTextActive: { color: c.primary },
    settingRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  });
}
