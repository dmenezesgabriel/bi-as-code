import type { StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

type PlayContext = Parameters<NonNullable<StoryObj["play"]>>[0];

/** An empty result reads `–` and raises no alert: a filter that matches nothing is not an error. */
export async function expectEmptyDash({ canvas }: PlayContext): Promise<void> {
  await expect(await canvas.findByText("–")).toBeInTheDocument();
  await expect(canvas.queryByRole("alert")).toBeNull();
}

/** An unsupported `fmt` code names itself in the alert instead of crashing the page. */
export async function expectBogusFmtAlert({
  canvas,
}: PlayContext): Promise<void> {
  await expect(await canvas.findByRole("alert")).toHaveTextContent(
    'fmt="bogus"',
  );
}

/**
 * A `column` absent from the row names itself and lists the columns the query returned.
 *
 * @example
 * play: expectColumnAlert("sales", "revenue, wow_pct, orders")
 */
export function expectColumnAlert(
  column: string,
  returned: string,
): (context: PlayContext) => Promise<void> {
  return async ({ canvas }) => {
    const alert = await canvas.findByRole("alert");
    await expect(alert).toHaveTextContent(`"${column}"`);
    await expect(alert).toHaveTextContent(returned);
  };
}
