import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";
import type { NavTree } from "virtual:biac-pages";
import { withMemoryRouter } from "../../../.storybook/decorators";
import { FakeSearchDocuments } from "../search/fake-search-documents";
import { SidebarNav } from "./sidebar-nav";

const TREE: NavTree = {
  rootPages: [
    { name: "Home", href: "/" },
    { name: "Weekly review", href: "/weekly-review" },
  ],
  directories: [
    {
      id: "guides",
      name: "Guides",
      pages: [
        { name: "Getting started", href: "/guides/getting-started" },
        { name: "Reference", href: "/guides/reference" },
      ],
    },
    {
      id: "ops",
      name: "Ops",
      pages: [{ name: "Runbooks", href: "/ops/runbooks" }],
    },
  ],
};

const PATHS = [
  "/",
  "/weekly-review",
  "/guides/getting-started",
  "/guides/reference",
  "/ops/runbooks",
];

const meta: Meta<typeof SidebarNav> = {
  title: "Chrome/SidebarNav",
  component: SidebarNav,
  args: {
    tree: TREE,
    siteTitle: "biac",
    onNavigate: fn(),
    onRevealSearch: fn(),
  },
  decorators: [
    withMemoryRouter(PATHS, "/"),
    (Story) => (
      <div className="h-[480px] w-72 border border-border">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SidebarNav>;

/** Root links and collapsed directory groups; the active page is marked. */
export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("navigation", { name: "Site navigation" }),
    ).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      canvas.getByRole("link", { name: "Weekly review" }),
    ).not.toHaveAttribute("aria-current");
  },
};

/** A directory containing the active page opens on its own. */
export const ActiveInsideDirectory: Story = {
  decorators: [withMemoryRouter(PATHS, "/guides/getting-started")],
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("link", { name: "Getting started" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(canvas.getByText("Reference")).toBeVisible();
  },
};

/** Toggling a group flips it open and writes the choice to storage. */
export const ToggleDirectory: Story = {
  play: async ({ canvas }) => {
    const summary = canvas.getByText("Guides");
    const details = summary.closest("details");
    await expect(details).not.toBeNull();
    await expect(details).not.toHaveAttribute("open");

    await userEvent.click(summary);
    await expect(details).toHaveAttribute("open");
    await expect(canvas.getByText("Getting started")).toBeVisible();

    await userEvent.click(summary);
    await expect(details).not.toHaveAttribute("open");
  },
};

/** Clicking a page link reports the navigation upward (drawer close). */
export const LinkClickReportsNavigate: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole("link", { name: "Weekly review" }));
    await expect(args.onNavigate).toHaveBeenCalled();
  },
};

/** Pages that name an icon show it before the label, root and directory
 * alike; a page without one shows its name alone. The active link's icon
 * takes the active text colour. */
export const WithIcons: Story = {
  args: {
    tree: {
      rootPages: [
        { name: "Home", href: "/", icon: "house" },
        { name: "Weekly review", href: "/weekly-review", icon: "calendar" },
      ],
      directories: [
        {
          id: "guides",
          name: "Guides",
          pages: [
            {
              name: "Getting started",
              href: "/guides/getting-started",
              icon: "book-open",
            },
            { name: "Reference", href: "/guides/reference" },
          ],
        },
      ],
    },
  },
  decorators: [withMemoryRouter(PATHS, "/guides/getting-started")],
  play: async ({ canvas }) => {
    const active = canvas.getByRole("link", { name: "Getting started" });
    await expect(active).toHaveAttribute("aria-current", "page");
    await expect(active.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    await expect(
      canvas.getByRole("link", { name: "Weekly review" }).querySelector("svg"),
    ).toHaveClass("lucide-calendar");
    await expect(
      canvas.getByRole("link", { name: "Reference" }).querySelector("svg"),
    ).toBeNull();
  },
};

/**
 * With search on: the box sits between the site title and the page links,
 * and its results take the links' place until the box is cleared.
 */
export const WithSearch: Story = {
  args: {
    loadSearchDocuments: new FakeSearchDocuments(
      [
        {
          id: "/weekly-review",
          title: "Weekly review",
          text: "",
          keywords: "",
        },
      ],
      { held: false },
    ).load,
  },
  play: async ({ canvas }) => {
    await userEvent.type(
      canvas.getByRole("combobox", { name: "Search pages" }),
      "review",
    );

    await expect(
      await canvas.findByRole("option", { name: "Weekly review" }),
    ).toHaveAttribute("href", "/weekly-review");
    await expect(
      canvas.queryByRole("link", { name: "Home" }),
    ).not.toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await expect(canvas.getByRole("link", { name: "Home" })).toBeVisible();
  },
};
