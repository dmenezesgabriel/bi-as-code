import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { expect, userEvent } from "storybook/test";
import { Details } from "./details";
import type { DetailsProps } from "./types";

const meta = {
  title: "Widgets/Details",
  component: Details,
  args: {
    title: "Metric definitions",
    children:
      "Sales includes all core products in all regions. Sales growth is the year-over-year delta of that figure.",
  },
} satisfies Meta<DetailsProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The authored shape: a chevron-led trigger, panel collapsed until clicked. */
export const Closed: Story = {
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Metric definitions" });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(canvas.queryByText(/Sales includes/)).toBeNull();
    // WCAG 2.2 SC 2.5.8: a stacked trigger needs a 24 px tall box.
    const { height } = trigger.getBoundingClientRect();
    await expect(height).toBeGreaterThanOrEqual(24);
  },
};

/** `open` starts the panel expanded. */
export const StartsOpen: Story = {
  args: { open: true },
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Metric definitions" });
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(canvas.getByText(/Sales includes/)).toBeInTheDocument();
  },
};

/** Answers every media query as a phone-width window would, until unmounted —
 * `useMediaQuery` reads `window.matchMedia`, which a story iframe cannot narrow. */
function PhoneWidth({ children }: { children: ReactNode }): ReactElement {
  const [realMatchMedia] = useState(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      const mql = real(query);
      return new Proxy(mql, {
        get: (target, key) => {
          if (key === "matches") return query.includes("max-width");
          const member: unknown = Reflect.get(target, key, target);
          return typeof member === "function" ? member.bind(target) : member;
        },
      });
    };
    return real;
  });
  useEffect(
    () => () => {
      window.matchMedia = realMatchMedia;
    },
    [realMatchMedia],
  );
  return <>{children}</>;
}

/** `openMobile` wins over `open` on a window narrower than 768 px: this one starts expanded. */
export const OpenMobile: Story = {
  args: { openMobile: true },
  decorators: [
    (Story) => (
      <PhoneWidth>
        <Story />
      </PhoneWidth>
    ),
  ],
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Metric definitions" });
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
  },
};

/** Click toggles the panel; the chevron follows `data-panel-open`. */
export const ToggleInteraction: Story = {
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Metric definitions" });

    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(trigger).toHaveAttribute("data-panel-open");
    await expect(canvas.getByText(/Sales includes/)).toBeInTheDocument();

    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).not.toHaveAttribute("data-panel-open");
  },
};

/** A missing `title` renders the family's inline alert — MDX props bypass
 * the type system, so the required-prop check runs at render time. */
export const MissingTitle: Story = {
  args: { title: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Details");
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

/** Under `.dark` the trigger repaints in the dark palette. */
export const Dark: Story = {
  globals: { theme: "dark" },
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Metric definitions" });
    await expect(getComputedStyle(trigger).getPropertyValue("--label")).toBe(
      "#d4d4d4",
    );
  },
};
