import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { CompileErrorPage } from "./compile-error-page";

const UNCLOSED_TAG =
  "Unexpected end of file after name, expected a character that can start an attribute name, such as a letter, `$`, or `_`; whitespace before attributes; or the end of the tag";

const meta: Meta<typeof CompileErrorPage> = {
  title: "Pages/CompileErrorPage",
  component: CompileErrorPage,
  args: {
    error: {
      file: "pages/weekly-review.md",
      message: UNCLOSED_TAG,
      line: 9,
      column: 1,
    },
  },
};

export default meta;

type Story = StoryObj<typeof CompileErrorPage>;

/** An MDX syntax error names the file, the line and the column. */
export const AtAPosition: Story = {
  play: async ({ canvas }) => {
    const alert = canvas.getByRole("alert");
    await expect(
      canvas.getByRole("heading", { name: "This page failed to compile" }),
    ).toBeVisible();
    await expect(alert).toHaveTextContent("pages/weekly-review.md:9:1");
    await expect(canvas.getByText(UNCLOSED_TAG)).toBeVisible();
  },
};

/** A front-matter rule has no position: the file alone is the location. */
export const WithoutAPosition: Story = {
  args: {
    error: {
      file: "pages/weekly-review.md",
      message:
        'Invalid front-matter in pages/weekly-review.md — sql.orders: expected a name not already declared by biac.config.ts ("data/orders.csv"), got "data/other.csv"',
    },
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText("pages/weekly-review.md", { exact: true }),
    ).toBeVisible();
  },
};

/** A long, multi-line message wraps inside the page instead of widening it. */
export const LongMessageWraps: Story = {
  args: {
    error: {
      file: "pages/weekly-review.md",
      message: `Flow sequence in block collection must be sufficiently indented and end with a ] at line 1, column 17:\n\ntitle: [unclosed\n                ^\n${"x".repeat(400)}`,
    },
  },
  play: async ({ canvas }) => {
    const message = canvas.getByText(/Flow sequence in block collection/);
    await expect(message.scrollWidth).toBeLessThanOrEqual(message.clientWidth);
  },
};

/** Dark mode keeps the message legible on its darker panel. */
export const Dark: Story = {
  globals: { theme: "dark" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toBeVisible();
  },
};
