import { describe, expect, it } from "vitest";
import { formatValue } from "./format";
import { FormatError } from "./types";

// Local-time fixture: 2025-03-01 15:04:05 — the date presets read its parts.
const DATE = new Date(2025, 2, 1, 15, 4, 5);

describe("formatValue — number presets", () => {
  it.each<[string, number, string]>([
    ["num0", 1234.56, "1,235"],
    ["num1", 1234.56, "1,234.6"],
    ["num2", 1234.56, "1,234.56"],
    ["num0k", 4800, "5k"],
    ["num1k", 4800, "4.8k"],
    ["num2k", 4844, "4.84k"],
    ["num0m", 5_000_000, "5M"],
    ["num1m", 1_234_567, "1.2M"],
    ["num2m", 1_234_567, "1.23M"],
    ["num0b", 1_200_000_000, "1B"],
    ["num1b", 1_200_000_000, "1.2B"],
    ["num1t", 3_400_000_000_000, "3.4T"],
    ["id", 1234, "1234"],
    ["id", 1234.7, "1235"],
    ["mult0", 2, "2x"],
    ["mult1", 1.56, "1.6x"],
    ["mult2", 1.567, "1.57x"],
    ["sci", 12345, "1.23E4"],
    ["sci", 0.00012345, "1.23E-4"],
  ])("fmt=%s on %s → %s", (code, value, expected) => {
    expect(formatValue(value, code)).toBe(expected);
  });
});

describe("formatValue — usd presets", () => {
  it.each<[string, number, string]>([
    ["usd0", 1234.56, "$1,235"],
    ["usd1", 1234.56, "$1,234.6"],
    ["usd2", 1234.56, "$1,234.56"],
    ["usd0k", 4800, "$5k"],
    ["usd1k", 4800, "$4.8k"],
    ["usd2k", 4844, "$4.84k"],
    ["usd0m", 5_000_000, "$5M"],
    ["usd1m", 1_234_567, "$1.2M"],
    ["usd2m", 1_234_567, "$1.23M"],
    ["usd0b", 1_200_000_000, "$1B"],
    ["usd1b", 1_200_000_000, "$1.2B"],
    ["usd1t", 3_400_000_000_000, "$3.4T"],
  ])("fmt=%s on %s → %s", (code, value, expected) => {
    expect(formatValue(value, code)).toBe(expected);
  });
});

describe("formatValue — pct and bytes presets", () => {
  it.each<[string, number, string]>([
    ["pct0", 0.5, "50%"],
    ["pct1", 0.056, "5.6%"],
    ["pct2", 0.0567, "5.67%"],
    ["pct3", 0.05678, "5.678%"],
    ["bytes", 512, "512 B"],
    ["bytes", 1536, "1.5 kB"],
    ["bytes", 2_500_000, "2.5 MB"],
    ["bytes", 3_000_000_000, "3.0 GB"],
    ["bytes", 4_000_000_000_000, "4.0 TB"],
    ["bytes", -1536, "-1.5 kB"],
  ])("fmt=%s on %s → %s", (code, value, expected) => {
    expect(formatValue(value, code)).toBe(expected);
  });
});

describe("formatValue — date presets", () => {
  it.each<[string, string]>([
    ["date", "2025-03-01"],
    ["shortdate", "Mar 1/25"],
    ["longdate", "March 1, 2025"],
    ["mdy", "3/1/2025"],
    ["dmy", "1/3/2025"],
    ["hms", "3:04:05 PM"],
  ])("fmt=%s on 2025-03-01 15:04:05 → %s", (code, expected) => {
    expect(formatValue(DATE, code)).toBe(expected);
  });

  it("hms renders the 12-hour clock with AM", () => {
    expect(formatValue(new Date(2025, 2, 1, 3, 4, 5), "hms")).toBe(
      "3:04:05 AM",
    );
  });
});

describe("formatValue — auto-scale on bare num/usd/pct", () => {
  it.each<[string, number, string]>([
    ["num", 9.99, "9.99"],
    ["num", 99.9, "99.9"],
    ["num", 999, "999"],
    // 4000 (not 1000) is the k threshold — 3,999 stays unscaled.
    ["num", 3999, "3,999"],
    ["num", 4000, "4k"],
    ["num", 999_999, "1,000k"],
    ["num", 1_000_000, "1.0M"],
    ["num", 1_230_000_000, "1.2B"],
    ["num", 1_000_000_000_000, "1.0T"],
    ["num", -4200, "-4k"],
    ["num", 0, "0"],
    ["usd", 999, "$999"],
    ["usd", 5000, "$5k"],
    ["usd", 1_234_567, "$1.2M"],
    ["usd", -1_500_000, "-$1.5M"],
    ["usd", 0, "$0"],
    ["pct", 0.05, "5.00%"],
    ["pct", 0.5, "50.0%"],
    ["pct", 1, "100%"],
    ["pct", 5, "500%"],
    ["pct", -0.05, "-5.00%"],
  ])("fmt=%s on %s → %s", (code, value, expected) => {
    expect(formatValue(value, code)).toBe(expected);
  });

  it.each<[string, string]>([
    ["usd1m", "$0"],
    ["num0k", "0"],
    ["usd0k", "$0"],
  ])(
    "explicit unit code %s on 0 collapses to the base zero preset → %s",
    (code, expected) => {
      expect(formatValue(0, code)).toBe(expected);
    },
  );
});

describe("formatValue — defaults when fmt is unset", () => {
  it.each<[unknown, string]>([
    [DATE, "2025-03-01"],
    [1234.56, "1,235"],
    [1234567n, "1.2M"],
    [1234n, "1,234"],
    ["hello", "hello"],
    [null, "–"],
    [undefined, "–"],
  ])("value %s → %s", (value, expected) => {
    expect(formatValue(value)).toBe(expected);
  });

  it("returns – for a missing cell even when fmt is set", () => {
    expect(formatValue(null, "usd")).toBe("–");
  });
});

describe("formatValue — value coercion", () => {
  it("formats bigint through scaled presets via Number coercion", () => {
    expect(formatValue(1234n, "num0k")).toBe("1k");
  });

  it("keeps bigint exact on unscaled presets", () => {
    expect(formatValue(12345678901234567890n, "id")).toBe(
      "12345678901234567890",
    );
  });

  it("coerces numeric strings", () => {
    expect(formatValue("1234.56", "usd")).toBe("$1,235");
  });
});

describe("formatValue — errors", () => {
  it("throws FormatError on an unknown code, naming it and the valid set", () => {
    expect(() => formatValue(1, "bogus")).toThrowError(FormatError);
    expect(() => formatValue(1, "bogus")).toThrowError(/"bogus"/);
    expect(() => formatValue(1, "bogus")).toThrowError(/num0/);
  });

  it("carries the offending code on the error", () => {
    try {
      formatValue(1, "bogus");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(FormatError);
      expect((error as FormatError).code).toBe("bogus");
    }
  });

  it.each<[unknown, string]>([
    [DATE, "usd"],
    [DATE, "num"],
    [DATE, "bytes"],
    [42, "date"],
    [5n, "hms"],
    ["abc", "usd"],
    ["1,234", "usd"],
    [true, "usd"],
  ])("throws FormatError for value %s with fmt=%s", (value, code) => {
    expect(() => formatValue(value, code)).toThrowError(FormatError);
  });

  it("throws FormatError for an invalid Date", () => {
    expect(() => formatValue(new Date("bogus"), "date")).toThrowError(
      /invalid Date/,
    );
  });
});
