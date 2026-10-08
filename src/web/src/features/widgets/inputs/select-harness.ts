import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect } from "vitest";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { Row } from "../../data/types";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import type { SqlBlock } from "../../pages/types";
import { renderWithRegistry } from "../value/registry-harness";

/**
 * jsdom helpers and fixtures shared by the select-input widgets' unit tests.
 * The popup lives in a portal, so all queries run against `screen` — and
 * both single- and multi-selects get a `role="combobox"` field element (the
 * trigger button in single mode, the chips input in multi), while the
 * single popup's search input is distinguished by its "Search" label.
 */

/** The `channel_mix` fence and its distinct channel column (5 values, one dup). */
export const CHANNEL_MIX: SqlBlock = {
  name: "mix",
  sql: "select * from channel_mix",
};

export const CHANNEL_ROWS: Row[] = [
  { channel: "Direct" },
  { channel: "Marketplace" },
  { channel: "Partner" },
  { channel: "Referral" },
  { channel: "Organic" },
  { channel: "Direct" },
];

/** The optional wiring every select-input render helper accepts. */
export interface SelectMountOptions {
  readonly db?: FakeDuckDb;
  readonly blocks?: readonly SqlBlock[];
  readonly port?: FakeFilterUrlPort;
  readonly filters?: boolean;
}

/**
 * Mounts a select-input element as a compiled page does — registry + runtime
 * + FiltersProvider. `filters: false` drops the provider while keeping
 * runtime+registry, exercising the degraded render; each caller supplies its
 * own default db/blocks, and `port` defaults to a fresh empty fake for URL
 * assertions.
 *
 * @example
 * mountSelectInput(<MultiSelect id="channel" data="mix" valueColumn="channel" />, {
 *   db: FakeDuckDb.withRows(CHANNEL_ROWS),
 *   blocks: [CHANNEL_MIX],
 * });
 */
export function mountSelectInput(
  element: ReactElement,
  { db, blocks, port, filters = true }: SelectMountOptions,
): FakeDuckDb {
  return renderWithRegistry(element, {
    db: db ?? FakeDuckDb.withRows([]),
    blocks: blocks ?? [],
    port: filters ? (port ?? new FakeFilterUrlPort("")) : undefined,
  });
}

/** The field's combobox element — never the popup's "Search" input. */
export function comboboxField(): HTMLElement {
  const field = screen
    .getAllByRole("combobox")
    .find((el) => el.getAttribute("aria-label") !== "Search");
  if (!field) throw new Error("no combobox field rendered");
  return field;
}

/** The single-select popup's search input (multi searches in the field input). */
export function searchInput(): Promise<HTMLElement> {
  return screen.findByRole("combobox", { name: "Search" });
}

/** Opens the popup: the trigger (single) and chips input (multi) both bind mousedown. */
export async function openSelectPopup(): Promise<HTMLElement> {
  await waitFor(() => comboboxField());
  fireEvent.mouseDown(comboboxField());
  return comboboxField();
}

/** Clicks the open popup's option by name. */
export async function clickOption(name: string): Promise<void> {
  fireEvent.click(await screen.findByRole("option", { name }));
}

/** The `id` param of the port's last write, `null` when absent. */
export function lastWrittenParam(
  port: FakeFilterUrlPort,
  id: string,
): string | null {
  return port.written.at(-1)?.searchParams.get(id) ?? null;
}

/** Waits for the `id` param's deletion write. */
export async function expectParamCleared(
  port: FakeFilterUrlPort,
  id: string,
): Promise<void> {
  await waitFor(() =>
    expect(port.written.at(-1)?.searchParams.has(id)).toBe(false),
  );
}

/** A settle window after which `port` must still hold no writes. */
export async function expectNoUrlWrites(
  port: FakeFilterUrlPort,
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(port.written).toHaveLength(0);
}

/** A db serving `filtered` rows once a `region = ?` predicate wraps the sql. */
export function regionCascadeDb(
  unfiltered: Row[],
  filtered: Row[],
): FakeDuckDb {
  return FakeDuckDb.withRowsWhen(unfiltered, (sql) =>
    sql.includes("where region = ?") ? filtered : null,
  );
}

/** Asserts the `region = 'West'` cascade wrapped `fenceSql`. */
export async function expectRegionCascade(
  db: FakeDuckDb,
  fenceSql: string,
): Promise<void> {
  await waitFor(() =>
    expect(db.queries).toContainEqual({
      sql: `select * from (${fenceSql}) where region = ?`,
      params: ["West"],
    }),
  );
}

/** Asserts the inline alert for a `data` name no sql fence on the page declares. */
export async function expectMissingFenceAlert(name: string): Promise<void> {
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(name);
  expect(alert).toHaveTextContent("no sql fence");
  expect(screen.queryByRole("combobox")).toBeNull();
}

/** Opens the popup, clicks Clear, and waits for the `id` param's deletion write. */
export async function clearViaPopup(
  port: FakeFilterUrlPort,
  id: string,
): Promise<void> {
  await openSelectPopup();
  fireEvent.click(await screen.findByRole("button", { name: "Clear" }));
  await expectParamCleared(port, id);
}
