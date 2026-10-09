import { describe, expect, it } from "vitest";
import {
  DATE_RANGE_PRESETS,
  dateRangeClause,
  isRecognizedDateRange,
  resolveDateRange,
} from "./resolve-date-range";

/** A fixed anchor — Thursday, October 8, 2026 — so relative ranges are deterministic. */
const TODAY = new Date(2026, 9, 8);

/** A stand-in clause source — identity, not shape, is what resolution keys on. */
const ctx = { source: {} };

describe("resolveDateRange — unbounded", () => {
  it("resolves undefined, empty and 'all time' to no bounds", () => {
    expect(resolveDateRange(undefined, TODAY)).toBeUndefined();
    expect(resolveDateRange("", TODAY)).toBeUndefined();
    expect(resolveDateRange("   ", TODAY)).toBeUndefined();
    expect(resolveDateRange("all time", TODAY)).toBeUndefined();
    expect(resolveDateRange("All Time", TODAY)).toBeUndefined();
  });
});

describe("resolveDateRange — closed and partial ranges", () => {
  it("resolves 'YYYY-MM-DD to YYYY-MM-DD'", () => {
    expect(resolveDateRange("2026-01-01 to 2026-01-31", TODAY)).toEqual({
      start: "2026-01-01",
      end: "2026-01-31",
    });
  });

  it("accepts a leading 'from' on a closed range", () => {
    expect(resolveDateRange("from 2026-01-01 to 2026-01-31", TODAY)).toEqual({
      start: "2026-01-01",
      end: "2026-01-31",
    });
  });

  it("resolves 'from X' to a start-only range", () => {
    expect(resolveDateRange("from 2026-01-01", TODAY)).toEqual({
      start: "2026-01-01",
    });
  });

  it("resolves 'until Y' to an end-only range", () => {
    expect(resolveDateRange("until 2026-01-31", TODAY)).toEqual({
      end: "2026-01-31",
    });
  });

  it("resolves 'today' and 'yesterday' boundaries against the anchor", () => {
    expect(resolveDateRange("2026-01-01 to today", TODAY)).toEqual({
      start: "2026-01-01",
      end: "2026-10-08",
    });
    expect(resolveDateRange("from yesterday", TODAY)).toEqual({
      start: "2026-10-07",
    });
    expect(resolveDateRange("until Today", TODAY)).toEqual({
      end: "2026-10-08",
    });
  });

  it("rejects literal dates that are not real calendar dates", () => {
    expect(resolveDateRange("2025-02-29 to 2025-03-01", TODAY)).toBeUndefined();
    expect(resolveDateRange("2026-13-01 to 2026-12-31", TODAY)).toBeUndefined();
  });

  it("accepts a leap-day boundary", () => {
    expect(resolveDateRange("2024-02-29 to 2024-03-01", TODAY)).toEqual({
      start: "2024-02-29",
      end: "2024-03-01",
    });
  });
});

describe("resolveDateRange — presets and dynamic windows", () => {
  it("resolves 'last 7 days' to today minus six through today", () => {
    expect(resolveDateRange("last 7 days", TODAY)).toEqual({
      start: "2026-10-02",
      end: "2026-10-08",
    });
  });

  it("resolves 'last 30 days'", () => {
    expect(resolveDateRange("last 30 days", TODAY)).toEqual({
      start: "2026-09-09",
      end: "2026-10-08",
    });
  });

  it("treats 'last day' and 'last 1 days' as today", () => {
    expect(resolveDateRange("last day", TODAY)).toEqual({
      start: "2026-10-08",
      end: "2026-10-08",
    });
    expect(resolveDateRange("last 1 days", TODAY)).toEqual({
      start: "2026-10-08",
      end: "2026-10-08",
    });
  });

  it("resolves 'month to date' to the first of the month through today", () => {
    expect(resolveDateRange("month to date", TODAY)).toEqual({
      start: "2026-10-01",
      end: "2026-10-08",
    });
    expect(resolveDateRange("month to date", new Date(2026, 9, 1))).toEqual({
      start: "2026-10-01",
      end: "2026-10-01",
    });
  });

  it("matches case-insensitively", () => {
    expect(resolveDateRange("LAST 30 DAYS", TODAY)).toEqual({
      start: "2026-09-09",
      end: "2026-10-08",
    });
    expect(resolveDateRange("Month To Date", TODAY)).toEqual({
      start: "2026-10-01",
      end: "2026-10-08",
    });
  });
});

describe("resolveDateRange — unrecognized input", () => {
  it("resolves to undefined instead of a silent fallback", () => {
    for (const range of [
      "garbage",
      "last 12 parsecs",
      "last 0 days",
      "last 2 weeks",
      "next month",
      "mtd",
      "2026-01-01",
      "2026-01-01 - 2026-01-31",
    ]) {
      expect(resolveDateRange(range, TODAY), range).toBeUndefined();
    }
  });
});

describe("isRecognizedDateRange", () => {
  it("recognizes every grammar form and preset key", () => {
    for (const range of [
      "all time",
      "month to date",
      "last 7 days",
      "last 90 days",
      "last day",
      "2026-01-01 to 2026-01-31",
      "from 2026-01-01 to 2026-01-31",
      "from 2026-01-01",
      "until 2026-01-31",
      "2024-02-29 to today",
    ]) {
      expect(isRecognizedDateRange(range), range).toBe(true);
    }
  });

  it("rejects empty, malformed and out-of-subset expressions", () => {
    for (const range of [
      "",
      "   ",
      "garbage",
      "last 0 days",
      "last 2 weeks",
      "previous month",
      "2025-02-29 to 2025-03-01",
    ]) {
      expect(isRecognizedDateRange(range), range).toBe(false);
    }
  });
});

describe("DATE_RANGE_PRESETS", () => {
  it("lists the demo set — every key the resolver recognizes", () => {
    expect(DATE_RANGE_PRESETS.map((p) => p.key)).toEqual([
      "last 7 days",
      "last 30 days",
      "month to date",
      "all time",
    ]);
    for (const preset of DATE_RANGE_PRESETS) {
      expect(isRecognizedDateRange(preset.key), preset.key).toBe(true);
    }
  });
});

describe("dateRangeClause", () => {
  it("binds a closed range as `column BETWEEN ? AND ?`", () => {
    expect(
      dateRangeClause("order_date", "2026-01-01 to 2026-01-31", ctx).predicate,
    ).toEqual({
      sql: "order_date BETWEEN ? AND ?",
      params: ["2026-01-01", "2026-01-31"],
    });
  });

  it("binds 'from X' as `column >= ?` and 'until Y' as `column <= ?`", () => {
    expect(
      dateRangeClause("order_date", "from 2026-01-01", ctx).predicate,
    ).toEqual({
      sql: "order_date >= ?",
      params: ["2026-01-01"],
    });
    expect(
      dateRangeClause("order_date", "until 2026-01-31", ctx).predicate,
    ).toEqual({
      sql: "order_date <= ?",
      params: ["2026-01-31"],
    });
  });

  it("publishes a predicate-less clause for all-time, absent or unrecognized values", () => {
    expect(dateRangeClause("order_date", "all time", ctx).predicate).toBeNull();
    expect(dateRangeClause("order_date", undefined, ctx).predicate).toBeNull();
    expect(dateRangeClause("order_date", "garbage", ctx).predicate).toBeNull();
  });
});
