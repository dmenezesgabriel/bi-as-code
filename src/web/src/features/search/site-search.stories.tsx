import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor } from "storybook/test";
import {
  withMemoryRouter,
  withPageLanguage,
} from "../../../.storybook/decorators";
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
    onReveal: fn(),
    onSearchingChange: fn(),
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
type Canvas = Parameters<NonNullable<Story["play"]>>[0]["canvas"];

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
    await expect(canvas.getByRole("status")).toHaveTextContent("3 results");
  },
};

/** A word no page holds. */
export const NoResults: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByRole("combobox"), "zebra");

    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent("No results"),
    );
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

/** Types `weekly` and waits for its last result, returning the box. */
async function typeWeekly(canvas: Canvas): Promise<HTMLElement> {
  const box = canvas.getByRole("combobox");
  await userEvent.type(box, "weekly");
  await canvas.findByRole("option", { name: "Allocation" });
  return box;
}

/** ArrowDown moves the highlight; Enter opens that page and clears the box. */
export const ChooseWithKeyboard: Story = {
  play: async ({ args, canvas }) => {
    const box = await typeWeekly(canvas);

    await userEvent.keyboard("{ArrowDown}");
    await expect(
      canvas.getByRole("option", { name: "Weekly review" }),
    ).toHaveAttribute("data-highlighted");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(args.onNavigate).toHaveBeenCalledOnce());
    await expect(box).toHaveValue("");
  },
};

/** `/` from the page focuses the box, revealing it first, its text selected. */
export const FocusWithShortcut: Story = {
  play: async ({ args, canvas }) => {
    const box = canvas.getByRole<HTMLInputElement>("combobox");
    await userEvent.type(box, "weekly");
    box.blur();

    await userEvent.keyboard("/");

    await expect(args.onReveal).toHaveBeenCalledOnce();
    await expect(box).toHaveFocus();
    await expect(
      box.value.slice(box.selectionStart ?? 0, box.selectionEnd ?? 0),
    ).toBe("weekly");
  },
};

/** Escape clears the query, then a second Escape leaves the box. */
export const EscapeClearsThenLeaves: Story = {
  play: async ({ args, canvas }) => {
    const box = await typeWeekly(canvas);

    await userEvent.keyboard("{Escape}");
    await expect(box).toHaveValue("");
    await expect(box).toHaveFocus();
    await expect(args.onSearchingChange).toHaveBeenLastCalledWith(false);

    await userEvent.keyboard("{Escape}");
    await expect(box).not.toHaveFocus();
  },
};

/** A French reader searches the French text: "hebdomadaire" finds the review. */
export const FrenchReader: Story = {
  args: {
    loadDocuments: new FakeSearchDocuments(PAGES, {
      held: false,
      byLanguage: {
        fr: [
          {
            id: "/weekly-review",
            title: "Weekly review",
            text: "Revue hebdomadaire",
            keywords: "",
          },
        ],
      },
    }).load,
  },
  decorators: [withPageLanguage("fr")],
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByRole("combobox"), "hebdomadaire");

    await expect(
      await canvas.findByRole("option", { name: "Weekly review" }),
    ).toBeVisible();
    await expect(canvas.getByRole("status")).toHaveTextContent("1 result");
  },
};

const updating = new FakeSearchDocuments(PAGES, { held: false });

/** A page saved while the box is open: its new keyword matches in place. */
export const DocumentsUpdateWhileOpen: Story = {
  args: { loadDocuments: updating.load },
  play: async ({ canvas }) => {
    // The fake outlives a replay of the story, so it starts from the sample.
    updating.update(PAGES);
    await userEvent.type(canvas.getByRole("combobox"), "margin");
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent("No results"),
    );

    updating.update(
      PAGES.map((page) =>
        page.id === "/nested/allocation"
          ? { ...page, keywords: "margin" }
          : page,
      ),
    );

    await expect(
      await canvas.findByRole("option", { name: "Allocation" }),
    ).toBeVisible();
  },
};
