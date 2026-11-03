import { describe, expect, it } from "vitest";
import type { Row } from "../../data/types";
import { rowsSatisfying } from "./fragment-rows.fixture";

const ROWS: Row[] = [
  { region: "West", amount: 10 },
  { region: "North", amount: 20 },
  { region: "South", amount: 30 },
];

describe("rowsSatisfying", () => {
  it("keeps the rows a point fragment equals", () => {
    // Arrange
    const sql = "select * from (select 1) where region = ?";

    // Act
    const rows = rowsSatisfying("region", ROWS, sql, ["North"]);

    // Assert
    expect(rows).toEqual([ROWS[1]]);
  });

  it("keeps the rows a list fragment holds", () => {
    const rows = rowsSatisfying("region", ROWS, "region IN (?, ?)", [
      "West",
      "South",
    ]);

    expect(rows).toEqual([ROWS[0], ROWS[2]]);
  });

  it("keeps the rows inside an interval fragment", () => {
    const rows = rowsSatisfying(
      "amount",
      ROWS,
      "amount BETWEEN ? AND ?",
      [15, 30],
    );

    expect(rows).toEqual([ROWS[1], ROWS[2]]);
  });

  it("keeps only the rows every conjoined fragment accepts", () => {
    const sql = "(region IN (?, ?)) AND (region = ?)";

    const rows = rowsSatisfying("region", ROWS, sql, [
      "West",
      "North",
      "North",
    ]);

    expect(rows).toEqual([ROWS[1]]);
  });

  it("binds the holes of other columns' fragments before its own", () => {
    const sql = "(amount BETWEEN ? AND ?) AND (region = ?)";

    const rows = rowsSatisfying("region", ROWS, sql, [0, 100, "South"]);

    expect(rows).toEqual([ROWS[2]]);
  });

  it("returns undefined when the sql carries no fragment on the field", () => {
    const rows = rowsSatisfying("region", ROWS, "select * from opts", []);

    expect(rows).toBeUndefined();
  });
});
