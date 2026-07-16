"use strict";

function parseIsoCalendarDateUtc(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || ""));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return date;
}

function addDaysIso(isoDate, count) {
  const date = parseIsoCalendarDateUtc(isoDate);
  const dayCount = Number(count);
  if (!date || !Number.isInteger(dayCount)) return "";
  date.setUTCDate(date.getUTCDate() + dayCount);
  return date.toISOString().slice(0, 10);
}

function inclusiveDayCount(start, end) {
  const a = parseIsoCalendarDateUtc(start);
  const b = parseIsoCalendarDateUtc(end);
  if (!a || !b) return 0;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}

function buildIsoDateRange(startDate, endDate, maximumDays = 31) {
  const dayCount = inclusiveDayCount(startDate, endDate);
  if (dayCount < 1) throw new Error("The selected weather date range is invalid.");
  if (dayCount > maximumDays) throw new Error(`The selected weather date range exceeds ${maximumDays} days.`);
  return Array.from({ length: dayCount }, (_, index) => addDaysIso(startDate, index));
}

const tests = [
  ["one-day increment", addDaysIso("2025-01-01", 1), "2025-01-02"],
  ["seven-day end", addDaysIso("2025-01-01", 6), "2025-01-07"],
  ["negative increment", addDaysIso("2025-01-10", -6), "2025-01-04"],
  ["leap day", addDaysIso("2024-02-28", 1), "2024-02-29"],
  ["year boundary", addDaysIso("2024-12-31", 1), "2025-01-01"],
  ["inclusive count", inclusiveDayCount("2025-01-01", "2025-01-07"), 7],
  [
    "seven-day range",
    JSON.stringify(buildIsoDateRange("2025-01-01", "2025-01-07", 16)),
    JSON.stringify(["2025-01-01", "2025-01-02", "2025-01-03", "2025-01-04", "2025-01-05", "2025-01-06", "2025-01-07"]),
  ],
];

let failures = 0;
for (const [name, actual, expected] of tests) {
  const passed = actual === expected;
  console.log(`${passed ? "PASS" : "FAIL"}: ${name} -> ${actual}`);
  if (!passed) failures += 1;
}
if (failures) process.exit(1);
