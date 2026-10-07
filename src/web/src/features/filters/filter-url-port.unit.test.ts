import { describe, expect, it, vi } from "vitest";
import { browserFilterUrlPort } from "./filter-url-port";

describe("browserFilterUrlPort", () => {
  it("reads the current location as a URL", () => {
    window.history.replaceState(null, "", "/weekly-review?region=West");
    const url = browserFilterUrlPort.read();
    expect(url).toBeInstanceOf(URL);
    expect(url!.searchParams.get("region")).toBe("West");
  });

  it("writes through history.replaceState, never pushState", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    const target = new URL(window.location.href);
    target.searchParams.set("region", "West");
    browserFilterUrlPort.write(target);
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe("?region=West");
  });
});
