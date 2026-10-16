import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { ChartHeading } from "./chart-heading";

const meta = {
  title: "Widgets/Charts/ChartHeading",
  component: ChartHeading,
  args: { titleId: "chart-title", title: "Revenue by region" },
} satisfies Meta<typeof ChartHeading>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A title alone: one bold line naming the chart, never a heading role. */
export const TitleOnly: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Revenue by region")).toHaveAttribute(
      "id",
      "chart-title",
    );
    await expect(canvas.queryByRole("heading")).toBeNull();
  },
};

/** The subtitle sits under the title in the muted foreground. */
export const TitleAndSubtitle: Story = {
  args: { subtitle: "Sum of order amounts, US dollars" },
  play: async ({ canvas }) => {
    const title = canvas.getByText("Revenue by region");
    const subtitle = canvas.getByText("Sum of order amounts, US dollars");
    await expect(subtitle.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      title.getBoundingClientRect().bottom,
    );
    await expect(getComputedStyle(subtitle).color).not.toBe(
      getComputedStyle(title).color,
    );
  },
};

/** At a phone's content width (375 px less the page gutters) a long title
 * wraps inside the chart's box instead of widening the page. */
export const LongTitleNarrow: Story = {
  args: {
    title:
      "Orders and revenue per region-week across the whole quarter, every region",
    subtitle: "One point per region and week; revenue in US dollars",
  },
  decorators: [
    (Story) => (
      <div data-testid="narrow" style={{ width: 327 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas }) => {
    const box = canvas.getByTestId("narrow");
    const title = canvas.getByText(/^Orders and revenue/);
    await expect(box.scrollWidth).toBe(box.clientWidth);
    await expect(title.getBoundingClientRect().height).toBeGreaterThan(
      parseFloat(getComputedStyle(title).lineHeight),
    );
  },
};
