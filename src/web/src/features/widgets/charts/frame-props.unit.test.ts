import { describe, expect, it } from "vitest";
import { chartFrameProps } from "./frame-props";

describe("chartFrameProps", () => {
  it("picks the props every chart kind hands its frame, nothing else", () => {
    const tagProps = {
      data: "orders",
      title: "Revenue by region",
      subtitle: "US dollars",
      height: 240,
      filters: ["region"],
      x: "region",
      y: "revenue",
      select: "crossfilter" as const,
    };

    const frame = chartFrameProps(tagProps);

    expect(frame).toEqual({
      data: "orders",
      title: "Revenue by region",
      subtitle: "US dollars",
      height: 240,
      filters: ["region"],
    });
  });
});
