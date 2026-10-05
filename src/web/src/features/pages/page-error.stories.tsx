import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { PageError } from "./page-error";

const meta: Meta<typeof PageError> = {
  title: "Pages/PageError",
  component: PageError,
  args: { error: new Error("select * fro m orders — syntax error") },
};

export default meta;

type Story = StoryObj<typeof PageError>;

/** A thrown page renders the error's message in-place, not a blank screen. */
export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", {
        name: "This page failed to render",
      }),
    ).toBeVisible();
    await expect(canvas.getByText(/syntax error/)).toBeVisible();
  },
};

/** Non-Error throws stringify the same way. */
export const StringError: Story = {
  args: { error: "boom" as unknown as Error },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("boom")).toBeVisible();
  },
};
