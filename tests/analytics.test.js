import { calculateStreak, buildReport, isCheckInComplete, isScheduledOnDate } from "../src/analytics";

const dayKey = (date) => date.toISOString().slice(0, 10);

describe("analytics boundaries", () => {
  test("weekdays exclude Saturday and Sunday", () => {
    const monday = new Date("2026-10-26T12:00:00");
    const saturday = new Date("2026-10-31T12:00:00");
    const item = { schedule: "weekdays" };
    expect(isScheduledOnDate(item, monday)).toBe(true);
    expect(isScheduledOnDate(item, saturday)).toBe(false);
  });

  test("quantity and duration require their target", () => {
    expect(isCheckInComplete({ trackingType: "quantity", target: 5 }, 4)).toBe(false);
    expect(isCheckInComplete({ trackingType: "quantity", target: 5 }, 5)).toBe(true);
    expect(isCheckInComplete({ trackingType: "duration", target: 20 }, 25)).toBe(true);
    expect(isCheckInComplete({ trackingType: "binary" }, true)).toBe(true);
  });

  test("calculates a consecutive scheduled-day streak", () => {
    const today = new Date("2026-10-28T12:00:00");
    const item = { id: "read", schedule: "weekdays", trackingType: "binary" };
    const checkIns = {};
    ["2026-10-28", "2026-10-27", "2026-10-26"].forEach((date) => { checkIns[`read:${date}`] = true; });
    expect(calculateStreak({ checkIns }, item, today)).toBe(3);
  });

  test("reports target completion rather than any partial value", () => {
    const today = new Date();
    const item = { id: "water", schedule: "daily", trackingType: "quantity", target: 8 };
    const state = { items: [item], checkIns: { [`water:${dayKey(today)}`]: 4 } };
    expect(buildReport(state, "day").completed).toBe(0);
  });
});
