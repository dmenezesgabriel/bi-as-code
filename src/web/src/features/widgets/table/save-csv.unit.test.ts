import { describe, expect, it } from "vitest";
import { type DownloadHost, saveCsv } from "./save-csv";

const BOM = "﻿";

/**
 * A browser stand-in that records what `saveCsv` does, in order. The anchor is
 * a real jsdom element whose `click` notes whether it was attached to the body.
 */
class FakeDownloadHost implements DownloadHost {
  readonly events: string[] = [];
  readonly blobs: Blob[] = [];
  anchor: HTMLAnchorElement | undefined;
  attachedAtClick: boolean | undefined;

  readonly document = {
    body: window.document.body,
    createElement: (tag: "a"): HTMLAnchorElement => {
      const anchor = window.document.createElement(tag);
      anchor.click = () => {
        this.attachedAtClick = anchor.isConnected;
        this.events.push("click");
      };
      this.anchor = anchor;
      return anchor;
    },
  };

  readonly url = {
    createObjectURL: (blob: Blob): string => {
      this.blobs.push(blob);
      this.events.push("create");
      return "blob:fake-url";
    },
    revokeObjectURL: (url: string): void => {
      this.events.push(`revoke ${url}`);
    },
  };
}

describe("saveCsv", () => {
  it("names the saved file and points the anchor at the object URL", () => {
    const host = new FakeDownloadHost();

    saveCsv("weekly_trend.csv", `${BOM}a`, host);

    expect(host.anchor?.getAttribute("download")).toBe("weekly_trend.csv");
    expect(host.anchor?.getAttribute("href")).toBe("blob:fake-url");
  });

  it("hands the browser the exact UTF-8 bytes, BOM included, as a CSV blob", async () => {
    const host = new FakeDownloadHost();
    const text = `${BOM}Região\r\nSão Paulo`;

    saveCsv("regions.csv", text, host);

    // Bytes, not `blob.text()`: that decodes UTF-8 and drops the BOM.
    const bytes = new Uint8Array((await host.blobs[0]?.arrayBuffer()) ?? []);
    expect(host.blobs).toHaveLength(1);
    expect(host.blobs[0]?.type).toBe("text/csv;charset=utf-8");
    expect([...bytes]).toEqual([...new TextEncoder().encode(text)]);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("clicks the anchor once, while it is attached, and removes it after", () => {
    const host = new FakeDownloadHost();

    saveCsv("a.csv", "x", host);

    expect(host.events.filter((e) => e === "click")).toHaveLength(1);
    expect(host.attachedAtClick).toBe(true);
    expect(host.anchor?.isConnected).toBe(false);
  });

  it("revokes the object URL once, after the click", () => {
    const host = new FakeDownloadHost();

    saveCsv("a.csv", "x", host);

    expect(host.events).toEqual(["create", "click", "revoke blob:fake-url"]);
  });
});
