import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import { withPageFilters } from "../../../../.storybook/decorators";
import { FilterBar } from "./filter-bar";
import { TextInput } from "./text-input";
import { Toggle } from "./toggle";
import type { FilterBarProps } from "./types";

const field = (label: string) => (
  <div
    key={label}
    className="mb-4 flex h-9 w-40 items-center rounded-md border border-neutral-300 px-3 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
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
    for (const cls of ["flex-row", "items-end", "gap-4"]) {
      await expect(inputs.className).toContain(cls);
    }
    await expect(bar.className).toContain("top-(--dock-top,4rem)");
    await expect(bar.className).toContain("border-transparent");
    await expect(bar.className).not.toContain(" bg-white");
    await expect(canvas.queryByRole("button", { name: "Filters" })).toBeNull();
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

/** A page long enough to scroll the bar past its dock line. */
function ScrollingReport() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Weekly review</h1>
      <p className="mb-8 max-w-prose text-sm text-neutral-600 dark:text-neutral-400">
        The lead-in keeps the sentinel inside the viewport at rest — the bar's
        card face must appear only once the bar has actually docked, never on
        first paint.
      </p>
      <FilterBar>
        <TextInput id="region" title="Region" />
        <Toggle id="large_orders" label="Large orders" />
      </FilterBar>
      <div className="text-sm text-neutral-500" style={{ height: "200vh" }}>
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
    await expect(bar.className).toContain(" bg-white");
    await expect(bar.className).toContain("shadow");
    expect(Math.round(bar.getBoundingClientRect().top)).toBe(64);

    window.scrollTo(0, 0);
    await waitFor(() => expect(bar.className).toContain("border-transparent"));
    await expect(bar.className).not.toContain(" bg-white");
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
