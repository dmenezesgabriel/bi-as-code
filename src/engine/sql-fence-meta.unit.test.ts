import { describe, expect, it } from "vitest";
import { parseSqlFenceMeta } from "./sql-fence-meta.js";

const parse = (meta: string) => parseSqlFenceMeta(meta, "pages/a.md:3");

describe("name", () => {
  it("reads a lone token as the name with both flags off", () => {
    expect(parse("orders")).toEqual({
      name: "orders",
      echo: false,
      display: false,
    });
  });

  it("ignores surrounding and repeated whitespace, tabs included", () => {
    expect(parse("  orders \t echo  ")).toEqual({
      name: "orders",
      echo: true,
      display: false,
    });
  });

  it.each(["echo", "display", "display=true", "a=b"])(
    "rejects %s in the name position",
    (token) => {
      expect(() => parse(`${token} echo`)).toThrow(
        `sql block name "${token}" at pages/a.md:3 is an attribute`,
      );
    },
  );
});

describe("flags", () => {
  it("turns a bare echo on", () => {
    expect(parse("orders echo")).toMatchObject({ echo: true, display: false });
  });

  it("turns a bare display on", () => {
    expect(parse("orders display")).toMatchObject({
      echo: false,
      display: true,
    });
  });

  it("turns both on in either order", () => {
    expect(parse("orders display echo")).toMatchObject({
      echo: true,
      display: true,
    });
  });

  it("reads =true as on and =false as off", () => {
    expect(parse("orders echo=true display=false")).toMatchObject({
      echo: true,
      display: false,
    });
  });

  it("lets the last occurrence of a flag win", () => {
    expect(parse("orders echo echo=false")).toMatchObject({ echo: false });
  });
});

describe("invalid attributes", () => {
  it.each(["shwo", "Echo", "echo=yes", "display=", "id=orders"])(
    "rejects %s naming it and the accepted attributes",
    (token) => {
      expect(() => parse(`orders ${token}`)).toThrow(
        `Unknown sql block attribute "${token}" at pages/a.md:3 — expected echo or display, bare or =true/=false`,
      );
    },
  );
});
