import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { expect, userEvent, waitFor } from "storybook/test";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import { FakeDuckDb } from "../../data/fake-duckdb";
import {
  withPageFilters,
  withQueryData,
} from "../../../../.storybook/decorators";
import { FilterBar } from "./filter-bar";
import { Slider } from "./slider";
import { TextInput } from "./text-input";
import { Toggle } from "./toggle";
import type { FilterBarProps } from "./types";

const field = (label: string) => (
  <div
    key={label}
    className="mb-4 flex h-9 w-40 items-center rounded-md border border-input px-3 text-sm text-muted-foreground-faded"
  >
    {label}
  </div>
);

const meta = {
  title: "Widgets/FilterBar",
  component: FilterBar,
  args: {
    children: [field("Region"), field("Amount"), field("Ordered")],
  },
} satisfies Meta<FilterBarProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The authored shape: children share one horizontal line, ends aligned,
 * no card chrome at rest — `border-transparent` keeps the border's 1px so
 * floating adds color without shifting layout — and no `Filters` trigger:
 * at rest the bar is page content and shows every input. */
export const Default: Story = {
  // The bar rests only while its sentinel — one dock offset (4rem) above
  // it — is on screen, so it needs that much page above it, as a page's
  // title gives it; flush against the canvas top it would dock at once.
  decorators: [
    (Story) => (
      <div className="pt-20">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas }) => {
    const inputs = canvas.getByText("Region").parentElement!;
    const bar = inputs.closest(".sticky")!;
    await firstIntersectionReading(bar.previousElementSibling!);
    for (const cls of ["flex-row", "items-start", "gap-4"]) {
      await expect(inputs.className).toContain(cls);
    }
    await expect(bar.className).toContain("top-(--dock-top,4rem)");
    await expect(bar.className).toContain("border-transparent");
    await expect(bar.className).not.toContain(" bg-background");
    await expect(canvas.queryByRole("button", { name: "Filters" })).toBeNull();
  },
};

/** A slider whose domain collapsed to one value keeps the label line and
 * the 64 px footprint of a live slider, so its neighbours' labels and the
 * row's height stay where they were. */
export const PinnedSliderOnLabelLine: Story = {
  args: {
    children: [
      <TextInput key="region" id="region" title="Region" />,
      <Slider key="amount" id="amount" title="Amount" min={40} max={40} />,
    ],
  },
  decorators: [
    withQueryData([], FakeDuckDb.withRows([])),
    withPageFilters(new FakeFilterUrlPort("")),
    (Story) => (
      <div className="pt-20">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas }) => {
    const note = await canvas.findByText("only one value in range");
    const top = (text: string) =>
      canvas.getByText(text).getBoundingClientRect().top;
    await expect(top("Amount")).toBe(top("Region"));
    await expect(note.parentElement!.getBoundingClientRect().height).toBe(64);
  },
};

/**
 * Resolves once an IntersectionObserver has delivered its first reading of
 * `target`. Observers notify in creation order, so by then the FilterBar's
 * own observer (created at mount) has delivered its first reading too. A
 * scroll issued before that reading can leave Chromium with only the stale
 * pre-scroll one and no follow-up, and the bar never docks.
 */
function firstIntersectionReading(target: Element): Promise<void> {
  return new Promise((resolve) => {
    const observer = new IntersectionObserver(() => {
      observer.disconnect();
      resolve();
    });
    observer.observe(target);
  });
}

const TWO_INPUTS = (
  <>
    <TextInput id="region" title="Region" />
    <Toggle id="large_orders" label="Large orders" />
  </>
);

/** A page long enough to scroll the bar past its dock line. */
function ScrollingReport({ inputs = TWO_INPUTS }: { inputs?: ReactNode }) {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Weekly review</h1>
      <p className="mb-8 max-w-prose text-sm text-muted-foreground">
        The lead-in keeps the sentinel inside the viewport at rest — the bar's
        card face must appear only once the bar has actually docked, never on
        first paint.
      </p>
      <FilterBar>{inputs}</FilterBar>
      <div
        className="text-sm text-muted-foreground-faded"
        style={{ height: "200vh" }}
      >
        Report content scrolls beneath the pinned bar.
      </div>
    </>
  );
}

type Canvas = Parameters<NonNullable<Story["play"]>>[0]["canvas"];

function stickyBar(canvas: Canvas): Element {
  return canvas.getByLabelText("Region").closest(".sticky")!;
}

/** Scrolls past the sentinel and resolves once the bar shows its docked
 * face, returning the bar. */
async function dockBar(canvas: Canvas): Promise<Element> {
  const bar = stickyBar(canvas);
  await firstIntersectionReading(bar.previousElementSibling!);
  window.scrollTo(0, 600);
  await canvas.findByRole("button", { name: "Filters" });
  return bar;
}

/** The pin behavior in a real browser: past the sentinel the bar docks
 * 64px under the viewport top and gains the card face; back at the top the
 * card face drops and the inputs are page content again. */
export const FloatsOnScroll: Story = {
  decorators: [withPageFilters(new FakeFilterUrlPort(""))],
  render: () => <ScrollingReport />,
  play: async ({ canvas }) => {
    await expect(stickyBar(canvas).className).toContain("border-transparent");

    const bar = await dockBar(canvas);
    await expect(bar.className).toContain(" bg-background");
    await expect(bar.className).toContain("shadow");
    expect(Math.round(bar.getBoundingClientRect().top)).toBe(64);

    window.scrollTo(0, 0);
    await waitFor(() => expect(bar.className).toContain("border-transparent"));
    await expect(bar.className).not.toContain(" bg-background");
    await expect(canvas.queryByRole("button", { name: "Filters" })).toBeNull();
    await expect(canvas.getByLabelText("Region")).toBeVisible();
  },
};

/** Docked, the bar is one `Filters` row: the inputs stay mounted but leave
 * the accessibility tree, and the page keeps the height the bar gave up —
 * its scroll height and scroll position do not move at the dock moment. */
export const DockedCollapsed: Story = {
  decorators: [withPageFilters(new FakeFilterUrlPort(""))],
  render: () => <ScrollingReport />,
  play: async ({ canvas }) => {
    const pageHeightAtRest = document.documentElement.scrollHeight;

    const bar = await dockBar(canvas);

    const trigger = canvas.getByRole("button", { name: "Filters" });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).not.toHaveAccessibleDescription();
    await expect(canvas.queryByRole("switch")).toBeNull();
    await expect(canvas.getByLabelText("Region")).not.toBeVisible();
    expect(bar.getBoundingClientRect().height).toBeLessThanOrEqual(56);
    expect(trigger.getBoundingClientRect().height).toBeGreaterThanOrEqual(24);
    expect(document.documentElement.scrollHeight).toBe(pageHeightAtRest);
    expect(window.scrollY).toBe(600);
  },
};

const openedPort = new FakeFilterUrlPort("");

/** Opening the docked bar lays the inputs over the page in a card: they
 * keep writing `?id=` params, the bar itself stays one row, and nothing in
 * the page's flow moves. Back at rest the value is still set. */
export const DockedOpened: Story = {
  decorators: [withPageFilters(openedPort)],
  render: () => <ScrollingReport />,
  play: async ({ canvas }) => {
    const pageHeightAtRest = document.documentElement.scrollHeight;
    const bar = await dockBar(canvas);
    const trigger = canvas.getByRole("button", { name: "Filters" });

    await userEvent.click(trigger);

    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const toggle = canvas.getByRole("switch", { name: "Large orders" });
    await userEvent.click(toggle);
    await waitFor(() =>
      expect(openedPort.read()?.searchParams.get("large_orders")).toBe("true"),
    );
    expect(bar.getBoundingClientRect().height).toBeLessThanOrEqual(56);
    expect(document.documentElement.scrollHeight).toBe(pageHeightAtRest);

    window.scrollTo(0, 0);
    await waitFor(() =>
      expect(canvas.queryByRole("button", { name: "Filters" })).toBeNull(),
    );
    await expect(
      canvas.getByRole("switch", { name: "Large orders" }),
    ).toBeChecked();
  },
};

/** A collapsed row hides its inputs, not their effect: the trigger counts
 * the inputs whose filter is applied. The count is the button's description, so
 * its name stays `Filters`; it follows an input switched off through the
 * opened bar and disappears at zero. */
export const DockedActiveCount: Story = {
  decorators: [
    withPageFilters(new FakeFilterUrlPort("?region=West&large_orders=true")),
  ],
  render: () => <ScrollingReport />,
  play: async ({ canvas }) => {
    const bar = await dockBar(canvas);
    const trigger = canvas.getByRole("button", { name: "Filters" });

    await expect(trigger).toHaveAccessibleDescription("2 active");
    await expect(trigger).toHaveTextContent(/· 2/);
    expect(bar.getBoundingClientRect().height).toBeLessThanOrEqual(56);

    await userEvent.click(trigger);
    await userEvent.click(canvas.getByRole("switch", { name: "Large orders" }));
    await expect(trigger).toHaveAccessibleDescription("1 active");

    await userEvent.clear(canvas.getByLabelText("Region"));
    await waitFor(() => expect(trigger).not.toHaveAccessibleDescription());
  },
};

/** The ways out of the opened docked bar besides its trigger: `Escape`
 * collapses it and hands focus back to `Filters`; a press on the page
 * around it collapses it. */
export const DockedDismissal: Story = {
  decorators: [withPageFilters(new FakeFilterUrlPort(""))],
  render: () => <ScrollingReport />,
  play: async ({ canvas }) => {
    await dockBar(canvas);
    const trigger = canvas.getByRole("button", { name: "Filters" });

    await userEvent.click(trigger);
    await userEvent.click(canvas.getByLabelText("Region"));
    await userEvent.keyboard("{Escape}");

    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toHaveFocus();

    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(canvas.getByText(/Report content scrolls/));

    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  },
};

/** A reader typing in an input when the bar reaches its dock line keeps
 * that input: the bar docks opened, focus intact, instead of collapsing
 * over the control in use. */
export const DocksOpenedWhileFocused: Story = {
  decorators: [withPageFilters(new FakeFilterUrlPort(""))],
  render: () => <ScrollingReport />,
  play: async ({ canvas }) => {
    const region = canvas.getByLabelText("Region");
    await firstIntersectionReading(stickyBar(canvas).previousElementSibling!);
    region.focus();

    window.scrollTo(0, 600);

    const trigger = await canvas.findByRole("button", { name: "Filters" });
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(region).toBeVisible();
    await expect(region).toHaveFocus();
  },
};

const MANY_INPUTS = [
  "Region",
  "Channel",
  "Segment",
  "Product",
  "Owner",
  "Status",
  "Country",
  "Campaign",
].map((title) => (
  <TextInput key={title} id={title.toLowerCase()} title={title} />
));

/** More inputs than half the viewport holds, on a phone-width page: the
 * opened docked bar stops at half the viewport and its inputs scroll
 * inside the card, so the report below stays readable. */
export const DockedOpenedNarrow: Story = {
  decorators: [
    withPageFilters(new FakeFilterUrlPort("")),
    (Story) => (
      <div className="max-w-[375px]">
        <Story />
      </div>
    ),
  ],
  render: () => <ScrollingReport inputs={MANY_INPUTS} />,
  play: async ({ canvas }) => {
    const bar = await dockBar(canvas);
    await userEvent.click(canvas.getByRole("button", { name: "Filters" }));

    const panel = canvas.getByLabelText("Region").closest("[data-open]")!;
    const openedBottom = panel.getBoundingClientRect().bottom;
    const openedHeight = openedBottom - bar.getBoundingClientRect().top;
    expect(openedHeight).toBeLessThanOrEqual(window.innerHeight / 2);
    expect(panel.scrollHeight).toBeGreaterThan(panel.clientHeight);
    expect(panel.scrollWidth).toBe(panel.clientWidth);
  },
};
