import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import type { BiacConfig } from "virtual:biac-config";
import type { NavTree } from "virtual:biac-pages";
import { withMemoryRouter } from "../.storybook/decorators";
import { AppShell } from "./App";

const TREE: NavTree = {
  rootPages: [
    { name: "Home", href: "/" },
    { name: "Weekly review", href: "/weekly-review" },
  ],
  directories: [
    {
      id: "guides",
      name: "Guides",
      pages: [{ name: "Getting started", href: "/guides/getting-started" }],
    },
  ],
};

const SITE: BiacConfig = {
  title: "biac",
  theme: "light",
  nav: { sidebar: true },
  sqlTables: {},
};

const meta: Meta<typeof AppShell> = {
  title: "App",
  component: AppShell,
  args: { tree: TREE, site: SITE },
  decorators: [
    withMemoryRouter(["/", "/weekly-review", "/guides/getting-started"], "/"),
  ],
};

export default meta;

type Story = StoryObj<typeof AppShell>;

/** The full chrome: sidebar nav, header with breadcrumbs and the theme
 * toggle, routed content under `<Outlet/>` (a stub route here). */
export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("navigation", { name: "Site navigation" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Toggle sidebar" }),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(
      canvas.getByRole("navigation", { name: "breadcrumb" }),
    ).toHaveTextContent("Home");
  },
};

/** The header button collapses the sidebar on desktop widths and reports
 * `aria-expanded` going false. */
export const SidebarToggles: Story = {
  play: async ({ canvas }) => {
    const toggle = canvas.getByRole("button", { name: "Toggle sidebar" });
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    // The aside animates `visibility` out over ~150ms, so the nav leaves the
    // a11y tree a beat after the click — poll instead of asserting sync.
    await waitFor(() =>
      expect(
        canvas.queryByRole("navigation", { name: "Site navigation" }),
      ).toBeNull(),
    );
  },
};

/** `nav.sidebar: false` removes the chrome entirely — content only. */
export const NoSidebar: Story = {
  args: { site: { ...SITE, nav: { sidebar: false } } },
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelector('nav[aria-label="Site navigation"]'),
    ).toBeNull();
    await expect(
      canvasElement.querySelector('button[aria-label="Toggle sidebar"]'),
    ).toBeNull();
  },
};
