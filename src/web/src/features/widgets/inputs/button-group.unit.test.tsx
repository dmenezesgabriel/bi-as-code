import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { Row } from "../../data/types";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import { ButtonGroup } from "./button-group";
import { FIELD_CONTROL_HEIGHT, FIELD_LABEL_ROW } from "./field-line";
import {
  CHANNEL_MIX,
  CHANNEL_ROWS,
  expectNoUrlWrites,
  expectParamCleared,
  expectRegionCascade,
  lastWrittenParam,
  mountSelectInput,
  regionCascadeDb,
  type SelectMountOptions,
} from "./select-harness";
import type { ButtonGroupProps } from "./types";

const ALL_CHANNELS = [
  "Direct",
  "Marketplace",
  "Partner",
  "Referral",
  "Organic",
];

/** Renders `<ButtonGroup>` bound to the `channel` filter over the `channel_mix` fence. */
function renderButtonGroup(
  props: Partial<ButtonGroupProps> = {},
  opts: SelectMountOptions = {},
): FakeDuckDb {
  return mountSelectInput(
    <ButtonGroup
      id="channel"
      data="mix"
      valueColumn="channel"
      title="Channel"
      {...props}
    />,
    { blocks: [CHANNEL_MIX], db: FakeDuckDb.withRows(CHANNEL_ROWS), ...opts },
  );
}

/** Mounts the widget with a fresh port at `search` and returns it for write assertions. */
function mountWithPort(
  props: Partial<ButtonGroupProps> = {},
  search = "",
): FakeFilterUrlPort {
  const port = new FakeFilterUrlPort(search);
  renderButtonGroup(props, { port });
  return port;
}

/** The rendered toggle group — `role="group"`, named by its title span. */
function channelGroup(): HTMLElement {
  return screen.getByRole("group", { name: "Channel" });
}

/** The toggle button carrying `name`. */
function option(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

/** Presses the named toggle button. */
async function press(name: string): Promise<void> {
  fireEvent.click(await screen.findByRole("button", { name }));
}

/** Waits for `name`'s toggle to settle at `pressed`. */
async function expectPressed(name: string, pressed = true): Promise<void> {
  await waitFor(() =>
    expect(option(name)).toHaveAttribute("aria-pressed", String(pressed)),
  );
}

/** Waits for the `channel` param's last write to serialize as `expected`. */
async function expectChannelParam(
  port: FakeFilterUrlPort,
  expected: string | null,
): Promise<void> {
  await waitFor(() => expect(lastWrittenParam(port, "channel")).toBe(expected));
}

/** Asserts the inline alert carries every fragment and no group rendered. */
async function expectAlert(...fragments: string[]): Promise<void> {
  const alert = await screen.findByRole("alert");
  for (const fragment of fragments) {
    expect(alert).toHaveTextContent(fragment);
  }
  expect(screen.queryByRole("group")).toBeNull();
}

describe("ButtonGroup — field", () => {
  it("sits on the filter bar's label row and control height", () => {
    renderButtonGroup();

    expect(screen.getByText("Channel")).toHaveClass(FIELD_LABEL_ROW);
    // The bordered group is the box; its buttons stretch to fill it.
    expect(channelGroup()).toHaveClass(FIELD_CONTROL_HEIGHT);
  });
});

describe("ButtonGroup — option source", () => {
  it("renders distinct valueColumn values in fence order as toggle buttons", async () => {
    renderButtonGroup();

    // The loading face renders one spinner button — wait on a named option.
    await screen.findByRole("button", { name: "Direct" });
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(
      ALL_CHANNELS,
    );
    expect(channelGroup()).toBeDefined();
  });

  it("shows labelColumn text on the button but the value in the URL", async () => {
    const rows: Row[] = [
      { channel: "D", label: "Direct channel" },
      { channel: "M", label: "Marketplace channel" },
    ];
    const port = new FakeFilterUrlPort("");
    renderButtonGroup(
      { labelColumn: "label" },
      { db: FakeDuckDb.withRows(rows), port },
    );

    await press("Direct channel");

    await expectChannelParam(port, "D");
  });

  it("renders the options prop when data is absent", async () => {
    renderButtonGroup(
      {
        data: undefined,
        valueColumn: undefined,
        options: ["Direct", "Partner"],
      },
      { blocks: [] },
    );

    await waitFor(() =>
      expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
        "Direct",
        "Partner",
      ]),
    );
  });

  it("narrows the option source through the filters prop", async () => {
    const db = regionCascadeDb(
      [{ channel: "Direct" }, { channel: "Partner" }],
      [{ channel: "Direct" }],
    );
    renderButtonGroup(
      { filters: "region" },
      { db, port: new FakeFilterUrlPort("?region=West") },
    );

    await expectRegionCascade(db, "select * from channel_mix");
    await waitFor(() => expect(screen.getAllByRole("button")).toHaveLength(1));
  });
});

describe("ButtonGroup — selection lifecycle", () => {
  it("writes ?channel=<value> and marks the button pressed", async () => {
    const port = mountWithPort();

    await press("Direct");

    await expectChannelParam(port, "Direct");
    expect(option("Direct")).toHaveAttribute("aria-pressed", "true");
    expect(option("Marketplace")).toHaveAttribute("aria-pressed", "false");
  });

  it("moves the selection to the next pressed button", async () => {
    const port = mountWithPort();
    await press("Direct");
    await expectChannelParam(port, "Direct");

    await press("Marketplace");

    await expectChannelParam(port, "Marketplace");
    expect(option("Direct")).toHaveAttribute("aria-pressed", "false");
  });

  it("deselects on pressing the pressed button, deleting the param", async () => {
    const port = mountWithPort({}, "?channel=Direct");
    await expectPressed("Direct");

    await press("Direct");

    await expectParamCleared(port, "channel");
    expect(option("Direct")).toHaveAttribute("aria-pressed", "false");
  });

  it("hydrates the pressed button from a ?channel= param on first render", async () => {
    mountWithPort({}, "?channel=Partner");

    await expectPressed("Partner");
  });

  it("keeps element 0 of an array param in single mode", async () => {
    const port = mountWithPort({}, '?channel=["Direct","Marketplace"]');

    await expectChannelParam(port, "Direct");
    expect(option("Direct")).toHaveAttribute("aria-pressed", "true");
  });
});

describe("ButtonGroup — multiple", () => {
  it('writes ?channel=["a","b"] across presses', async () => {
    const port = mountWithPort({ multiple: true });

    await press("Direct");
    await press("Marketplace");

    await expectChannelParam(port, '["Direct","Marketplace"]');
    expect(option("Direct")).toHaveAttribute("aria-pressed", "true");
    expect(option("Marketplace")).toHaveAttribute("aria-pressed", "true");
  });

  it("unpresses a picked option on a second click", async () => {
    const port = mountWithPort({ multiple: true });
    await press("Direct");
    await press("Marketplace");
    await expectChannelParam(port, '["Direct","Marketplace"]');

    await press("Direct");

    await expectChannelParam(port, '["Marketplace"]');
  });

  it("wraps a bare ?channel=Direct param into an array", async () => {
    const port = mountWithPort({ multiple: true }, "?channel=Direct");

    await expectPressed("Direct");
    await expectChannelParam(port, '["Direct"]');
  });
});

describe("ButtonGroup — defaults", () => {
  it("selectFirst seeds the first option without a URL write", async () => {
    const port = mountWithPort({ selectFirst: true });

    await expectPressed("Direct");
    expect(port.written).toHaveLength(0);
  });

  it("never re-seeds after the reader deselects", async () => {
    mountWithPort({ selectFirst: true });
    await expectPressed("Direct");

    await press("Direct");

    await expectPressed("Direct", false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(option("Direct")).toHaveAttribute("aria-pressed", "false");
  });

  it("seeds initialValue when the URL holds nothing", async () => {
    const port = mountWithPort({ initialValue: "Partner" });

    await expectPressed("Partner");
    expect(port.written).toHaveLength(0);
  });

  it("prefers the URL param over selectFirst", async () => {
    mountWithPort({ selectFirst: true }, "?channel=Referral");

    await expectPressed("Referral");
    expect(option("Direct")).toHaveAttribute("aria-pressed", "false");
  });
});

describe("ButtonGroup — stale-value pruning", () => {
  it("clears a URL value missing from the loaded option set", async () => {
    const port = mountWithPort({}, "?channel=ghost");

    await expectParamCleared(port, "channel");
  });

  it("keeps the URL value while the options query is pending", async () => {
    const port = new FakeFilterUrlPort("?channel=ghost");
    renderButtonGroup({}, { db: FakeDuckDb.pending(), port });

    await waitFor(() => channelGroup());
    await expectNoUrlWrites(port);
  });

  it("keeps the URL value when options load empty", async () => {
    const port = new FakeFilterUrlPort("?channel=Direct");
    renderButtonGroup({}, { db: FakeDuckDb.withRows([]), port });

    await screen.findByRole("button", { name: "No options available" });
    expect(port.written).toHaveLength(0);
  });
});

describe("ButtonGroup — failure and loading faces", () => {
  it("shows an inline alert when data names no fence", async () => {
    renderButtonGroup({ data: "ghost" });

    await expectAlert("ghost", "no sql fence");
  });

  it("shows an inline alert naming the failing query", async () => {
    renderButtonGroup(
      {},
      { db: FakeDuckDb.failing("Catalog Error: Table mix does not exist") },
    );

    await expectAlert("mix", "does not exist");
  });

  it("shows an inline alert when data is set without valueColumn", async () => {
    renderButtonGroup({ valueColumn: undefined });

    await expectAlert("valueColumn");
  });

  it("disables the group while the option query is in flight", async () => {
    renderButtonGroup({}, { db: FakeDuckDb.pending() });

    await waitFor(() =>
      expect(channelGroup()).toHaveAttribute("data-disabled"),
    );
  });

  it("degrades to disabled without a FiltersProvider", async () => {
    renderButtonGroup({}, { filters: false });

    await waitFor(() => expect(option("Direct")).toBeDisabled());
  });

  it("renders a disabled 'No options available' item when options load empty", async () => {
    renderButtonGroup({}, { db: FakeDuckDb.withRows([]) });

    const empty = await screen.findByRole("button", {
      name: "No options available",
    });
    expect(empty).toBeDisabled();
  });

  it("names the group from titleCase(id) when title is absent", async () => {
    renderButtonGroup({ title: undefined });

    await waitFor(() =>
      expect(screen.getByRole("group", { name: "Channel" })).toBeDefined(),
    );
  });
});
