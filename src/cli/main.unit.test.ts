import { describe, expect, it, vi } from "vitest";
import { main } from "./main.js";

const { dev } = vi.hoisted(() => ({ dev: vi.fn() }));
vi.mock("./commands/dev.js", () => ({ dev }));

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

  it.each(["build", "preview"])(
    "rejects unimplemented command %s with exit 1",
    async (command) => {
      const error = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const exit = mockExit();

      await expect(main([command])).rejects.toThrow("exit");
      expect(error).toHaveBeenCalledWith(expect.stringContaining(command));
      expect(exit).toHaveBeenCalledWith(1);

      error.mockRestore();
      exit.mockRestore();
    },
  );

  it("routes dev to the dev command with its remaining args", async () => {
    dev.mockResolvedValue(undefined);

    await main(["dev", "site", "--port", "0"]);

    expect(dev).toHaveBeenCalledWith(["site", "--port", "0"]);
  });
});
