import { describe, expect, it } from "vitest";
import {
  compileErrorModuleSource,
  pageCompileError,
} from "./page-compile-error.js";

/** The shape `@mdx-js/mdx` throws: a message that knows where it happened. */
class PositionedSyntaxError extends Error {
  constructor(
    message: string,
    readonly line: number | undefined,
    readonly column: number | undefined,
  ) {
    super(message);
  }
}

describe("pageCompileError", () => {
  it("keeps the line and column of an error that carries them", () => {
    const thrown = new PositionedSyntaxError("Unexpected end of file", 7, 1);

    const error = pageCompileError(thrown, "pages/a.md");

    expect(error).toEqual({
      file: "pages/a.md",
      message: "Unexpected end of file",
      line: 7,
      column: 1,
    });
  });

  it("omits the position of an error that has none", () => {
    const thrown = new Error("front-matter in pages/a.md: expected a mapping");

    const error = pageCompileError(thrown, "pages/a.md");

    expect(error).toEqual({
      file: "pages/a.md",
      message: "front-matter in pages/a.md: expected a mapping",
    });
  });

  it("omits a position the error declares but leaves undefined", () => {
    const thrown = new PositionedSyntaxError("Cannot process", undefined, 3);

    const error = pageCompileError(thrown, "pages/a.md");

    expect(error).toEqual({ file: "pages/a.md", message: "Cannot process" });
  });

  it("stringifies a thrown value that is not an Error", () => {
    const error = pageCompileError("boom", "pages/a.md");

    expect(error).toEqual({ file: "pages/a.md", message: "boom" });
  });
});

describe("compileErrorModuleSource", () => {
  it("emits a module whose only export is the compile error", async () => {
    const error = {
      file: "pages/a.md",
      message: 'Unexpected "</script>`\n${x}',
      line: 7,
      column: 1,
    };

    const source = compileErrorModuleSource(error);
    const module: Record<string, unknown> = await import(
      `data:text/javascript,${encodeURIComponent(source)}`
    );

    expect({ ...module }).toEqual({ compileError: error });
  });
});
