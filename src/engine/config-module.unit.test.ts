import { describe, expect, it } from "vitest";
import { loadBiacConfig } from "./biac-config.js";
import { configModuleSource } from "./config-module.js";

// No biac.config.ts lives there, so the defaults load without a disk read.
const NO_PROJECT = "/nonexistent-biac-project";

describe("configModuleSource", () => {
  it("serves the browser's fields and keeps host-only ones behind", async () => {
    const config = await loadBiacConfig(NO_PROJECT);

    const source = configModuleSource(config);

    const served = JSON.parse(/= (.*);/.exec(source)![1]!) as object;
    expect(Object.keys(served)).toEqual([
      "title",
      "theme",
      "nav",
      "sqlTables",
      "layout",
      "embed",
    ]);
  });

  it("serves the framing allowlist so a framed page can address its parent", async () => {
    const config = await loadBiacConfig(NO_PROJECT);
    const origins = ["https://intranet.example.com"];

    const source = configModuleSource({ ...config, embed: { origins } });

    expect(source).toContain(
      '"embed":{"origins":["https://intranet.example.com"]}',
    );
  });
});
