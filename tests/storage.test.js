jest.mock("expo-sqlite", () => ({ openDatabaseSync: () => ({}) }));

import { initialState, normalizeItem } from "../src/storage";

test("normalizes legacy items with safe defaults", () => {
  const item = normalizeItem({ id: 7, name: "  Walk  ", schedule: "unknown", trackingType: "duration", target: 30 });
  expect(item).toMatchObject({ id: "7", name: "Walk", schedule: "daily", trackingType: "duration", target: 30, unit: "minutes", category: "General" });
});

test("initial persistence state includes reminders", () => {
  expect(initialState).toMatchObject({ items: [], checkIns: {}, theme: "system", reminders: { enabled: false, hour: 8, minute: 0 } });
});
