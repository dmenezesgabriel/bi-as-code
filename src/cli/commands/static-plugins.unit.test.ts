import { describe, expect, it } from "vitest";
import { staticHostPlugins } from "./static-plugins.js";

describe("staticHostPlugins", () => {
  it("returns the framing, data CORS, widget CORS and data media-type plugins in that order", () => {
    const plugins = staticHostPlugins("/", "/site/build", {
      origins: [],
      dataOrigins: [],
    });

    expect(plugins.map((plugin) => plugin.name)).toEqual([
      "biac:preview-framing-policy",
      "biac:preview-data-cors",
      "biac:preview-module-cors",
      "biac:preview-data-media-types",
    ]);
  });
});
