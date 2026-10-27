import { describe, expect, it } from "vitest";
import {
  recheckAfterWatcherThrottle,
  WATCHER_CHANGE_THROTTLE_MS,
  type Schedule,
} from "./missed-write-recheck.js";

/** Holds scheduled callbacks until the test runs them. */
class FakeScheduler {
  readonly delays: number[] = [];
  private readonly callbacks: Array<() => void> = [];

  readonly schedule: Schedule = (callback, delayMs) => {
    this.callbacks.push(callback);
    this.delays.push(delayMs);
  };

  runAll(): void {
    this.callbacks.splice(0).forEach((callback) => callback());
  }
}

/** A file whose text the test rewrites between reads. */
class FakeSource {
  constructor(public text: string | undefined) {}

  readonly read = (): string | undefined => this.text;
}

describe("recheckAfterWatcherThrottle", () => {
  it("reports a write that landed inside the watcher's throttle window", () => {
    // Arrange
    const scheduler = new FakeScheduler();
    const source = new FakeSource("export default { title: 'A' };");
    const missed: string[] = [];
    recheckAfterWatcherThrottle(
      source.read,
      () => missed.push(source.text!),
      scheduler.schedule,
    );

    // Act
    source.text = "export default { title: 'B' };";
    scheduler.runAll();

    // Assert
    expect(missed).toEqual(["export default { title: 'B' };"]);
  });

  it("stays quiet when the file has not changed since the reported write", () => {
    const scheduler = new FakeScheduler();
    const source = new FakeSource("export default {};");
    let missed = 0;
    recheckAfterWatcherThrottle(
      source.read,
      () => missed++,
      scheduler.schedule,
    );

    scheduler.runAll();

    expect(missed).toBe(0);
  });

  it("reports a file deleted inside the window", () => {
    const scheduler = new FakeScheduler();
    const source = new FakeSource("export default {};");
    let missed = 0;
    recheckAfterWatcherThrottle(
      source.read,
      () => missed++,
      scheduler.schedule,
    );

    source.text = undefined;
    scheduler.runAll();

    expect(missed).toBe(1);
  });

  it("looks again only once the throttle window has closed", () => {
    const scheduler = new FakeScheduler();

    recheckAfterWatcherThrottle(
      () => "",
      () => {},
      scheduler.schedule,
    );

    expect(scheduler.delays).toHaveLength(1);
    expect(scheduler.delays[0]).toBeGreaterThan(WATCHER_CHANGE_THROTTLE_MS);
  });
});
