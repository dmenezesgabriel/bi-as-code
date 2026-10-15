import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { carrierChildrenEls } from "./carrier-children.fixture";
import { Tab, Tabs } from "./tabs";
import type { TabProps, TabsProps, TabsVariant } from "./types";

const tabEls = (
  specs: ReadonlyArray<readonly [string, string, Partial<TabProps>?]>,
) => carrierChildrenEls(Tab, specs);

const TWO_TABS = tabEls([
  ["Chart", "chart panel"],
  ["Table", "table panel"],
]);

function renderTabs(
  children: ReactNode = TWO_TABS,
  props: Partial<TabsProps> = {},
) {
  return render(<Tabs {...(props as TabsProps)}>{children}</Tabs>);
}

const tab = (name: string) => screen.getByRole("tab", { name });
const panelOf = (text: string) =>
  screen.getByText(text).closest("[role=tabpanel]");

describe("Tabs", () => {
  it("renders a tablist with one tab per <Tab> title; the first is selected", () => {
    renderTabs();

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(tab("Chart")).toHaveAttribute("aria-selected", "true");
    expect(tab("Table")).toHaveAttribute("aria-selected", "false");
    expect(panelOf("chart panel")).toBeVisible();
  });

  it("keeps inactive panels mounted but hidden", () => {
    renderTabs();

    const tablePanel = panelOf("table panel");
    expect(tablePanel).toBeInTheDocument();
    expect(tablePanel).toHaveAttribute("hidden");
  });

  it("switches panels on click", () => {
    renderTabs();

    fireEvent.click(tab("Table"));
    expect(tab("Table")).toHaveAttribute("aria-selected", "true");
    expect(tab("Chart")).toHaveAttribute("aria-selected", "false");
    expect(panelOf("chart panel")).toHaveAttribute("hidden");
    expect(panelOf("table panel")).not.toHaveAttribute("hidden");
  });

  it("preserves panel contents across switches (keepMounted)", () => {
    renderTabs(
      tabEls([
        ["One", "one"],
        ["Other", "other"],
      ]).map((el, i) =>
        i === 0 ? (
          <Tab key={0} title="One">
            <input aria-label="filter" />
          </Tab>
        ) : (
          el
        ),
      ),
    );

    const input = screen.getByLabelText("filter");
    fireEvent.change(input, { target: { value: "typed" } });
    fireEvent.click(tab("Other"));
    fireEvent.click(tab("One"));

    expect(input).toHaveValue("typed");
  });

  it("starts on the tab marked default", () => {
    renderTabs(
      tabEls([
        ["One", "one"],
        ["Two", "two", { default: true }],
      ]),
    );

    expect(tab("Two")).toHaveAttribute("aria-selected", "true");
    expect(panelOf("two")).not.toHaveAttribute("hidden");
  });

  it("renders an inline alert when more than one tab sets default", () => {
    renderTabs(
      tabEls([
        ["One", "one", { default: true }],
        ["Two", "two", { default: true }],
      ]),
    );

    expect(screen.getByRole("alert")).toHaveTextContent("default");
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("renders an inline alert for a non-Tab element child", () => {
    renderTabs([
      <Tab key="one" title="One">
        one
      </Tab>,
      <p key="stray">stray paragraph</p>,
    ]);

    expect(screen.getByRole("alert")).toHaveTextContent("Tab");
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("renders an inline alert for a non-whitespace text child", () => {
    renderTabs([
      "stray text",
      <Tab key="one" title="One">
        one
      </Tab>,
    ]);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("skips whitespace-only text children", () => {
    renderTabs([
      " ",
      <Tab key="one" title="One">
        one
      </Tab>,
      "\n",
      <Tab key="two" title="Two">
        two
      </Tab>,
    ]);

    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("renders an inline alert when a Tab lacks a title", () => {
    // `title` is required in TabProps; the cast mirrors the untyped MDX call.
    renderTabs(<Tab {...({ children: "orphan" } as TabProps)} />);

    expect(screen.getByRole("alert")).toHaveTextContent("title");
  });

  it("renders an inline alert when empty", () => {
    renderTabs(null);

    expect(screen.getByRole("alert")).toHaveTextContent("Tabs");
  });

  it("renders an inline alert for an unknown variant", () => {
    renderTabs(TWO_TABS, { variant: "fancy" as TabsVariant });

    expect(screen.getByRole("alert")).toHaveTextContent("variant");
    expect(screen.getByRole("alert")).toHaveTextContent("fancy");
  });

  it("applies the default-variant list classes (full-width bottom border)", () => {
    renderTabs();

    const list = screen.getByRole("tablist");
    expect(list.className).toContain("border-b");
    expect(list.className).toContain("w-full");
  });

  it("applies the well-variant list classes (fitted pill track)", () => {
    renderTabs(TWO_TABS, { variant: "well" });

    const list = screen.getByRole("tablist");
    expect(list.className).toContain("bg-accent");
    expect(list.className).toContain("w-fit");
    expect(list.className).toContain("rounded-lg");
  });

  it("applies fullWidth classes to list and triggers", () => {
    renderTabs(TWO_TABS, { fullWidth: true });

    expect(screen.getByRole("tablist").className).toContain("justify-center");
    expect(tab("Chart").className).toContain("flex-1");
  });
});

describe("Tab", () => {
  it("renders an inline alert outside <Tabs>", () => {
    render(<Tab title="Alone">content</Tab>);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Tab");
    expect(alert).toHaveTextContent("Tabs");
    expect(screen.queryByText("content")).toBeNull();
  });
});
