import { expect, userEvent, waitFor } from "storybook/test";

/**
 * Clicks into an editor's text box and waits until it holds focus. CodeMirror
 * takes focus a moment after the click, and a key pressed before then goes to
 * the page instead of the editor; that lost `Ctrl-s` failed the `Saving` story
 * when a docs page loaded several story frames at once.
 *
 * @example
 * await focusEditor(await canvas.findByRole("textbox", { name: "Page source" }));
 */
export async function focusEditor(textbox: HTMLElement): Promise<void> {
  await userEvent.click(textbox);
  await waitFor(() => expect(textbox).toHaveFocus());
}
