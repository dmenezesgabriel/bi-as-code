import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PreviewServer } from "vite";
import {
  cleanupProjects,
  makeTempProject,
} from "../../../test/lib/temp-project.js";
import {
  assertBootAllowed,
  authModeLine,
  authWarnings,
  parseServeArgs,
  serve,
  serveRequiresAuth,
} from "./serve.js";

const { vitePreview } = vi.hoisted(() => ({ vitePreview: vi.fn() }));
vi.mock("vite", () => ({ preview: vitePreview }));

type FakePreviewServer = Pick<PreviewServer, "close" | "printUrls">;

function fakeServer(): FakePreviewServer {
  return {
    close: vi.fn().mockResolvedValue(undefined),
    printUrls: vi.fn(),
  };
}

function builtProject(): string {
  const root = makeTempProject("biac-serve-");
  mkdirSync(join(root, "build"));
  return root;
}

const FULL_PAIR = { BIAC_BASIC_USER: "viewer", BIAC_BASIC_PASSWORD: "s3cret" };

function quietServe(): void {
  vitePreview.mockResolvedValue(fakeServer());
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(process, "once").mockImplementation(() => process);
}

afterEach(() => {
  vi.restoreAllMocks();
  vitePreview.mockReset();
  cleanupProjects();
});

describe("parseServeArgs", () => {
  it("defaults to the current directory, loopback and port 3000", () => {
    expect(parseServeArgs([])).toEqual({
      projectRoot: process.cwd(),
      host: "127.0.0.1",
      port: 3000,
    });
  });

  it("parses a positional root, --host and --port", () => {
    expect(
      parseServeArgs(["site", "--host", "0.0.0.0", "--port", "0"]),
    ).toEqual({
      projectRoot: `${process.cwd()}/site`,
      host: "0.0.0.0",
      port: 0,
    });
  });

  it("rejects more than one project root, naming the command", () => {
    expect(() => parseServeArgs(["a", "b"])).toThrow("biac serve");
  });

  it("rejects an invalid --port naming the value", () => {
    expect(() => parseServeArgs(["--port", "abc"])).toThrow("abc");
  });
});

describe("serveRequiresAuth", () => {
  it.each(["127.0.0.1", "localhost", "::1"])(
    "leaves loopback host %s open with no env",
    (host) => {
      expect(serveRequiresAuth(host, {})).toBe(false);
    },
  );

  it("requires auth beyond loopback with no env", () => {
    expect(serveRequiresAuth("0.0.0.0", {})).toBe(true);
  });

  it("is satisfied beyond loopback by a full credential pair", () => {
    expect(serveRequiresAuth("0.0.0.0", FULL_PAIR)).toBe(false);
  });

  it("is waived beyond loopback by BIAC_AUTH_DISABLED=true", () => {
    expect(serveRequiresAuth("0.0.0.0", { BIAC_AUTH_DISABLED: "true" })).toBe(
      false,
    );
  });

  it.each(["yes", "TRUE", ""])(
    "still requires auth for BIAC_AUTH_DISABLED=%j",
    (value) => {
      expect(serveRequiresAuth("0.0.0.0", { BIAC_AUTH_DISABLED: value })).toBe(
        true,
      );
    },
  );

  it("requires auth beyond loopback for a half-set pair", () => {
    expect(serveRequiresAuth("0.0.0.0", { BIAC_BASIC_USER: "viewer" })).toBe(
      true,
    );
  });
});

describe("assertBootAllowed", () => {
  it("throws naming the host and all three variables", () => {
    expect(() => assertBootAllowed("0.0.0.0", {})).toThrow(
      /0\.0\.0\.0.*BIAC_BASIC_USER.*BIAC_BASIC_PASSWORD.*BIAC_AUTH_DISABLED/s,
    );
  });

  it("returns for a loopback host with no env", () => {
    expect(() => assertBootAllowed("127.0.0.1", {})).not.toThrow();
  });
});

describe("authWarnings", () => {
  it("is silent for a full pair", () => {
    expect(authWarnings("0.0.0.0", FULL_PAIR)).toEqual([]);
  });

  it("warns that a half-set pair names the missing variable", () => {
    const [warning] = authWarnings("127.0.0.1", { BIAC_BASIC_USER: "viewer" });
    expect(warning).toContain("BIAC_BASIC_PASSWORD");
  });

  it("warns loudly when auth is disabled beyond loopback", () => {
    const [warning] = authWarnings("0.0.0.0", { BIAC_AUTH_DISABLED: "1" });
    expect(warning).toContain("WARNING");
  });

  it("does not warn about disabled auth on loopback", () => {
    expect(authWarnings("127.0.0.1", { BIAC_AUTH_DISABLED: "1" })).toEqual([]);
  });
});

describe("authModeLine", () => {
  it("names the user when basic auth is enforced", () => {
    expect(authModeLine("0.0.0.0", FULL_PAIR)).toBe(
      "auth: basic (user viewer)",
    );
  });

  it("says auth is disabled when the opt-out is set", () => {
    expect(authModeLine("0.0.0.0", { BIAC_AUTH_DISABLED: "true" })).toMatch(
      /^auth: DISABLED/,
    );
  });

  it("says the server is open on loopback when nothing is configured", () => {
    expect(authModeLine("127.0.0.1", {})).toBe("auth: none (loopback only)");
  });
});

describe("serve", () => {
  it("serves <project>/build under mpa routing with the production preview options", async () => {
    quietServe();
    const root = builtProject();

    await serve([root, "--port", "0"], {});

    const config = vitePreview.mock.calls[0]![0];
    expect(config.configFile).toMatch(/src[/\\]web[/\\]vite\.config\.ts$/);
    expect(config.appType).toBe("mpa");
    expect(config.build).toEqual({ outDir: join(root, "build") });
    expect(config.preview).toEqual({
      cors: false,
      allowedHosts: true,
      strictPort: true,
      host: "127.0.0.1",
      port: 0,
    });
  });

  it("mounts the headers, then auth, then the four static plugins", async () => {
    quietServe();

    await serve([builtProject()], FULL_PAIR);

    const names = vitePreview.mock.calls[0]![0].plugins.map(
      (plugin: { name: string }) => plugin.name,
    );
    expect(names).toEqual([
      "biac:serve-headers",
      "biac:serve-basic-auth",
      "biac:preview-framing-policy",
      "biac:preview-data-cors",
      "biac:preview-module-cors",
      "biac:preview-data-media-types",
    ]);
  });

  it("prints the URLs and then the auth mode", async () => {
    quietServe();
    const server = fakeServer();
    vitePreview.mockResolvedValue(server);

    await serve([builtProject()], FULL_PAIR);

    expect(server.printUrls).toHaveBeenCalledOnce();
    expect(console.log).toHaveBeenLastCalledWith("auth: basic (user viewer)");
  });

  it("warns about a half-set pair and still starts on loopback", async () => {
    quietServe();

    await serve([builtProject()], { BIAC_BASIC_USER: "viewer" });

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("BIAC_BASIC_PASSWORD"),
    );
    expect(vitePreview).toHaveBeenCalledOnce();
  });

  it("refuses to start beyond loopback with no auth, before touching vite", async () => {
    quietServe();

    await expect(
      serve([builtProject(), "--host", "0.0.0.0"], {}),
    ).rejects.toThrow("BIAC_AUTH_DISABLED");
    expect(vitePreview).not.toHaveBeenCalled();
  });

  it("starts beyond loopback with auth disabled, warning loudly", async () => {
    quietServe();

    await serve([builtProject(), "--host", "0.0.0.0"], {
      BIAC_AUTH_DISABLED: "true",
    });

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("WARNING"),
    );
    expect(vitePreview).toHaveBeenCalledOnce();
  });

  it("refuses a project with no build, naming the path and the fix", async () => {
    const root = makeTempProject("biac-serve-");

    await expect(serve([root], {})).rejects.toThrow(
      `biac serve: no build at ${join(root, "build")} — run \`biac build\` first`,
    );
    expect(vitePreview).not.toHaveBeenCalled();
  });

  it("hands the server to the SIGINT/SIGTERM shutdown", async () => {
    quietServe();
    const once = vi.spyOn(process, "once").mockImplementation(() => process);

    await serve([builtProject()], {});

    expect(once.mock.calls.map(([signal]) => signal)).toEqual([
      "SIGINT",
      "SIGTERM",
    ]);
  });
});
