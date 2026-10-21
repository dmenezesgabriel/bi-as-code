import { describe, expect, it } from "vitest";
import { readEmbed } from "./embed-config.js";

describe("readEmbed — accepted shapes", () => {
  it("lists no origins when embed is absent", () => {
    const embed = readEmbed({});

    expect(embed).toEqual({ origins: [] });
  });

  it("lists no origins for an embed block without origins", () => {
    const embed = readEmbed({ embed: {} });

    expect(embed).toEqual({ origins: [] });
  });

  it("keeps http and https origins, with and without a port", () => {
    const origins = [
      "https://example.com",
      "http://localhost:8901",
      "http://127.0.0.1:8901",
    ];

    const embed = readEmbed({ embed: { origins } });

    expect(embed).toEqual({ origins });
  });
});

describe("readEmbed — refused shapes", () => {
  const ORIGIN_SHAPE =
    'expected an origin "scheme://host[:port]" (http or https, no path, no wildcard)';

  it.each([
    ["a path", "https://example.com/path"],
    ["a trailing slash", "https://example.com/"],
    ["a query", "https://example.com?q=1"],
    ["credentials", "https://user:pass@example.com"],
    ["upper case", "HTTPS://Example.com"],
    ["the default port spelled out", "https://example.com:443"],
    ["a bare wildcard", "*"],
    ["a wildcard host", "https://*.example.com"],
    ["a non-web scheme", "ftp://example.com"],
    [
      "an IPv6 literal, which CSP host-source cannot express",
      "http://[::1]:8080",
    ],
    ["a non-string", 8901],
  ])("refuses %s, naming the index and the value", (_case, origin) => {
    const spec = { embed: { origins: ["https://ok.example", origin] } };

    expect(() => readEmbed(spec)).toThrow(
      `embed.origins[1]: ${ORIGIN_SHAPE}, got ${JSON.stringify(origin)}`,
    );
  });

  it("refuses origins that are not an array", () => {
    expect(() =>
      readEmbed({ embed: { origins: "https://example.com" } }),
    ).toThrow(
      'embed.origins: expected an array of origins, got "https://example.com"',
    );
  });

  it("refuses an embed that is not an object", () => {
    expect(() => readEmbed({ embed: true })).toThrow(
      "embed: expected an object with an optional origins array, got true",
    );
  });

  it("refuses an unknown key under embed, suggesting the close one", () => {
    expect(() => readEmbed({ embed: { origin: [] } })).toThrow(
      "embed.origin: unknown key, expected one of origins (did you mean origins?)",
    );
  });

  it("locates a refused origin at its array index", () => {
    const read = () => readEmbed({ embed: { origins: ["*"] } });

    expect(read).toThrow(
      expect.objectContaining({ keyPath: ["embed", "origins", "0"] }),
    );
  });
});
