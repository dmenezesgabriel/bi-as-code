import { describe, expect, it, vi } from "vitest";
import { main } from "./main.js";

describe("main", () => {
  it("prints usage and exits 0 for --help", () => {
    const write = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });

    expect(() => main(["--help"])).toThrow("exit");
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
    expect(exit).toHaveBeenCalledWith(0);

    write.mockRestore();
    exit.mockRestore();
  });

  it("rejects unimplemented commands with exit 1", () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });

    expect(() => main(["dev"])).toThrow("exit");
    expect(error).toHaveBeenCalledWith(expect.stringContaining("dev"));
    expect(exit).toHaveBeenCalledWith(1);

    error.mockRestore();
    exit.mockRestore();
  });
});
