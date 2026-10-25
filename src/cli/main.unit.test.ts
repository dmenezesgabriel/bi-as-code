import { describe, expect, it, vi } from "vitest";
import { main } from "./main.js";

const { dev, build, preview, serve } = vi.hoisted(() => ({
  dev: vi.fn(),
  build: vi.fn(),
  preview: vi.fn(),
  serve: vi.fn(),
}));
vi.mock("./commands/dev.js", () => ({ dev }));
vi.mock("./commands/build.js", () => ({ build }));
vi.mock("./commands/preview.js", () => ({ preview }));
vi.mock("./commands/serve.js", () => ({ serve }));

function mockExit() {
  return vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("exit");
  });
}

describe("main", () => {
  it("prints usage and exits 0 for --help", async () => {
    const write = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    const exit = mockExit();

    await expect(main(["--help"])).rejects.toThrow("exit");
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
    expect(exit).toHaveBeenCalledWith(0);

    write.mockRestore();
    exit.mockRestore();
  });

  it("prints usage and exits 1 for an unknown command", async () => {
    const write = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    const exit = mockExit();

    await expect(main(["deploy"])).rejects.toThrow("exit");
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
    expect(exit).toHaveBeenCalledWith(1);

    write.mockRestore();
    exit.mockRestore();
  });

  it("routes dev to the dev command with its remaining args", async () => {
    dev.mockResolvedValue(undefined);

    await main(["dev", "site", "--port", "0"]);

    expect(dev).toHaveBeenCalledWith(["site", "--port", "0"]);
  });

  it("routes build to the build command with its remaining args", async () => {
    build.mockResolvedValue(undefined);

    await main(["build", "site"]);

    expect(build).toHaveBeenCalledWith(["site"]);
  });

  it("routes preview to the preview command with its remaining args", async () => {
    preview.mockResolvedValue(undefined);

    await main(["preview", "site", "--port", "0"]);

    expect(preview).toHaveBeenCalledWith(["site", "--port", "0"]);
  });

  it("routes serve to the serve command with its remaining args", async () => {
    serve.mockResolvedValue(undefined);

    await main(["serve", "site", "--port", "0"]);

    expect(serve).toHaveBeenCalledWith(["site", "--port", "0"]);
  });
});
