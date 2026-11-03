import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import type { BiacConfig } from "virtual:biac-config";
import type { NavTree } from "virtual:biac-pages";
import { withMemoryRouter } from "../.storybook/decorators";
import { AppShell } from "./App";
import { FakeFrameWindow } from "./features/chrome/frame-window.stub";

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
  layout: {
    page_width: "article",
    cards: false,
    table_of_contents: true,
    table_of_contents_label: "On this page",
  },
  embed: { origins: [] },
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

/** `theme: "dark"` opens the site in dark mode for a reader who has not
 * picked a mode of their own. */
export const DarkTheme: Story = {
  args: { site: { ...SITE, theme: "dark" } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /light/i })).toBeVisible();
    await expect(document.documentElement).toHaveClass("dark");
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

/** A page whose front-matter sets `sidebar: false` and `header: false` —
 * the embed layout: content only, no toggle. */
export const PageWithoutChrome: Story = {
  args: { pages: [{ route: "/", sidebar: false, header: false }] },
  play: async ({ canvas }) => {
    // `hidden: true` also counts a rendered but collapsed sidebar, so the
    // assertion proves the chrome is absent, not merely invisible.
    await expect(
      canvas.queryByRole("complementary", { hidden: true }),
    ).toBeNull();
    await expect(canvas.queryByRole("banner", { hidden: true })).toBeNull();
    await expect(
      canvas.queryByRole("button", { name: "Toggle sidebar", hidden: true }),
    ).toBeNull();
  },
};

/** `sidebar: false` alone keeps the header, without the sidebar toggle. */
export const PageWithoutSidebar: Story = {
  args: { pages: [{ route: "/", sidebar: false }] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("banner")).toBeVisible();
    await expect(
      canvas.queryByRole("navigation", { name: "Site navigation" }),
    ).toBeNull();
    await expect(
      canvas.queryByRole("button", { name: "Toggle sidebar" }),
    ).toBeNull();
  },
};

/** `header: false` alone keeps the sidebar; its toggle floats beside it,
 * so the drawer below `lg` stays reachable. */
export const PageWithoutHeader: Story = {
  args: { pages: [{ route: "/", header: false }] },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("banner")).toBeNull();
    const toggle = canvas.getByRole("button", { name: "Toggle sidebar" });
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    await expect(
      canvas.getByRole("navigation", { name: "Site navigation" }),
    ).toBeVisible();
  },
};

/** A page's `sidebar: true` and `header: true` win over the project's
 * `nav.sidebar: false`. */
export const PageRestoresChrome: Story = {
  args: {
    site: { ...SITE, nav: { sidebar: false } },
    pages: [{ route: "/", sidebar: true, header: true }],
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("navigation", { name: "Site navigation" }),
    ).toBeVisible();
    await expect(canvas.getByRole("banner")).toBeVisible();
  },
};

/** Under `biac dev` the header carries the page's Edit link. */
export const Editable: Story = {
  args: { editable: true },
  decorators: [
    withMemoryRouter(["/", "/weekly-review"], "/weekly-review?region=West"),
  ],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("banner")).toContainElement(
      canvas.getByRole("link", { name: "Edit" }),
    );
  },
};

const INTRANET = "https://intranet.example.com";
const INTRANET_FRAME = new FakeFrameWindow({ ancestorOrigins: [INTRANET] });

/** Framed by an origin `embed.origins` lists, the shell posts its
 * content's height to that parent, addressed to its exact origin. The stub
 * route renders nothing, so the header is the content measured. */
export const FramedByListedParent: Story = {
  args: {
    site: { ...SITE, embed: { origins: [INTRANET] } },
    frame: INTRANET_FRAME,
  },
  play: async () => {
    // The first post can measure the shell before the header renders;
    // wait for the one that carries it.
    await waitFor(() => {
      const last = INTRANET_FRAME.parent.posted.at(-1);
      expect(last?.targetOrigin).toBe(INTRANET);
      expect(last?.message.type).toBe("biac:height");
      expect(last?.message.height).toBeGreaterThan(0);
    });
  },
};
