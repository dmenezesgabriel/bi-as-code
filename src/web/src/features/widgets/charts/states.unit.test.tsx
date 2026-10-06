import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { QueryResult } from "../../pages/types";
import { ColumnError, FormatError } from "../value/types";
import { ChartEmpty, ChartError, ChartLoading, ChartResult } from "./states";

const SUCCESS: QueryResult = { status: "success", rows: [{ a: 1 }] };

describe("chart states", () => {
  it("sizes the loading pulse to the chart height", () => {
    render(<ChartLoading height={260} />);
    const status = screen.getByRole("status", { name: "Loading query result" });
    expect(status).toHaveStyle({ height: "260px" });
  });

  it("names the query in the error alert", () => {
    render(<ChartError name="orders" message="boom" height={300} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("orders");
    expect(alert).toHaveTextContent("boom");
  });

  it("renders the empty face at chart height", () => {
    render(<ChartEmpty height={200} />);
    const empty = screen.getByText("0 rows");
    expect(empty.closest("[data-chart-empty]")).toHaveStyle({
      height: "200px",
    });
  });
});

describe("<ChartResult>", () => {
  it("alerts when the data name has no registered fence", () => {
    render(
      <ChartResult name="typo" result={undefined} height={300}>
        {() => null}
      </ChartResult>,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("typo");
    expect(alert).toHaveTextContent("no sql fence");
  });

  it("shows the loading face while the query is in flight", () => {
    render(
      <ChartResult name="orders" result={{ status: "loading" }} height={300}>
        {() => null}
      </ChartResult>,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("surfaces a query error as the alert", () => {
    const result: QueryResult = {
      status: "error",
      message: "Catalog Error: Table orders does not exist",
    };
    render(
      <ChartResult name="orders" result={result} height={300}>
        {() => null}
      </ChartResult>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Table orders does not exist",
    );
  });

  it("hands successful rows to the children projection", () => {
    render(
      <ChartResult name="orders" result={SUCCESS} height={300}>
        {(rows) => <div data-testid="body">{rows.length}</div>}
      </ChartResult>,
    );
    expect(screen.getByTestId("body")).toHaveTextContent("1");
  });

  it("renders ColumnError and FormatError from the projection as alerts", () => {
    const { rerender } = render(
      <ChartResult name="orders" result={SUCCESS} height={300}>
        {() => {
          throw new ColumnError({ column: "revenu", available: ["revenue"] });
        }}
      </ChartResult>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      'column "revenu" is not in the result',
    );

    rerender(
      <ChartResult name="orders" result={SUCCESS} height={300}>
        {() => {
          throw new FormatError({ code: "bogus", detail: "unknown code" });
        }}
      </ChartResult>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("fmt=");
  });

  it("rethrows errors that are not author-facing", () => {
    expect(() =>
      render(
        <ChartResult name="orders" result={SUCCESS} height={300}>
          {() => {
            throw new TypeError("unexpected");
          }}
        </ChartResult>,
      ),
    ).toThrow("unexpected");
  });
});
