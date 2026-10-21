import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor } from "storybook/test";
import { withMemoryRouter } from "../../../.storybook/decorators";
import {
  FakeSearchDocuments,
  SAMPLE_SEARCH_PAGES as PAGES,
} from "./fake-search-documents";
import { SiteSearch } from "./site-search";

const PATHS = ["/", "/weekly-orders", "/weekly-review", "/nested/allocation"];

const meta: Meta<typeof SiteSearch> = {
  title: "Search/SiteSearch",
  component: SiteSearch,
  args: {
    loadDocuments: new FakeSearchDocuments(PAGES, { held: false }).load,
    onNavigate: fn(),
  },
  decorators: [
    withMemoryRouter(PATHS, "/"),
    (Story) => (
      <div className="w-72 border border-border bg-sidebar pt-3">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SiteSearch>;

/** The empty box: nothing listed until the reader types. */
export const Idle: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("combobox", { name: "Search pages" }),
    ).toBeVisible();
    await expect(canvas.queryByRole("option")).not.toBeInTheDocument();
  },
};

/** Matches ranked, the first highlighted: title matches above text-only ones. */
export const Results: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByRole("combobox"), "weekly");

    await waitFor(() =>
      expect(
        canvas.getAllByRole("option").map((option) => option.textContent),
      ).toEqual(["Weekly orders", "Weekly review", "Allocation"]),
    );
    await expect(
      canvas.getByRole("option", { name: "Weekly orders" }),
    ).toHaveAttribute("data-highlighted");
  },
};

/** A word no page holds. */
export const NoResults: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByRole("combobox"), "zebra");

    await expect(await canvas.findByText("No results")).toBeVisible();
  },
};

/** Typed before the documents arrived. */
export const Loading: Story = {
  args: { loadDocuments: new FakeSearchDocuments(PAGES).load },
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByRole("combobox"), "weekly");

    await expect(await canvas.findByText("Loading…")).toBeVisible();
  },
};

const failing = new FakeSearchDocuments(PAGES);

/** The documents' chunk failed to load. */
export const Unavailable: Story = {
  args: { loadDocuments: failing.load },
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByRole("combobox"), "weekly");
    failing.fail();

    await expect(
      await canvas.findByText("Search is unavailable"),
    ).toBeVisible();
  },
};

/** ArrowDown moves the highlight; Enter opens that page and clears the box. */
export const ChooseWithKeyboard: Story = {
  play: async ({ args, canvas }) => {
    const box = canvas.getByRole("combobox");
    await userEvent.type(box, "weekly");
    await canvas.findByRole("option", { name: "Allocation" });

    await userEvent.keyboard("{ArrowDown}");
    await expect(
      canvas.getByRole("option", { name: "Weekly review" }),
    ).toHaveAttribute("data-highlighted");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(args.onNavigate).toHaveBeenCalledOnce());
    await expect(box).toHaveValue("");
  },
};
