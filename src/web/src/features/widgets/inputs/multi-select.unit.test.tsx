import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { Row } from "../../data/types";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import { MultiSelect } from "./multi-select";
import {
  CHANNEL_MIX,
  CHANNEL_ROWS,
  clearViaPopup,
  clickOption,
  comboboxField,
  expectMissingFenceAlert,
  expectNoUrlWrites,
  expectParamCleared,
  expectRegionCascade,
  mountSelectInput,
  openSelectPopup,
  regionCascadeDb,
  type SelectMountOptions,
} from "./select-harness";
import type { MultiSelectProps } from "./types";

const ALL_CHANNELS = [
  "Direct",
  "Marketplace",
  "Partner",
  "Referral",
  "Organic",
];

/** Renders `<MultiSelect>` bound to the `channel` filter over the `channel_mix` fence. */
function renderMultiSelect(
  props: Partial<MultiSelectProps> = {},
  opts: SelectMountOptions = {},
): FakeDuckDb {
  return mountSelectInput(
    <MultiSelect id="channel" data="mix" valueColumn="channel" {...props} />,
    { blocks: [CHANNEL_MIX], db: FakeDuckDb.withRows(CHANNEL_ROWS), ...opts },
  );
}

/** The chip for a selected value — its `Remove …` button proves it. */
function removeButton(value: string) {
  return screen.queryByRole("button", { name: `Remove ${value}` });
}

/** The `channel` param of the port's last write. */
function lastParam(port: FakeFilterUrlPort): string | null {
  return port.written.at(-1)?.searchParams.get("channel") ?? null;
}

describe("MultiSelect — option source", () => {
  it("lists distinct valueColumn values in fence order", async () => {
    renderMultiSelect();
    await openSelectPopup();

    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(ALL_CHANNELS);
  });

  it("shows labelColumn text in the list but the value in the URL", async () => {
    const port = new FakeFilterUrlPort("");
    const rows: Row[] = [
      { channel: "D", label: "Direct channel" },
      { channel: "M", label: "Marketplace channel" },
    ];
    renderMultiSelect(
      { labelColumn: "label" },
      { db: FakeDuckDb.withRows(rows), port },
    );
    await openSelectPopup();

    fireEvent.click(
      await screen.findByRole("option", { name: "Direct channel" }),
    );
    await waitFor(() => expect(lastParam(port)).toBe('["D"]'));
  });

  it("renders the options prop when data is absent", async () => {
    renderMultiSelect(
      {
        data: undefined,
        valueColumn: undefined,
        options: ["Direct", "Partner"],
      },
      { blocks: [] },
    );
    await openSelectPopup();

    expect(
      (await screen.findAllByRole("option")).map((o) => o.textContent),
    ).toEqual(["Direct", "Partner"]);
  });

  it("narrows the option source through the filters prop", async () => {
    const db = regionCascadeDb(
      [{ channel: "Direct" }, { channel: "Partner" }],
      [{ channel: "Direct" }],
    );
    renderMultiSelect(
      { filters: "region" },
      { db, port: new FakeFilterUrlPort("?region=West") },
    );

    await expectRegionCascade(db, "select * from channel_mix");
  });
});

describe("MultiSelect — selection lifecycle", () => {
  it('writes ?channel=["a","b"] and renders a chip per pick', async () => {
    const port = new FakeFilterUrlPort("");
    renderMultiSelect({}, { port });
    await openSelectPopup();

    await clickOption("Direct");
    await clickOption("Marketplace");

    await waitFor(() =>
      expect(lastParam(port)).toBe('["Direct","Marketplace"]'),
    );
    expect(removeButton("Direct")).not.toBeNull();
    expect(removeButton("Marketplace")).not.toBeNull();
  });

  it("deselects a picked option on a second click", async () => {
    const port = new FakeFilterUrlPort("");
    renderMultiSelect({}, { port });
    await openSelectPopup();
    await clickOption("Direct");
    await clickOption("Marketplace");
    await waitFor(() =>
      expect(lastParam(port)).toBe('["Direct","Marketplace"]'),
    );

    await clickOption("Direct");
    await waitFor(() => expect(lastParam(port)).toBe('["Marketplace"]'));
  });

  it("hydrates chips from an array URL param on first render", async () => {
    renderMultiSelect(
      {},
      { port: new FakeFilterUrlPort('?channel=["Direct","Marketplace"]') },
    );

    await waitFor(() => {
      expect(removeButton("Direct")).not.toBeNull();
      expect(removeButton("Marketplace")).not.toBeNull();
    });
  });

  it("wraps a bare ?channel=Direct param into an array", async () => {
    const port = new FakeFilterUrlPort("?channel=Direct");
    renderMultiSelect({}, { port });

    await waitFor(() => expect(removeButton("Direct")).not.toBeNull());
    await waitFor(() => expect(lastParam(port)).toBe('["Direct"]'));
  });

  it("removes a chip through its Remove button", async () => {
    const port = new FakeFilterUrlPort('?channel=["Direct","Marketplace"]');
    renderMultiSelect({}, { port });
    await waitFor(() => expect(removeButton("Direct")).not.toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Remove Direct" }));

    await waitFor(() => expect(lastParam(port)).toBe('["Marketplace"]'));
    await waitFor(() => expect(removeButton("Direct")).toBeNull());
  });

  it("removes the last chip on Backspace in an empty input", async () => {
    const port = new FakeFilterUrlPort('?channel=["Direct","Marketplace"]');
    renderMultiSelect({}, { port });
    await waitFor(() => expect(removeButton("Marketplace")).not.toBeNull());

    fireEvent.keyDown(comboboxField(), { key: "Backspace" });

    await waitFor(() => expect(lastParam(port)).toBe('["Direct"]'));
  });

  it("removes the param on Clear", async () => {
    const port = new FakeFilterUrlPort('?channel=["Direct","Marketplace"]');
    renderMultiSelect({}, { port });

    await clearViaPopup(port, "channel");
    expect(removeButton("Direct")).toBeNull();
  });

  it("unions every filtered option into the selection on Select All", async () => {
    const port = new FakeFilterUrlPort('?channel=["Partner"]');
    renderMultiSelect({}, { port });
    await openSelectPopup();

    fireEvent.click(await screen.findByRole("button", { name: "Select All" }));

    // Existing picks keep their slots ahead of the unioned filtered options.
    await waitFor(() =>
      expect(lastParam(port)).toBe(
        '["Partner","Direct","Marketplace","Referral","Organic"]',
      ),
    );
  });

  it("selects only the narrowed options when Select All runs mid-search", async () => {
    const port = new FakeFilterUrlPort("");
    renderMultiSelect({}, { port });
    await openSelectPopup();
    fireEvent.change(comboboxField(), { target: { value: "partner" } });
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: "Select All" }));

    await waitFor(() => expect(lastParam(port)).toBe('["Partner"]'));
  });
});

describe("MultiSelect — search", () => {
  it("narrows options by substring typed in the field input", async () => {
    renderMultiSelect();
    await openSelectPopup();
    fireEvent.change(comboboxField(), { target: { value: "part" } });

    await waitFor(() =>
      expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
        "Partner",
      ]),
    );
  });

  it("keeps the popup open and the query typed after a pick", async () => {
    renderMultiSelect();
    await openSelectPopup();
    fireEvent.change(comboboxField(), { target: { value: "part" } });
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));

    fireEvent.click(screen.getByRole("option", { name: "Partner" }));

    expect(screen.getByRole("option", { name: "Partner" })).toBeDefined();
    expect(comboboxField()).toHaveValue("part");
  });

  it("shows the empty state when nothing matches", async () => {
    renderMultiSelect();
    await openSelectPopup();
    fireEvent.change(comboboxField(), { target: { value: "zzz" } });

    expect(await screen.findByText("No options found")).toBeVisible();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("keeps the input readonly but opens on search={false}", async () => {
    renderMultiSelect({ search: false });

    expect(comboboxField()).toHaveAttribute("readonly");
    await openSelectPopup();
    expect(await screen.findAllByRole("option")).toHaveLength(
      ALL_CHANNELS.length,
    );
  });
});

describe("MultiSelect — defaults", () => {
  it("defaultTopN seeds the first N options without a URL write", async () => {
    const port = new FakeFilterUrlPort("");
    renderMultiSelect({ defaultTopN: 2 }, { port });

    await waitFor(() => {
      expect(removeButton("Direct")).not.toBeNull();
      expect(removeButton("Marketplace")).not.toBeNull();
    });
    expect(removeButton("Partner")).toBeNull();
    expect(port.written).toHaveLength(0);
  });

  it("never re-seeds after the reader clears a defaultTopN seed", async () => {
    const port = new FakeFilterUrlPort("");
    renderMultiSelect({ defaultTopN: 2 }, { port });
    await waitFor(() => expect(removeButton("Direct")).not.toBeNull());

    await clearViaPopup(port, "channel");
    expect(removeButton("Direct")).toBeNull();
    expect(removeButton("Marketplace")).toBeNull();
  });

  it("seeds initialValue when the URL holds nothing", async () => {
    const port = new FakeFilterUrlPort("");
    renderMultiSelect({ initialValue: ["Partner", "Referral"] }, { port });

    await waitFor(() => {
      expect(removeButton("Partner")).not.toBeNull();
      expect(removeButton("Referral")).not.toBeNull();
    });
    expect(port.written).toHaveLength(0);
  });

  it("prefers the URL param over defaultTopN", async () => {
    const port = new FakeFilterUrlPort("?channel=Referral");
    renderMultiSelect({ defaultTopN: 2 }, { port });

    await waitFor(() => expect(removeButton("Referral")).not.toBeNull());
    expect(removeButton("Direct")).toBeNull();
    expect(removeButton("Marketplace")).toBeNull();
  });
});

describe("MultiSelect — stale-value pruning", () => {
  it("drops only the stale entries from a URL-seeded array", async () => {
    const port = new FakeFilterUrlPort('?channel=["Direct","ghost"]');
    renderMultiSelect({}, { port });

    await waitFor(() => expect(lastParam(port)).toBe('["Direct"]'));
    expect(removeButton("ghost")).toBeNull();
  });

  it("deletes the param when every entry is stale", async () => {
    const port = new FakeFilterUrlPort('?channel=["ghost","atlantis"]');
    renderMultiSelect({}, { port });

    await expectParamCleared(port, "channel");
  });

  it("keeps the URL value while the options query is pending", async () => {
    const port = new FakeFilterUrlPort('?channel=["ghost"]');
    renderMultiSelect({}, { db: FakeDuckDb.pending(), port });

    await waitFor(() => expect(comboboxField()).toBeInTheDocument());
    await expectNoUrlWrites(port);
  });

  it("keeps the URL value when options load empty", async () => {
    const port = new FakeFilterUrlPort('?channel=["Direct"]');
    renderMultiSelect({}, { db: FakeDuckDb.withRows([]), port });

    await waitFor(() => expect(removeButton("Direct")).not.toBeNull());
    expect(port.written).toHaveLength(0);
  });
});

describe("MultiSelect — failure and loading faces", () => {
  it("shows an inline alert when data names no fence", async () => {
    renderMultiSelect({ data: "ghost" });

    await expectMissingFenceAlert("ghost");
  });

  it("disables the field while the option query is in flight", async () => {
    renderMultiSelect({}, { db: FakeDuckDb.pending() });

    await waitFor(() => expect(comboboxField()).toBeDisabled());
  });

  it("degrades to disabled without a FiltersProvider", async () => {
    renderMultiSelect({}, { filters: false });

    await waitFor(() => expect(comboboxField()).toBeDisabled());
  });
});
