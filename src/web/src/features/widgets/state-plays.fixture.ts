import type { StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

type PlayContext = Parameters<NonNullable<StoryObj["play"]>>[0];

/** The play of a widget's loading story: its busy region is announced as a status. */
export async function expectLoadingStatus({
  canvas,
}: PlayContext): Promise<void> {
  await expect(
    canvas.getByRole("status", { name: "Loading query result" }),
  ).toBeVisible();
}

/**
 * The play of a widget's error story: an alert that names the failing query
 * and carries `fragment` of the engine's message.
 *
 * @example
 * play: expectErrorAlert("weekly_trend", "does not exist")
 */
export function expectErrorAlert(
  queryName: string,
  fragment: string,
): (context: PlayContext) => Promise<void> {
  return async ({ canvas }) => {
    const alert = canvas.getByRole("alert");
    await expect(alert).toHaveTextContent(queryName);
    await expect(alert).toHaveTextContent(fragment);
  };
}

/** The play of a widget's empty story: a query that matched nothing reads "0 rows". */
export async function expectZeroRows({ canvas }: PlayContext): Promise<void> {
  await expect(canvas.getByText("0 rows")).toBeVisible();
}
