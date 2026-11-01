import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { FakeDuckDb } from "../../data/fake-duckdb";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import {
  withPageFilters,
  withQueryData,
} from "../../../../.storybook/decorators";
import { ButtonGroup } from "./button-group";
import {
  CHANNELS,
  channelDecorators,
  expectAlert,
  labelledChannelDecorators,
  MIX,
} from "./input-stories.fixture";
import type { ButtonGroupProps } from "./types";

const meta = {
  title: "Widgets/ButtonGroup",
  component: ButtonGroup,
  args: {
    id: "channel",
    data: "mix",
    valueColumn: "channel",
    title: "Channel",
  },
} satisfies Meta<ButtonGroupProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The authored shape: `data` names a sql fence, one toggle per distinct
 * `channel`, and a press writes `?channel=<value>`. */
export const Success: Story = {
  decorators: channelDecorators(),
  play: async ({ canvas }) => {
    await canvas.findByRole("group", { name: "Channel" });
    await expect(
      canvas.getAllByRole("button").map((b) => b.textContent),
    ).toEqual(["Direct", "Marketplace", "Partner", "Referral", "Organic"]);
    await expect(
      canvas.getByRole("button", { name: "Direct" }),
    ).toHaveAttribute("aria-pressed", "false");
  },
};

const pressPort = new FakeFilterUrlPort("");

/** Pressing a button writes the param and marks it `aria-pressed`; pressing
 * another moves the selection. */
export const PressWritesParam: Story = {
  decorators: [
    withQueryData([MIX], FakeDuckDb.withRows(CHANNELS)),
    withPageFilters(pressPort),
  ],
  play: async ({ canvas }) => {
    const direct = await canvas.findByRole("button", { name: "Direct" });
    await userEvent.click(direct);
    await expect(direct).toHaveAttribute("aria-pressed", "true");
    await expect(pressPort.read()?.searchParams.get("channel")).toBe("Direct");

    await userEvent.click(canvas.getByRole("button", { name: "Partner" }));
    await expect(pressPort.read()?.searchParams.get("channel")).toBe("Partner");
    await expect(direct).toHaveAttribute("aria-pressed", "false");
  },
};

const deselectPort = new FakeFilterUrlPort("?channel=Direct");

/** Pressing the pressed button deselects — the param is deleted. */
export const DeselectClearsParam: Story = {
  decorators: [
    withQueryData([MIX], FakeDuckDb.withRows(CHANNELS)),
    withPageFilters(deselectPort),
  ],
  play: async ({ canvas }) => {
    const direct = await canvas.findByRole("button", { name: "Direct" });
    await expect(direct).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(direct);
    await expect(direct).toHaveAttribute("aria-pressed", "false");
    await waitFor(() =>
      expect(deselectPort.read()?.searchParams.has("channel")).toBe(false),
    );
  },
};

const multiplePort = new FakeFilterUrlPort("");

/** `multiple` lets several buttons stay pressed; the param serializes as a
 * JSON list. */
export const Multiple: Story = {
  args: { multiple: true },
  decorators: [
    withQueryData([MIX], FakeDuckDb.withRows(CHANNELS)),
    withPageFilters(multiplePort),
  ],
  play: async ({ canvas }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: "Direct" }),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Referral" }));
    await waitFor(() =>
      expect(multiplePort.read()?.searchParams.get("channel")).toBe(
        '["Direct","Referral"]',
      ),
    );
  },
};

/** `selectFirst` presses the first resolved option without touching the URL. */
export const SelectFirst: Story = {
  args: { selectFirst: true },
  decorators: channelDecorators(),
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Direct" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
  },
};

/** A `?channel=` link presses the matching button on first paint. */
export const UrlHydrated: Story = {
  decorators: channelDecorators("?channel=Referral"),
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Referral" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
  },
};

/** `options` supplies the list when `data` is absent — no fence needed. */
export const StaticOptions: Story = {
  args: {
    data: undefined,
    valueColumn: undefined,
    options: ["day", "week", "month"],
    title: "Grain",
    id: "grain",
  },
  decorators: [withPageFilters(new FakeFilterUrlPort(""))],
  play: async ({ canvas }) => {
    await expect(
      canvas.getAllByRole("button").map((b) => b.textContent),
    ).toEqual(["day", "week", "month"]);
  },
};

/** Buttons wider than the column keep their full width and scroll sideways
 * inside the group's wrapper, so the last one can still be reached. */
export const Overflowing: Story = {
  args: {
    data: undefined,
    valueColumn: undefined,
    options: ["Adelie penguin", "Chinstrap penguin", "Gentoo penguin"],
    title: "Species",
    id: "species",
  },
  decorators: [
    (Story) => (
      <div style={{ width: 200 }}>
        <Story />
      </div>
    ),
    withPageFilters(new FakeFilterUrlPort("")),
  ],
  play: async ({ canvas }) => {
    const group = await canvas.findByRole("group", { name: "Species" });
    const wrapper = group.parentElement!;
    await expect(group.scrollWidth).toBe(group.clientWidth);
    await expect(wrapper.scrollWidth).toBeGreaterThan(wrapper.clientWidth);
    const last = canvas.getByRole("button", { name: "Gentoo penguin" });
    last.scrollIntoView({ inline: "end" });
    await expect(last.getBoundingClientRect().right).toBeLessThanOrEqual(
      wrapper.getBoundingClientRect().right,
    );
  },
};

const stalePort = new FakeFilterUrlPort('?channel=["ghost","Direct"]');

/** A URL value the loaded option set doesn't know is pruned — `ghost` drops,
 * `Direct` stays pressed. */
export const StalePruned: Story = {
  args: { multiple: true },
  decorators: [
    withQueryData([MIX], FakeDuckDb.withRows(CHANNELS)),
    withPageFilters(stalePort),
  ],
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(stalePort.read()?.searchParams.get("channel")).toBe('["Direct"]'),
    );
    await expect(
      canvas.getByRole("button", { name: "Direct" }),
    ).toHaveAttribute("aria-pressed", "true");
  },
};

/** `filters` cascades another page filter into the option source — the
 * `?region=West` param narrows the fence to its one matching channel. */
export const CascadedOptions: Story = {
  args: { filters: "region" },
  decorators: [
    withQueryData(
      [MIX],
      FakeDuckDb.withRowsWhen(CHANNELS, (sql) =>
        sql.includes("where region = ?") ? [CHANNELS[0]!] : null,
      ),
    ),
    withPageFilters(new FakeFilterUrlPort("?region=West")),
  ],
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getAllByRole("button")).toHaveLength(1));
    await expect(canvas.getByRole("button", { name: "Direct" })).toBeVisible();
  },
};

/** While the options query is in flight the group renders disabled. */
export const Loading: Story = {
  decorators: [
    withQueryData([MIX], FakeDuckDb.pending()),
    withPageFilters(new FakeFilterUrlPort("")),
  ],
  play: async ({ canvas }) => {
    const group = await canvas.findByRole("group", { name: "Channel" });
    await expect(group).toHaveAttribute("data-disabled");
  },
};

/** A loaded-but-empty option set shows the disabled empty face. */
export const EmptyOptions: Story = {
  decorators: [
    withQueryData([MIX], FakeDuckDb.withRows([])),
    withPageFilters(new FakeFilterUrlPort("")),
  ],
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole("button", { name: "No options available" }),
    ).toBeDisabled();
  },
};

/** A `data` value no sql fence declares renders the named alert — the page
 * around it is untouched. */
export const UnknownName: Story = {
  args: { data: "ghost" },
  decorators: channelDecorators(),
  play: async ({ canvas }) => {
    await expectAlert(canvas, "ghost", "no sql fence");
    await expect(canvas.queryByRole("group")).toBeNull();
  },
};

/** The query's own failure surfaces inline, naming the block. */
export const QueryError: Story = {
  decorators: [
    withQueryData(
      [MIX],
      FakeDuckDb.failing("Catalog Error: Table mix does not exist"),
    ),
    withPageFilters(new FakeFilterUrlPort("")),
  ],
  play: async ({ canvas }) => {
    await expectAlert(canvas, "mix", "does not exist");
  },
};

/** `data` without `valueColumn` is an authoring error, surfaced inline. */
export const MissingValueColumn: Story = {
  args: { valueColumn: undefined },
  decorators: channelDecorators(),
  play: async ({ canvas }) => {
    await expectAlert(canvas, "valueColumn");
  },
};

/** `initialValue` presses its button on first paint without writing the URL. */
export const InitialValue: Story = {
  args: { initialValue: "Partner" },
  decorators: channelDecorators(),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole("button", { name: "Partner" }),
    ).toHaveAttribute("aria-pressed", "true");
  },
};

/** `labelColumn` drives the button text while the URL stores the raw value. */
export const Labels: Story = {
  args: { labelColumn: "label" },
  decorators: labelledChannelDecorators(),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole("button", { name: "Direct channel" }),
    ).toHaveAttribute("aria-pressed", "false");
  },
};
