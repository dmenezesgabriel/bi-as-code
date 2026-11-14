import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { PreviewServer } from "vite";
import { vi } from "vitest";
import { makeTempProject } from "./temp-project.js";

export type FakePreviewServer = Pick<PreviewServer, "close" | "printUrls">;

/** A stand-in for the server `vite.preview` resolves, recording `close` and `printUrls`. */
export function fakePreviewServer(): FakePreviewServer {
  return {
    close: vi.fn().mockResolvedValue(undefined),
    printUrls: vi.fn(),
  };
}

/** A temp project root with an empty `build/`, the output `biac preview` and `biac serve` need. */
export function builtProject(prefix: string): string {
  const root = makeTempProject(prefix);
  mkdirSync(join(root, "build"));
  return root;
}
