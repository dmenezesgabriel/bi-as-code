import { describe, expect, it } from "vitest";
import { withEmbedOrigins } from "./framing-policy.js";

describe("withEmbedOrigins", () => {
  it("adds embed.origins as the config's last key", () => {
    const source = 'export default {\n  title: "biac",\n};\n';

    const edited = withEmbedOrigins(source, ["http://localhost:8901"]);

    expect(edited).toBe(
      'export default {\n  title: "biac",\n  embed: { origins: ["http://localhost:8901"] },\n};\n',
    );
  });

  it("adds embed.dataOrigins when asked for that list", () => {
    const source = 'export default {\n  title: "biac",\n};\n';

    const edited = withEmbedOrigins(
      source,
      ["http://127.0.0.1:8901"],
      "dataOrigins",
    );

    expect(edited).toBe(
      'export default {\n  title: "biac",\n  embed: { dataOrigins: ["http://127.0.0.1:8901"] },\n};\n',
    );
  });

  it("refuses a config it cannot append to, naming its ending", () => {
    expect(() => withEmbedOrigins("export default config;\n", [])).toThrow(
      'withEmbedOrigins needs a config ending in "\\n};", got "export default config;\\n"',
    );
  });
});
