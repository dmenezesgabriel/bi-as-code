import { beforeEach, describe, expect, it } from "vitest";
import {
  readDesktopOpen,
  readDirOpenMap,
  writeDesktopOpen,
  writeDirOpen,
} from "./sidebar-storage";

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("desktop open flag", () => {
  it("reads null when nothing is stored", () => {
    expect(readDesktopOpen()).toBeNull();
  });

  it("round-trips an explicit choice", () => {
    writeDesktopOpen(false);
    expect(readDesktopOpen()).toBe(false);

    writeDesktopOpen(true);
    expect(readDesktopOpen()).toBe(true);
  });

  it("reads null for a value we did not write", () => {
    window.sessionStorage.setItem("biac.sidebar.open", "banana");
    expect(readDesktopOpen()).toBeNull();
  });
});

describe("directory open map", () => {
  it("reads an empty map when nothing is stored", () => {
    expect(readDirOpenMap()).toEqual({});
  });

  it("merges each directory's explicit choice into the stored map", () => {
    writeDirOpen("nested", false);
    writeDirOpen("guides", true);

    expect(readDirOpenMap()).toEqual({ nested: false, guides: true });
  });

  it("overwrites a directory's earlier choice", () => {
    writeDirOpen("nested", false);
    writeDirOpen("nested", true);

    expect(readDirOpenMap()).toEqual({ nested: true });
  });

  it("reads an empty map when the stored value is corrupt", () => {
    window.sessionStorage.setItem("biac.sidebar.dirs", "{not json");
    expect(readDirOpenMap()).toEqual({});
  });

  it("reads an empty map when the stored value is not an object", () => {
    window.sessionStorage.setItem("biac.sidebar.dirs", '"nested"');
    expect(readDirOpenMap()).toEqual({});
  });
});
