import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { Decorator } from "@storybook/react-vite";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { Row } from "../../data/types";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import type { SqlBlock } from "../../pages/types";
import {
  withPageFilters,
  withQueryData,
} from "../../../../.storybook/decorators";
import { MultiSelect } from "./multi-select";
import type { MultiSelectProps } from "./types";

const MIX: SqlBlock = {
  name: "mix",
  sql: "select channel, share from channel_mix",
};

const CHANNELS: Row[] = [
  { channel: "Direct", share: 0.46 },
  { channel: "Marketplace", share: 0.32 },
  { channel: "Partner", share: 0.22 },
  { channel: "Referral", share: 0.1 },
  { channel: "Organic", share: 0.08 },
];

/** The query-backed decoration most stories share — fresh fakes per call. */
function channelDecorators(search?: string): Decorator[] {
  return [
    withQueryData([MIX], FakeDuckDb.withRows(CHANNELS)),
    withPageFilters(new FakeFilterUrlPort(search)),
  ];
}

type Canvas = ReturnType<typeof within>;

/**
 * The field's combobox element is the chips-row input in multi mode —
 * clicking it opens the popup (which lives in a portal under
 * `document.body`, so queries against it go through `within(document.body)`).
 */
async function openField(canvas: Canvas): Promise<void> {
  await userEvent.click(canvas.getByRole("combobox"));
}

function popup(): Canvas {
  return within(document.body);
}

const meta = {
  title: "Widgets/MultiSelect",
  component: MultiSelect,
  args: { id: "channel", data: "mix", valueColumn: "channel" },
} satisfies Meta<MultiSelectProps>;

export default meta;
type Story = StoryObj<typeof meta>;

const successPort = new FakeFilterUrlPort("");

/** The authored shape: `data` names a sql fence, each pick adds a chip and
 * the URL gains `?channel=["a","b"]`. */
export const Success: Story = {
  args: { title: "Channel" },
  decorators: [
    withQueryData([MIX], FakeDuckDb.withRows(CHANNELS)),
    withPageFilters(successPort),
  ],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("combobox")).toHaveAttribute(
      "placeholder",
      "Select Channel",
    );
    await openField(canvas);

    await expect(
      await popup().findByRole("option", { name: "Organic" }),
    ).toBeVisible();
    await expect(popup().getAllByRole("option")).toHaveLength(5);
    await userEvent.click(popup().getByRole("option", { name: "Direct" }));
    await userEvent.click(popup().getByRole("option", { name: "Marketplace" }));
    // Chips pre-dating the open are inert while the popup is up — Escape
    // before asserting them, as a reader would.
    await userEvent.keyboard("{Escape}");

    await expect(
      await canvas.findByRole("button", { name: "Remove Direct" }),
    ).toBeVisible();
    await expect(
      await canvas.findByRole("button", { name: "Remove Marketplace" }),
    ).toBeVisible();
    await expect(successPort.read()?.searchParams.get("channel")).toBe(
      '["Direct","Marketplace"]',
    );
  },
};

/** `labelColumn` drives the chips and the list; the URL stores raw values. */
export const Labels: Story = {
  args: { labelColumn: "label" },
  decorators: [
    withQueryData(
      [MIX],
      FakeDuckDb.withRows([
        { channel: "D", label: "Direct channel" },
        { channel: "M", label: "Marketplace channel" },
      ]),
    ),
    withPageFilters(new FakeFilterUrlPort("")),
  ],
  play: async ({ canvas }) => {
    await openField(canvas);
    await userEvent.click(
      await popup().findByRole("option", { name: "Direct channel" }),
    );
    await userEvent.keyboard("{Escape}");
    await expect(
      await canvas.findByRole("button", { name: "Remove Direct channel" }),
    ).toBeVisible();
  },
};

/** Typing in the field narrows the list, and a pick keeps the popup open
 * with the query intact — several results from one search. */
export const Search: Story = {
  decorators: channelDecorators(),
  play: async ({ canvas }) => {
    await openField(canvas);
    await userEvent.type(canvas.getByRole("combobox"), "part");
    await waitFor(() => expect(popup().getAllByRole("option")).toHaveLength(1));

    await userEvent.click(popup().getByRole("option", { name: "Partner" }));

    await expect(canvas.getByRole("combobox")).toHaveValue("part");
    await expect(
      popup().getByRole("option", { name: "Partner" }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect(
      await canvas.findByRole("button", { name: "Remove Partner" }),
    ).toBeVisible();
  },
};

/** A `?channel=["Direct","Marketplace"]` link restores both chips on first
 * render — they show before the option query even resolves. */
export const UrlHydrated: Story = {
  decorators: channelDecorators('?channel=["Direct","Marketplace"]'),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole("button", { name: "Remove Direct" }),
    ).toBeVisible();
    await expect(
      await canvas.findByRole("button", { name: "Remove Marketplace" }),
    ).toBeVisible();
  },
};

/** A chip's `Remove` button unselects that one value and rewrites the URL —
 * no popup needed, the chips are plain buttons. */
export const ChipRemoval: Story = {
  decorators: channelDecorators('?channel=["Direct","Marketplace"]'),
  play: async ({ canvas }) => {
    const remove = await canvas.findByRole("button", { name: "Remove Direct" });
    await userEvent.click(remove);
    await waitFor(() =>
      expect(
        canvas.queryByRole("button", { name: "Remove Direct" }),
      ).toBeNull(),
    );
    await expect(
      await canvas.findByRole("button", { name: "Remove Marketplace" }),
    ).toBeVisible();
  },
};

/** The footer's `Select All` unions the filtered options into the
 * selection — five picks hits the chip cap: three chips plus "+2 more",
 * the URL-seeded Partner leading. */
export const SelectAll: Story = {
  decorators: channelDecorators('?channel=["Partner"]'),
  play: async ({ canvas }) => {
    await openField(canvas);
    await userEvent.click(
      await popup().findByRole("button", { name: "Select All" }),
    );
    await userEvent.keyboard("{Escape}");
    await expect(
      await canvas.findByRole("button", { name: "Remove Partner" }),
    ).toBeVisible();
    await expect(canvas.getByText("+2 more")).toBeVisible();
  },
};

/** The footer Clear empties the chip row and deletes the URL param. */
export const Clear: Story = {
  decorators: channelDecorators('?channel=["Direct","Marketplace"]'),
  play: async ({ canvas }) => {
    await openField(canvas);
    await userEvent.click(
      await popup().findByRole("button", { name: "Clear" }),
    );
    await waitFor(() =>
      expect(
        canvas.queryByRole("button", { name: "Remove Direct" }),
      ).toBeNull(),
    );
    await expect(canvas.getByRole("combobox")).toHaveAttribute(
      "placeholder",
      "Select Channel",
    );
  },
};

/** `defaultTopN` seeds the first resolved options as a programmatic
 * default — chips appear, but the URL stays clean. */
export const DefaultTopN: Story = {
  args: { defaultTopN: 2 },
  decorators: [
    withQueryData([MIX], FakeDuckDb.withRows(CHANNELS)),
    withPageFilters(new FakeFilterUrlPort("")),
  ],
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole("button", { name: "Remove Direct" }),
    ).toBeVisible();
    await expect(
      await canvas.findByRole("button", { name: "Remove Marketplace" }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Remove Partner" }),
    ).toBeNull();
  },
};

/** A URL entry the loaded options don't carry gets pruned — the param
 * rewrites to the valid remainder. */
export const StalePruned: Story = {
  decorators: channelDecorators('?channel=["Direct","ghost"]'),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole("button", { name: "Remove Direct" }),
    ).toBeVisible();
    await waitFor(() =>
      expect(canvas.queryByRole("button", { name: "Remove ghost" })).toBeNull(),
    );
  },
};

/** `options` without `data` — static entries on a page with no sql fences. */
export const StaticOptions: Story = {
  args: {
    data: undefined,
    valueColumn: undefined,
    options: ["Direct", "Partner"],
  },
  decorators: channelDecorators(),
  play: async ({ canvas }) => {
    await openField(canvas);
    await userEvent.click(
      await popup().findByRole("option", { name: "Partner" }),
    );
    await userEvent.keyboard("{Escape}");
    await expect(
      await canvas.findByRole("button", { name: "Remove Partner" }),
    ).toBeVisible();
  },
};

/** While the option query is in flight the field is disabled — URL-seeded
 * chips still render. */
export const Loading: Story = {
  decorators: [
    withQueryData([MIX], FakeDuckDb.pending()),
    withPageFilters(new FakeFilterUrlPort('?channel=["Direct"]')),
  ],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("combobox")).toBeDisabled();
    await expect(
      await canvas.findByRole("button", { name: "Remove Direct" }),
    ).toBeVisible();
  },
};

/** A `data` value no sql fence declares renders the named alert — the page
 * around it is untouched. */
export const UnknownName: Story = {
  args: { data: "ghost" },
  decorators: channelDecorators(),
  play: async ({ canvas }) => {
    const alert = await canvas.findByRole("alert");
    await expect(alert).toHaveTextContent(/ghost.*no sql fence/);
    await expect(canvas.queryByRole("combobox")).toBeNull();
  },
};
