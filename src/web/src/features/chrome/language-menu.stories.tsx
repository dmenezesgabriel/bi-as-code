import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { LanguageMenu } from "./language-menu";

const meta: Meta<typeof LanguageMenu> = {
  title: "Chrome/LanguageMenu",
  component: LanguageMenu,
  args: { languages: ["en", "fr"], language: "en", onChoose: fn() },
};

export default meta;

type Story = StoryObj<typeof LanguageMenu>;

// The popup is portalled to <body>, outside the story's canvas.
const page = () => within(document.body);

/** Closed: a single icon button beside the theme toggle. */
export const Closed: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Language" }),
    ).toBeVisible();
  },
};

/** Open: every language by its own name, the current one checked. */
export const Open: Story = {
  args: { languages: ["en", "fr", "de"], language: "fr" },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Language" }));
    const french = await page().findByRole("menuitemradio", {
      name: "Français",
    });
    await expect(french).toHaveAttribute("aria-checked", "true");
    await expect(
      page().getByRole("menuitemradio", { name: "Deutsch" }),
    ).toHaveAttribute("aria-checked", "false");
  },
};

/** The component is controlled — a pick reports the language and closes
 * the menu; `useLanguage` in the shell owns storage and the URL. */
export const PickReportsLanguage: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Language" }));
    await userEvent.click(
      await page().findByRole("menuitemradio", { name: "Français" }),
    );
    await expect(args.onChoose).toHaveBeenCalledWith("fr");
  },
};

/** One declared language: nothing to choose, so nothing renders. */
export const SingleLanguage: Story = {
  args: { languages: ["en"] },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("button", { name: "Language" })).toBeNull();
  },
};
