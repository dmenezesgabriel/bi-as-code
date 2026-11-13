/** The browser objects `saveCsv` touches, so a test can hand in a fake. */
export interface DownloadHost {
  readonly document: {
    readonly body: HTMLElement;
    createElement(tag: "a"): HTMLAnchorElement;
  };
  readonly url: {
    createObjectURL(blob: Blob): string;
    revokeObjectURL(url: string): void;
  };
}

/** Read at call time, so importing this module outside a browser is safe. */
const browserHost = (): DownloadHost => ({ document, url: URL });

/**
 * Hands CSV text to the browser as a file the reader saves, with no server
 * round trip: the text becomes a Blob, an anchor carrying a `download`
 * attribute points at it and is clicked. The anchor is attached to the body
 * for the click because Firefox ignores a click on a detached anchor. The
 * object URL is revoked right after the click, once the browser has taken
 * the download.
 *
 * @example
 * saveCsv("weekly_trend.csv", toCsv(rows, columns))
 */
export function saveCsv(
  filename: string,
  text: string,
  host: DownloadHost = browserHost(),
): void {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const objectUrl = host.url.createObjectURL(blob);
  const anchor = host.document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  host.document.body.append(anchor);
  anchor.click();
  anchor.remove();
  host.url.revokeObjectURL(objectUrl);
}
