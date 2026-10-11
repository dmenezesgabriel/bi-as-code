import { describe, expect, it } from "vitest";
import { formatTitle } from "./format-title";

describe("formatTitle", () => {
  describe("snake_case column names", () => {
    it("title-cases each word", () => {
      expect(formatTitle("revenue")).toBe("Revenue");
      expect(formatTitle("order_date")).toBe("Order Date");
    });

    it("collapses repeated underscores", () => {
      expect(formatTitle("total__sales")).toBe("Total Sales");
    });

    it("upper-cases known acronyms", () => {
      expect(formatTitle("order_id")).toBe("Order ID");
      expect(formatTitle("revenue_yoy")).toBe("Revenue YOY");
    });

    it("leaves pct a word, not an acronym", () => {
      expect(formatTitle("pct_of_total")).toBe("Pct of Total");
    });

    it("keeps joining words lowercase after the first word", () => {
      expect(formatTitle("day_of_the_week")).toBe("Day of the Week");
      expect(formatTitle("of_week")).toBe("Of Week");
    });
  });

  describe("expression column names", () => {
    it("reads a call as 'of' its argument", () => {
      expect(formatTitle("sum(revenue)")).toBe("Sum of Revenue");
    });

    it("drops double quotes", () => {
      expect(formatTitle('"revenue"')).toBe("Revenue");
    });
  });

  describe("author aliases", () => {
    it("keeps a name with a capital or a space as written", () => {
      expect(formatTitle("Channel")).toBe("Channel");
      expect(formatTitle("Revenue (USD)")).toBe("Revenue (USD)");
      expect(formatTitle("share of week")).toBe("share of week");
    });
  });

  it("returns an empty name empty", () => {
    expect(formatTitle("")).toBe("");
  });
});
