import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { withMemoryRouter } from "../../../.storybook/decorators";
import { NotFoundPage } from "./not-found-page";

const meta: Meta<typeof NotFoundPage> = {
  title: "Pages/NotFoundPage",
  component: NotFoundPage,
  decorators: [withMemoryRouter(["/"], "/missing-route")],
};

export default meta;

type Story = StoryObj<typeof NotFoundPage>;

/** The 404 body links back to the index. */
export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "Back to index" }),
    ).toHaveAttribute("href", "/");
  },
};
