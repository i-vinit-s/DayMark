const localKey = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

export function isScheduledOnDate(item, date) {
  if (item.schedule === "custom") return (item.scheduleDays || []).includes(date.getDay());
  if ((item.schedule || "daily") === "weekdays") return date.getDay() > 0 && date.getDay() < 6;
  return true;
}

export function isCheckInComplete(item, value) {
  if (item.trackingType === "quantity" || item.trackingType === "duration") {
    return Number(value) >= Math.max(1, Number(item.target) || 1);
  }
  return Boolean(value);
}

export function calculateStreak(state, item, fromDate = new Date()) {
  const cursor = new Date(fromDate);
  cursor.setHours(0, 0, 0, 0);
  let streak = 0;
  while (streak < 366) {
    if (isScheduledOnDate(item, cursor)) {
      const key = `${item.id}:${localKey(cursor)}`;
      if (!isCheckInComplete(item, state.checkIns[key])) break;
      streak += 1;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function datesBetween(start, end) {
  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function monthBuckets(now, count) {
  const current = startOfMonth(now);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(current.getFullYear(), current.getMonth() - (count - index - 1), 1);
    return { label: date.toLocaleDateString(undefined, { month: "short" }), dates: datesBetween(date, endOfMonth(date)) };
  });
}

export function buildReport(state, period, anchorDate = new Date()) {
  const items = state.items.filter((item) => !item.archived);
  const now = new Date(anchorDate);
  let buckets;
  if (period === "day") {
    buckets = [{ label: "Today", dates: [now] }];
  } else if (period === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    buckets = datesBetween(start, now).map((date) => ({ label: date.toLocaleDateString(undefined, { weekday: "short" }), dates: [date] }));
  } else if (period === "month") {
    const start = new Date(now);
    start.setDate(now.getDate() - 27);
    buckets = datesBetween(start, now).reduce((result, date, index) => {
      const bucket = Math.floor(index / 7);
      result[bucket] ||= { label: `Week ${bucket + 1}`, dates: [] };
      result[bucket].dates.push(date);
      return result;
    }, []);
  } else {
    buckets = monthBuckets(now, period === "quarter" ? 3 : period === "half-year" ? 6 : 12);
  }
  const series = buckets.map((bucket) => {
    const possible = bucket.dates.reduce((total, date) => total + items.filter((item) => isScheduledOnDate(item, date)).length, 0);
    const completed = bucket.dates.reduce((total, date) => total + items.filter((item) => isScheduledOnDate(item, date) && isCheckInComplete(item, state.checkIns[`${item.id}:${localKey(date)}`])).length, 0);
    return { ...bucket, possible, completed, rate: possible ? Math.round((completed / possible) * 100) : 0 };
  });
  const completed = series.reduce((total, bucket) => total + bucket.completed, 0);
  const possible = series.reduce((total, bucket) => total + bucket.possible, 0);
  return { series, completed, possible, rate: possible ? Math.round((completed / possible) * 100) : 0, items };
}

export function getReportMetrics(state, period, anchorDate = new Date()) {
  const report = buildReport(state, period, anchorDate);
  const scheduledDates = report.series.flatMap((bucket) => bucket.dates);
  const currentStreak = report.items.length ? Math.min(...report.items.map((item) => calculateStreak(state, item, anchorDate))) : 0;
  let bestStreak = 0;
  for (const item of report.items) {
    let streak = 0;
    for (const date of scheduledDates) {
      if (isScheduledOnDate(item, date) && isCheckInComplete(item, state.checkIns[`${item.id}:${localKey(date)}`])) streak += 1;
      else if (isScheduledOnDate(item, date)) streak = 0;
      bestStreak = Math.max(bestStreak, streak);
    }
  }
  return { ...report, currentStreak, bestStreak, missed: Math.max(0, report.possible - report.completed) };
}
