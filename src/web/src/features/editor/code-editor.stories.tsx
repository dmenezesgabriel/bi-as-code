import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor } from "storybook/test";
import { withThemeMode } from "../../../.storybook/decorators";
import { CodeEditor } from "./code-editor";

const LABEL = "Page source";

const ORDERS_FENCE = [
  "```sql orders",
  "select region, sum(amount) as revenue",
  "from orders",
  "group by region",
  "limit 10",
  "```",
].join("\n");

/** A page-shaped source long enough to scroll: a heading and a sql fence
 * up top (so both render in the first viewport), then filler sections. */
const LONG_PAGE = [
  "---",
  "title: Weekly review",
  "---",
  "",
  "# Weekly review",
  "",
  ORDERS_FENCE,
  ...Array.from({ length: 40 }, (_, i) =>
    [
      "",
      `## Section ${i + 1}`,
      "",
      "Revenue followed the same shape as order volume this week.",
      "",
      `<BarChart data="orders" x="region" y="revenue" title="Split ${i + 1}" />`,
    ].join("\n"),
  ),
].join("\n");

const meta: Meta<typeof CodeEditor> = {
  title: "Editor/CodeEditor",
  component: CodeEditor,
  args: {
    label: LABEL,
    doc: `# Orders\n\n${ORDERS_FENCE}\n`,
    onChange: fn(),
    onSave: fn(),
  },
  decorators: [
    (Story) => (
      <div className="h-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof CodeEditor>;

/** The element holding `text`'s highlighted token in the rendered editor. */
function tokenSpan(root: HTMLElement, text: string): HTMLElement {
  const spans = root.querySelectorAll<HTMLElement>(".cm-line span");
  const span = [...spans].find((el) => el.textContent === text);
  if (!span) throw new Error(`no highlighted token "${text}" in the editor`);
  return span;
}

/** A SQL keyword inside a fence gets a token colour unlike the line's
 * plain-text colour — the visible proof the fence parses as SQL. */
async function expectSqlKeywordHighlighted(root: HTMLElement): Promise<void> {
  const keyword = await waitFor(() => tokenSpan(root, "select"));
  const line = keyword.closest(".cm-line");
  if (!line) throw new Error("highlighted token outside a .cm-line");
  await expect(getComputedStyle(keyword).color).not.toBe(
    getComputedStyle(line).color,
  );
}

/** A page source with a `sql` fence: markdown and SQL both highlighted. */
export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("textbox", { name: LABEL })).toBeVisible();
    await expectSqlKeywordHighlighted(canvasElement);
  },
};

/** A blank page: the editor still offers one line to type into. */
export const Empty: Story = {
  args: { doc: "" },
  play: async ({ canvas, canvasElement }) => {
    const textbox = canvas.getByRole("textbox", { name: LABEL });
    await expect(textbox).toHaveTextContent("");
    await expect(canvasElement.querySelectorAll(".cm-line")).toHaveLength(1);
  },
};

/** A page longer than the pane scrolls inside the editor, not the page. */
export const LongDocument: Story = {
  args: { doc: LONG_PAGE },
  play: async ({ canvasElement }) => {
    const scroller = canvasElement.querySelector<HTMLElement>(".cm-scroller");
    if (!scroller) throw new Error("no .cm-scroller in the editor");
    await expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
    await expectSqlKeywordHighlighted(canvasElement);
  },
};

/** Dark app mode swaps in the One Dark editor theme. */
export const Dark: Story = {
  decorators: [withThemeMode("dark")],
  globals: { theme: "dark" },
  play: async ({ canvasElement }) => {
    const editor = canvasElement.querySelector<HTMLElement>(".cm-editor");
    if (!editor) throw new Error("no .cm-editor in the canvas");
    // One Dark's background, #282c34.
    await expect(getComputedStyle(editor).backgroundColor).toBe(
      "rgb(40, 44, 52)",
    );
    await expectSqlKeywordHighlighted(canvasElement);
  },
};

/** CodeMirror reads `Mod` as Cmd on a Mac and Ctrl elsewhere. */
const SAVE_CHORD = /Mac/.test(navigator.platform)
  ? "{Meta>}s{/Meta}"
  : "{Control>}s{/Control}";

/** A widget typed self-closed stays that way; one left open is closed. */
export const SelfClosedWidget: Story = {
  args: { doc: "" },
  play: async ({ args, canvas }) => {
    const textbox = canvas.getByRole("textbox", { name: LABEL });
    await userEvent.click(textbox);
    await userEvent.keyboard('<Table data="orders" />');
    await expect(args.onChange).toHaveBeenLastCalledWith(
      '<Table data="orders" />',
    );
    await userEvent.keyboard('{Enter}<Details title="More">');
    await expect(args.onChange).toHaveBeenLastCalledWith(
      '<Table data="orders" />\n<Details title="More"></Details>',
    );
  },
};

/** Typing reports each edit; `Mod-s` hands the edited source to onSave. */
export const SaveKeybinding: Story = {
  args: { doc: "# Orders " },
  play: async ({ args, canvas }) => {
    const textbox = canvas.getByRole("textbox", { name: LABEL });
    await userEvent.click(textbox);
    await userEvent.keyboard("{End}Weekly");
    await userEvent.keyboard(SAVE_CHORD);
    await expect(args.onChange).toHaveBeenLastCalledWith("# Orders Weekly");
    await expect(args.onSave).toHaveBeenCalledTimes(1);
    await expect(args.onSave).toHaveBeenCalledWith("# Orders Weekly");
  },
};
