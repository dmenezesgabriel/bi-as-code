import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { withMemoryRouter } from "../../../.storybook/decorators";
import { Breadcrumbs } from "./breadcrumbs";
import { GUIDES_NAV_TREE } from "./nav-tree.fixture";

const PATHS = ["/", "/weekly-review", "/guides/getting-started", "/missing"];

const meta: Meta<typeof Breadcrumbs> = {
  title: "Chrome/Breadcrumbs",
  component: Breadcrumbs,
  args: { tree: GUIDES_NAV_TREE },
};

export default meta;

type Story = StoryObj<typeof Breadcrumbs>;

/** On `/` the trail is the home crumb alone, marked `aria-current`. */
export const Home: Story = {
  decorators: [withMemoryRouter(PATHS, "/")],
  play: async ({ canvas }) => {
    const nav = canvas.getByRole("navigation", { name: "breadcrumb" });
    await expect(nav).toHaveTextContent("Home");
    await expect(canvas.getByText("Home")).toHaveAttribute(
      "aria-current",
      "page",
    );
  },
};

/** A root page trails Home → itself; the leaf is text, the rest are links. */
export const RootPage: Story = {
  decorators: [withMemoryRouter(PATHS, "/weekly-review")],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    await expect(canvas.getByText("Weekly review")).toHaveAttribute(
      "aria-current",
      "page",
    );
  },
};

/** A directory crumb renders as plain text — directories are not routes. */
export const DirectoryPage: Story = {
  decorators: [withMemoryRouter(PATHS, "/guides/getting-started")],
  play: async ({ canvas }) => {
    const nav = canvas.getByRole("navigation", { name: "breadcrumb" });
    await expect(nav).toHaveTextContent("Home/Guides/Getting started");
    await expect(canvas.queryByRole("link", { name: "Guides" })).toBeNull();
  },
};

/** A route absent from the nav tree (404) has no position — nothing renders. */
export const UnknownRoute: Story = {
  decorators: [withMemoryRouter(PATHS, "/missing")],
  play: async ({ canvas }) => {
    await expect(
      canvas.queryByRole("navigation", { name: "breadcrumb" }),
    ).toBeNull();
  },
};
