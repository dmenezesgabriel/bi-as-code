import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Row } from "../../data/types";
import { DataTable } from "./data-table";
import { resolveTableColumns } from "./table-columns";

const ROWS: Row[] = Array.from({ length: 39 }, (_, i) => ({
  week: `w${i + 1}`,
  orders: 100 - i,
}));

const visibleWeeks = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((tr) => (tr as HTMLTableRowElement).cells[0]?.textContent);

const header = (name: string) => screen.getByRole("columnheader", { name });

describe("DataTable", () => {
  it("renders one columnheader per key of the first row", () => {
    render(<DataTable rows={[{ region: "West", orders: 140 }]} />);

    expect(
      screen.getAllByRole("columnheader").map((th) => th.textContent),
    ).toEqual(["Region", "Orders"]);
  });

  it("renders the empty state when there are no rows", () => {
    render(<DataTable rows={[]} />);

    expect(screen.getByText("0 rows")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows pageSize rows and a pager when the result overflows", () => {
    render(<DataTable rows={ROWS} pageSize={10} />);

    expect(screen.getAllByRole("row")).toHaveLength(11);
    expect(screen.getByText("Page 1 of 4 · 39 rows")).toBeInTheDocument();
  });

  it("hides the pager when the result fits one page", () => {
    render(<DataTable rows={ROWS.slice(0, 3)} pageSize={10} />);

    expect(screen.queryByText(/Page \d+ of \d+/)).toBeNull();
  });

  it("navigates first/previous/next/last and disables at the bounds", () => {
    render(<DataTable rows={ROWS} pageSize={10} />);
    const first = screen.getByRole("button", { name: "First page" });
    const prev = screen.getByRole("button", { name: "Previous page" });
    const next = screen.getByRole("button", { name: "Next page" });
    const last = screen.getByRole("button", { name: "Last page" });

    expect(first).toBeDisabled();
    expect(prev).toBeDisabled();

    fireEvent.click(next);
    expect(screen.getByText("Page 2 of 4 · 39 rows")).toBeInTheDocument();
    expect(visibleWeeks()[0]).toBe("w11");
    expect(prev).not.toBeDisabled();

    fireEvent.click(last);
    expect(screen.getByText("Page 4 of 4 · 39 rows")).toBeInTheDocument();
    expect(visibleWeeks()).toHaveLength(9);
    expect(next).toBeDisabled();
    expect(last).toBeDisabled();

    fireEvent.click(prev);
    expect(screen.getByText("Page 3 of 4 · 39 rows")).toBeInTheDocument();

    fireEvent.click(first);
    expect(screen.getByText("Page 1 of 4 · 39 rows")).toBeInTheDocument();
  });

  it("cycles a header click none → desc → asc → none and tracks aria-sort", () => {
    const unsorted = [
      { week: "w1", orders: 5 },
      { week: "w2", orders: 9 },
      { week: "w3", orders: 1 },
    ];
    render(<DataTable rows={unsorted} pageSize={10} />);
    const orders = header("Orders");
    const button = screen.getByRole("button", { name: "Orders" });

    expect(orders).toHaveAttribute("aria-sort", "none");

    fireEvent.click(button);
    expect(orders).toHaveAttribute("aria-sort", "descending");
    expect(visibleWeeks()).toEqual(["w2", "w1", "w3"]);

    fireEvent.click(button);
    expect(orders).toHaveAttribute("aria-sort", "ascending");
    expect(visibleWeeks()).toEqual(["w3", "w1", "w2"]);

    fireEvent.click(button);
    expect(orders).toHaveAttribute("aria-sort", "none");
    expect(visibleWeeks()).toEqual(["w1", "w2", "w3"]);
  });

  it("moves the sort to a newly clicked column, restarting at desc", () => {
    render(<DataTable rows={ROWS.slice(0, 3)} pageSize={10} />);

    fireEvent.click(screen.getByRole("button", { name: "Orders" }));
    fireEvent.click(screen.getByRole("button", { name: "Week" }));

    expect(header("Orders")).toHaveAttribute("aria-sort", "none");
    expect(header("Week")).toHaveAttribute("aria-sort", "descending");
    expect(visibleWeeks()).toEqual(["w3", "w2", "w1"]);
  });

  it("returns to page 1 when the sort changes", () => {
    render(<DataTable rows={ROWS} pageSize={10} />);
    fireEvent.click(screen.getByRole("button", { name: "Last page" }));
    expect(screen.getByText("Page 4 of 4 · 39 rows")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Orders" }));

    expect(screen.getByText("Page 1 of 4 · 39 rows")).toBeInTheDocument();
  });

  it("clamps the page when rows shrink under the current page", () => {
    const { rerender } = render(<DataTable rows={ROWS} pageSize={10} />);
    fireEvent.click(screen.getByRole("button", { name: "Last page" }));

    rerender(<DataTable rows={ROWS.slice(0, 11)} pageSize={10} />);

    expect(screen.getByText("Page 2 of 2 · 11 rows")).toBeInTheDocument();
    expect(visibleWeeks()[0]).toBe("w11");
  });

  it("aligns a numeric column's header and every cell right, null cells included", () => {
    render(
      <DataTable
        rows={[
          { label: "x", n: null, big: 5n },
          { label: "y", n: 5, big: 6n },
        ]}
      />,
    );

    const [label, n, big] = screen.getAllByRole("columnheader");
    expect(label).toHaveClass("text-left");
    expect(n).toHaveClass("text-right");
    expect(big).toHaveClass("text-right");
    for (const tr of screen.getAllByRole("row").slice(1)) {
      const [text, ...figures] = (tr as HTMLTableRowElement).cells;
      expect(text).toHaveClass("text-left");
      for (const td of figures) expect(td).toHaveClass("text-right");
    }
  });

  it("leads a right-aligned header with its sort glyph and trails a left one", () => {
    render(<DataTable rows={[{ region: "West", orders: 140 }]} />);

    const region = screen.getByRole("button", { name: "Region" });
    const orders = screen.getByRole("button", { name: "Orders" });
    expect(region.lastElementChild?.tagName).toBe("svg");
    expect(orders).toHaveClass("flex-row-reverse", "text-right");
    expect(region).toHaveClass("text-left");
    expect(region).not.toHaveClass("flex-row-reverse");
  });

  it("sets its figures in tabular numerals so digits line up by column", () => {
    render(<DataTable rows={[{ region: "West", orders: 140 }]} />);

    expect(screen.getByRole("table").className.split(" ")).toContain(
      "tabular-nums",
    );
  });

  it("renders numbers num0 and nulls empty by default", () => {
    render(<DataTable rows={[{ region: "West", revenue: 6100, gap: null }]} />);

    const cells = screen.getAllByRole("cell").map((td) => td.textContent);
    expect(cells).toEqual(["West", "6,100", ""]);
  });

  it("shows the given columns in their order, titles and formats", () => {
    const rows = [{ region: "West", revenue: 6100, share: 0.394 }];
    const columns = resolveTableColumns(rows, [
      { id: "share", fmt: "pct1", title: "Share" },
      { id: "region" },
    ]);
    render(<DataTable rows={rows} columns={columns} />);

    const headers = screen.getAllByRole("columnheader");
    expect(headers.map((th) => th.textContent)).toEqual(["Share", "Region"]);
    const cells = screen.getAllByRole("cell").map((td) => td.textContent);
    expect(cells).toEqual(["39.4%", "West"]);
  });

  it("sorts a titled column by its raw values, not its text", () => {
    const rows = [
      { week: "w1", revenue: 900 },
      { week: "w2", revenue: 12000 },
      { week: "w3", revenue: 4500 },
    ];
    const columns = resolveTableColumns(rows, [
      { id: "week" },
      { id: "revenue", fmt: "usd", title: "Revenue" },
    ]);
    render(<DataTable rows={rows} columns={columns} />);

    fireEvent.click(screen.getByRole("button", { name: "Revenue" }));

    expect(header("Revenue")).toHaveAttribute("aria-sort", "descending");
    expect(visibleWeeks()).toEqual(["w2", "w3", "w1"]);
  });
});
