import type { Decorator } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { FakeDuckDb } from "../../data/fake-duckdb";
import type { Row } from "../../data/types";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import type { SqlBlock } from "../../pages/types";
import {
  withPageFilters,
  withQueryData,
} from "../../../../.storybook/decorators";

/**
 * The `channel_mix` fixture the input widgets' stories share — the five-
 * channel rows, a `query + filters` decorator factory, and the inline-alert
 * assertion. Distinct from `select-harness`'s unit-test rows (which carry a
 * duplicate row and no `share`).
 */
export const MIX: SqlBlock = {
  name: "mix",
  sql: "select channel, share from channel_mix",
};

export const CHANNELS: Row[] = [
  { channel: "Direct", share: 0.46 },
  { channel: "Marketplace", share: 0.32 },
  { channel: "Partner", share: 0.22 },
  { channel: "Referral", share: 0.1 },
  { channel: "Organic", share: 0.08 },
];

/** The query-backed decoration most input stories share — fresh fakes per call. */
export function channelDecorators(search?: string): Decorator[] {
  return [
    withQueryData([MIX], FakeDuckDb.withRows(CHANNELS)),
    withPageFilters(new FakeFilterUrlPort(search)),
  ];
}

/** Two channels whose `label` column differs from the `channel` value. */
export function labelledChannelDecorators(): Decorator[] {
  return [
    withQueryData(
      [MIX],
      FakeDuckDb.withRows([
        { channel: "D", label: "Direct channel" },
        { channel: "M", label: "Marketplace channel" },
      ]),
    ),
    withPageFilters(new FakeFilterUrlPort("")),
  ];
}

export type StoryCanvas = ReturnType<typeof within>;

/** Asserts the inline `role=alert` carries every fragment. */
export async function expectAlert(
  canvas: StoryCanvas,
  ...fragments: (string | RegExp)[]
): Promise<void> {
  const alert = await canvas.findByRole("alert");
  for (const fragment of fragments) {
    await expect(alert).toHaveTextContent(fragment);
  }
}
