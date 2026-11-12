import { spyOn } from "storybook/test";

/**
 * Runs `clickDownload` and returns the lines of the CSV it handed to the
 * browser. The Blob given to `URL.createObjectURL` is the only place the
 * file's text exists before the browser saves it, so the stories read it there.
 *
 * @example
 * const lines = await downloadedCsvLines(() =>
 *   userEvent.click(canvas.getByRole("button", { name: "Download CSV" })),
 * );
 */
export async function downloadedCsvLines(
  clickDownload: () => Promise<void>,
): Promise<string[]> {
  const createObjectURL = spyOn(URL, "createObjectURL");
  await clickDownload();
  const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
  createObjectURL.mockRestore();
  return (await blob.text()).split("\r\n");
}
