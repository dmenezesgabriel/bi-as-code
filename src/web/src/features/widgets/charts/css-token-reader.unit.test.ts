import { afterEach, describe, expect, it } from "vitest";
import { withTokenProbe } from "./css-token-reader";

const readBorder = (read: (name: string) => string): string =>
  read("--border").trim();

describe("withTokenProbe", () => {
  afterEach(() => {
    document.documentElement.classList.remove("dark");
  });

  it("reads the light tokens while the root is still dark", () => {
    document.documentElement.classList.add("dark");

    const border = withTokenProbe("light", readBorder);

    expect(border).toBe("#e5e5e5");
  });

  it("reads the dark tokens while the root is still light", () => {
    const border = withTokenProbe("dark", readBorder);

    expect(border).toBe("#262626");
  });

  it("leaves no probe in the document", () => {
    const before = document.body.childElementCount;

    withTokenProbe("dark", readBorder);

    expect(document.body.childElementCount).toBe(before);
  });

  it("removes the probe when the reader throws", () => {
    const before = document.body.childElementCount;

    const read = () =>
      withTokenProbe("light", () => {
        throw new Error("unreadable");
      });

    expect(read).toThrow("unreadable");
    expect(document.body.childElementCount).toBe(before);
  });

  it("appends the probe to the given parent instead of the body", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const before = document.body.childElementCount;
    const probes: Element[] = [];

    withTokenProbe(
      "light",
      () => {
        probes.push(...parent.querySelectorAll("div.light"));
      },
      parent,
    );

    expect(probes).toHaveLength(1);
    expect(document.body.childElementCount).toBe(before);
    parent.remove();
  });

  it("removes the probe from the given parent when the reader throws", () => {
    const parent = document.createElement("div");
    document.body.append(parent);

    const read = () =>
      withTokenProbe(
        "light",
        () => {
          throw new Error("unreadable");
        },
        parent,
      );

    expect(read).toThrow("unreadable");
    expect(parent.childElementCount).toBe(0);
    parent.remove();
  });
});
