import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { withQueryData } from "../../../../.storybook/decorators";
import { dbWith, KPI, KPI_ROWS } from "../value/big-value.fixture";
import { Value } from "../value/value";
import { Callout } from "./callout";
import type { CalloutProps, CalloutType } from "./types";

const meta = {
  title: "Widgets/Callout",
  component: Callout,
  args: {
    children:
      "Growth this week concentrated in the West, where one wholesale account contributed nearly a third of the lift.",
  },
} satisfies Meta<CalloutProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The authored shape: `type` picks the tint, `title` leads the panel. */
export const Info: Story = {
  args: { type: "info", title: "Report info" },
  play: async ({ canvas }) => {
    const note = canvas.getByRole("note");
    await expect(note.className).toContain("bg-info-surface");
    await expect(
      canvas.getByRole("heading", { name: "Report info" }),
    ).toBeInTheDocument();
  },
};

/** `success` tints green — emerald stands in for evidence's `fern`. */
export const Success: Story = {
  args: { type: "success", title: "All systems normal" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("note").className).toContain(
      "bg-success-surface",
    );
  },
};

/** `warning` tints amber. */
export const Warning: Story = {
  args: { type: "warning", title: "Concentration risk" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("note").className).toContain(
      "bg-warning-surface",
    );
  },
};

/** `error` tints red. */
export const ErrorVariant: Story = {
  args: { type: "error", title: "Data quality" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("note").className).toContain(
      "bg-destructive-surface",
    );
  },
};

/** `title` unset renders body text with no heading. */
export const Untitled: Story = {
  args: { type: "info" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("note")).toBeInTheDocument();
    await expect(canvas.queryByRole("heading")).toBeNull();
  },
};

/** The message is Markdown: emphasis and inline `<Value>`s read the page's queries. */
export const WithWidgets: Story = {
  args: {
    title: "At a glance",
    children: (
      <>
        The dataset holds <em>every</em> order:{" "}
        <Value data="kpi" column="orders" /> of them, worth{" "}
        <Value data="kpi" column="revenue" fmt="usd" />.
      </>
    ),
  },
  decorators: [withQueryData([KPI], dbWith(KPI_ROWS))],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("355")).toBeInTheDocument();
    await expect(await canvas.findByText("$1.2M")).toBeInTheDocument();
    await expect(canvas.getByText("every").tagName).toBe("EM");
  },
};

/** Under `.dark` the solid washes become alpha tints. */
export const Dark: Story = {
  args: { type: "warning", title: "Concentration risk" },
  globals: { theme: "dark" },
  play: async ({ canvas }) => {
    const note = canvas.getByRole("note");
    const style = getComputedStyle(note);
    await expect(style.getPropertyValue("--warning-surface")).toBe("#f0b1001a");
    await expect(style.getPropertyValue("--warning-foreground")).toBe(
      "#fff085",
    );
  },
};

/** A `type` outside the schema renders a named inline alert — MDX props
 * bypass the type system, so the check runs at render time. */
export const InvalidType: Story = {
  args: { type: "tip" as CalloutType, title: "ignored" },
  play: async ({ canvas }) => {
    const alert = canvas.getByRole("alert");
    await expect(alert).toHaveTextContent('"tip"');
    await expect(canvas.queryByRole("note")).toBeNull();
  },
};
