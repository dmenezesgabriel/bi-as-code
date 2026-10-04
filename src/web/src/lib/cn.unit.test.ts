import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("merges conditional class names", () => {
    const hide = false;
    expect(cn("px-2", hide && "hidden", "py-1")).toBe("px-2 py-1");
  });

  it("de-duplicates conflicting Tailwind utilities, last wins", () => {
    expect(cn("px-2 px-4")).toBe("px-4");
  });
});
