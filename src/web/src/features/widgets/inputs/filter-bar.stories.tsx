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
 * floating adds padding/color without shifting layout. */
export const Default: Story = {
  play: async ({ canvas }) => {
    const bar = canvas.getByText("Region").parentElement!;
    for (const cls of [
      "sticky",
      "top-(--dock-top,4rem)",
      "flex-row",
      "items-end",
      "gap-4",
    ]) {
      await expect(bar.className).toContain(cls);
    }
    await expect(bar.className).toContain("border-transparent");
    await expect(bar.className).not.toContain(" bg-white");
  },
};

const scrollPort = new FakeFilterUrlPort("");

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

/** The pin behavior in a real browser: past the sentinel the bar docks
 * 64px under the viewport top and gains the card face; inputs inside keep
 * writing `?id=` params; back at the top the card face drops. */
export const FloatsOnScroll: Story = {
  decorators: [withPageFilters(scrollPort)],
  render: () => (
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
  ),
  play: async ({ canvas }) => {
    const bar = canvas.getByLabelText("Region").closest(".sticky")!;
    await expect(bar.className).toContain("border-transparent");

    await firstIntersectionReading(bar.previousElementSibling!);
    window.scrollTo(0, 600);
    await waitFor(() => expect(bar.className).toContain(" bg-white"));
    await expect(bar.className).toContain("shadow");
    expect(Math.round(bar.getBoundingClientRect().top)).toBe(64);

    const toggle = canvas.getByRole("switch", { name: "Large orders" });
    await userEvent.click(toggle);
    await waitFor(() =>
      expect(scrollPort.read()?.searchParams.get("large_orders")).toBe("true"),
    );

    window.scrollTo(0, 0);
    await waitFor(() => expect(bar.className).toContain("border-transparent"));
    await expect(bar.className).not.toContain(" bg-white");
  },
};
