import * as SQLite from "expo-sqlite";

const database = SQLite.openDatabaseSync("daymark.db");
const DATABASE_VERSION = 5;

export const initialState = { items: [], checkIns: {}, notes: {}, theme: "system", reminders: { enabled: false, hour: 8, minute: 0 }, onboardingComplete: false };

export function normalizeItem(item) {
  const createdAt = Number(item.createdAt) || Date.now();
  return {
    id: String(item.id),
    name: String(item.name || "").trim(),
    schedule: ["daily", "weekdays", "custom"].includes(item.schedule) ? item.schedule : "daily",
    scheduleDays: Array.isArray(item.scheduleDays) ? item.scheduleDays : [],
    category: String(item.category || "General").trim() || "General",
    icon: String(item.icon || "Check"),
    color: String(item.color || "#5865F2"),
    sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : 0,
    trackingType: item.trackingType === "quantity" || item.trackingType === "duration" ? item.trackingType : "binary",
    target: Math.max(1, Number(item.target) || 1),
    unit: String(item.unit || (item.trackingType === "duration" ? "minutes" : "times")),
    createdAt,
    updatedAt: Number(item.updatedAt) || createdAt,
    archived: Boolean(item.archived),
  };
}

function migrateLegacyState() {
  const legacy = database.getFirstSync("SELECT data FROM app_state WHERE id = 1");
  if (!legacy?.data) return null;
  try { return JSON.parse(legacy.data); } catch { return null; }
}

function ensureDatabase() {
  database.withTransactionSync(() => {
    database.execSync(`
      CREATE TABLE IF NOT EXISTS app_state (
        id INTEGER PRIMARY KEY NOT NULL,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        schedule TEXT NOT NULL DEFAULT 'daily',
        archived INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS check_ins (
        item_id TEXT NOT NULL,
        date_key TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (item_id, date_key),
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
      );
    `);

    const version = database.getFirstSync("PRAGMA user_version")?.user_version || 0;
    if (version < 2) {
      const legacy = migrateLegacyState();
      if (legacy) {
        const items = Array.isArray(legacy.items) ? legacy.items.map(normalizeItem) : [];
        const checkIns = legacy.checkIns && typeof legacy.checkIns === "object" ? legacy.checkIns : {};
        database.runSync("DELETE FROM check_ins");
        database.runSync("DELETE FROM items");
        for (const item of items) {
          database.runSync(
            `INSERT INTO items (id, name, schedule, archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
            item.id, item.name, item.schedule, item.archived ? 1 : 0, item.createdAt, item.updatedAt,
          );
        }
        for (const [key, completed] of Object.entries(checkIns)) {
          if (!completed) continue;
          const separator = key.lastIndexOf(":");
          if (separator < 1) continue;
          const itemId = key.slice(0, separator);
          const dateKey = key.slice(separator + 1);
          if (!items.some((item) => item.id === itemId)) continue;
          database.runSync(
            `INSERT INTO check_ins (item_id, date_key, completed, updated_at) VALUES (?, ?, 1, ?)`,
            itemId, dateKey, Date.now(),
          );
        }
      }
      database.execSync("PRAGMA user_version = 2");
    }
    if (version < 3) {
      database.execSync("ALTER TABLE items ADD COLUMN category TEXT NOT NULL DEFAULT 'General'");
      database.execSync("ALTER TABLE items ADD COLUMN icon TEXT NOT NULL DEFAULT 'Check'");
      database.execSync("ALTER TABLE items ADD COLUMN color TEXT NOT NULL DEFAULT '#5865F2'");
      database.execSync("ALTER TABLE items ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
      database.execSync(`PRAGMA user_version = ${DATABASE_VERSION}`);
    }
    if (version < 4) {
      database.execSync("ALTER TABLE items ADD COLUMN tracking_type TEXT NOT NULL DEFAULT 'binary'");
      database.execSync("ALTER TABLE items ADD COLUMN target REAL NOT NULL DEFAULT 1");
      database.execSync("ALTER TABLE items ADD COLUMN unit TEXT NOT NULL DEFAULT 'times'");
      database.execSync(`PRAGMA user_version = ${DATABASE_VERSION}`);
    }
    if (version < 5) {
      database.execSync("ALTER TABLE items ADD COLUMN schedule_days TEXT NOT NULL DEFAULT '[]'");
      database.execSync(`PRAGMA user_version = ${DATABASE_VERSION}`);
    }
  });
}

function readState() {
  const items = database.getAllSync(
    "SELECT id, name, schedule, schedule_days, category, icon, color, sort_order, tracking_type, target, unit, archived, created_at, updated_at FROM items ORDER BY sort_order ASC, created_at ASC",
  ).map((item) => ({
    id: item.id, name: item.name, schedule: item.schedule, scheduleDays: JSON.parse(item.schedule_days || "[]"), category: item.category,
    icon: item.icon, color: item.color, sortOrder: item.sort_order,
    trackingType: item.tracking_type, target: item.target, unit: item.unit,
    archived: Boolean(item.archived), createdAt: item.created_at, updatedAt: item.updated_at,
  }));
  const checkIns = {};
  for (const checkIn of database.getAllSync("SELECT item_id, date_key FROM check_ins WHERE completed = 1")) {
    checkIns[`${checkIn.item_id}:${checkIn.date_key}`] = true;
  }
  let theme = "system";
  let reminders = initialState.reminders;
  let notes = {};
  let onboardingComplete = false;
  try {
    const row = database.getFirstSync("SELECT data FROM app_state WHERE id = 1");
    const metadata = JSON.parse(row?.data || "{}");
    theme = metadata.theme || theme;
    reminders = { ...reminders, ...(metadata.reminders || {}) };
    notes = metadata.notes || {};
    onboardingComplete = Boolean(metadata.onboardingComplete);
  } catch { /* Keep the default theme when legacy metadata is invalid. */ }
  return { items, checkIns, notes, theme, reminders, onboardingComplete };
}

export async function loadState() {
  try {
    ensureDatabase();
    return { ...initialState, ...readState() };
  } catch { return initialState; }
}

export async function saveState(state) {
  ensureDatabase();
  const now = Date.now();
  database.withTransactionSync(() => {
    database.runSync("DELETE FROM check_ins");
    database.runSync("DELETE FROM items");
    for (const rawItem of state.items || []) {
      const item = normalizeItem(rawItem);
      database.runSync(
        `INSERT INTO items (id, name, schedule, schedule_days, category, icon, color, sort_order, tracking_type, target, unit, archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id, item.name, item.schedule, JSON.stringify(item.scheduleDays), item.category, item.icon, item.color, item.sortOrder, item.trackingType, item.target, item.unit, item.archived ? 1 : 0, item.createdAt, item.updatedAt,
      );
    }
    for (const [key, completed] of Object.entries(state.checkIns || {})) {
      if (!completed) continue;
      const separator = key.lastIndexOf(":");
      if (separator < 1) continue;
      database.runSync(
        `INSERT INTO check_ins (item_id, date_key, completed, updated_at) VALUES (?, ?, 1, ?)`,
        key.slice(0, separator), key.slice(separator + 1), now,
      );
    }
    database.runSync(
      `INSERT INTO app_state (id, data, updated_at) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      JSON.stringify({ theme: state.theme || "system", reminders: state.reminders || initialState.reminders, notes: state.notes || {}, onboardingComplete: Boolean(state.onboardingComplete) }), now,
    );
  });
}
