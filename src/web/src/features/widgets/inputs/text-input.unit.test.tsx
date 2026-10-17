import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeDuckDb } from "../../data/fake-duckdb";
import { useFilteredQueryRows } from "../../filters/use-filtered-query-rows";
import type { Filter } from "../../filters/filter";
import { usePageFilter } from "../../filters/use-page-filter";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import type { SqlBlock } from "../../pages/types";
import { renderWithRegistry } from "../value/registry-harness";
import { FIELD_CONTROL_HEIGHT, FIELD_LABEL_ROW } from "./field-line";
import { ParamsBridge } from "./params-bridge";
import { expectParamCleared, lastWrittenParam } from "./select-harness";
import { TextInput } from "./text-input";
import type { TextInputProps } from "./types";

const ORDERS: SqlBlock = { name: "orders", sql: "select * from orders" };

/** A `{{params.q}}` consumer fence — re-runs whenever `?q=` changes. */
const HITS: SqlBlock = {
  name: "hits",
  sql: "select * from orders where name ilike {{params.q}}",
};

interface MountOptions {
  readonly db?: FakeDuckDb;
  readonly blocks?: readonly SqlBlock[];
  readonly port?: FakeFilterUrlPort;
  readonly provider?: boolean;
  readonly consumer?: boolean;
  readonly bridge?: boolean;
  readonly extra?: ReactElement;
}

/** A `filters=["q"]` consumer probe — a `column: false` filter never reaches it. */
function QConsumer(): ReactElement | null {
  useFilteredQueryRows("orders", "q");
  return null;
}

/** Renders `<TextInput id="q" title="Search">`, optionally with the consumer/params probes. */
function renderTextInput(
  props: Partial<TextInputProps> = {},
  {
    db,
    blocks,
    port,
    provider = true,
    consumer = false,
    bridge = false,
    extra,
  }: MountOptions = {},
): FakeDuckDb {
  const activePort = port ?? new FakeFilterUrlPort("");
  return renderWithRegistry(
    <>
      <TextInput id="q" title="Search" {...props} />
      {consumer && <QConsumer />}
      {bridge && <ParamsBridge id="q" blocks={[HITS]} port={activePort} />}
      {extra}
    </>,
    {
      db: db ?? FakeDuckDb.withRows([]),
      blocks: blocks ?? [],
      port: provider ? activePort : undefined,
    },
  );
}

/** Mounts the widget with a fresh port at `search` and returns it for write assertions. */
function mountWithPort(
  props: Partial<TextInputProps> = {},
  search = "",
): FakeFilterUrlPort {
  const port = new FakeFilterUrlPort(search);
  renderTextInput(props, { port });
  return port;
}

/** The rendered textbox — `role="textbox"`, named by its label. */
function field(name = "Search"): HTMLElement {
  return screen.getByRole("textbox", { name });
}

describe("TextInput — field", () => {
  it("renders a textbox named by title", () => {
    renderTextInput();
    expect(field()).toBeEnabled();
  });

  it("labels the field titleCase(id) when title is absent", () => {
    renderTextInput({ title: undefined });
    expect(field("Q")).toBeEnabled();
  });

  it("shows 'Enter text...' as the default placeholder", () => {
    renderTextInput();
    expect(field()).toHaveAttribute("placeholder", "Enter text...");
  });

  it("honors the placeholder prop", () => {
    renderTextInput({ placeholder: "Find an order" });
    expect(field()).toHaveAttribute("placeholder", "Find an order");
  });

  it("sits on the filter bar's label row and control height", () => {
    renderTextInput();

    expect(screen.getByText("Search")).toHaveClass(FIELD_LABEL_ROW);
    expect(field()).toHaveClass(FIELD_CONTROL_HEIGHT);
  });
});

describe("TextInput — debounced commit", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes ?q=<text> only after ~300ms of quiet, never per keystroke", async () => {
    const port = mountWithPort();
    const input = field();
    vi.useFakeTimers();
    try {
      fireEvent.change(input, { target: { value: "a" } });
      fireEvent.change(input, { target: { value: "ab" } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(299);
      });
      expect(port.written).toHaveLength(0);

      fireEvent.change(input, { target: { value: "abc" } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(lastWrittenParam(port, "q")).toBe("abc");
      expect(port.written).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("commits on blur without waiting out the debounce", async () => {
    const port = mountWithPort();
    const input = field();
    vi.useFakeTimers();
    try {
      fireEvent.change(input, { target: { value: "abc" } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(port.written).toHaveLength(0);

      fireEvent.blur(input);
      expect(lastWrittenParam(port, "q")).toBe("abc");
    } finally {
      vi.useRealTimers();
    }
  });

  it("commits on Enter without waiting out the debounce", async () => {
    const port = mountWithPort();
    const input = field();
    vi.useFakeTimers();
    try {
      fireEvent.change(input, { target: { value: "abc" } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(port.written).toHaveLength(0);

      fireEvent.keyDown(input, { key: "Enter" });
      expect(lastWrittenParam(port, "q")).toBe("abc");
    } finally {
      vi.useRealTimers();
    }
  });

  it("deletes ?q when the field is cleared", async () => {
    const port = mountWithPort({}, "?q=abc");
    const input = field();
    expect(input).toHaveValue("abc");

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    await expectParamCleared(port, "q");
  });
});

describe("TextInput — value lifecycle", () => {
  it("restores the field from a ?q= param on first render", () => {
    mountWithPort({}, "?q=north%20wind");
    expect(field()).toHaveValue("north wind");
  });

  it("seeds initialValue without a URL write", () => {
    const port = mountWithPort({ initialValue: "north" });
    expect(field()).toHaveValue("north");
    expect(port.written).toHaveLength(0);
  });

  it("follows an external filter write into the field", async () => {
    let held: Filter<string> | undefined;
    function Capture(): null {
      held = usePageFilter<string>("q");
      return null;
    }
    renderTextInput({}, { extra: <Capture /> });

    act(() => held?.applySerialized("east"));

    await waitFor(() => expect(field()).toHaveValue("east"));
  });
});

describe("TextInput — predicate", () => {
  it('contributes nothing to a filters=["q"] consumer even with a value', async () => {
    const db = renderTextInput(
      {},
      {
        port: new FakeFilterUrlPort("?q=abc"),
        consumer: true,
        blocks: [ORDERS],
      },
    );

    await waitFor(() => expect(db.queries.length).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(
      db.queries.filter(({ sql }) => sql.includes("where q")),
    ).toHaveLength(0);
  });
});

describe("TextInput — params consumption", () => {
  it("re-queries a {{params.q}} fence with the committed value", async () => {
    const port = new FakeFilterUrlPort("");
    const db = renderTextInput({}, { port, bridge: true });
    await waitFor(() =>
      expect(db.queries).toContainEqual({
        sql: "select * from orders where name ilike ?",
        params: [null],
      }),
    );

    const input = field();
    fireEvent.change(input, { target: { value: "north" } });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(db.queries).toContainEqual({
        sql: "select * from orders where name ilike ?",
        params: ["north"],
      }),
    );
  });
});

describe("TextInput — degraded faces", () => {
  it("degrades to disabled without a FiltersProvider", () => {
    renderTextInput({}, { provider: false });
    expect(field()).toBeDisabled();
  });
});
