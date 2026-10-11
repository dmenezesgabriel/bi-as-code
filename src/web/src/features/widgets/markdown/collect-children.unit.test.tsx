import { describe, expect, it } from "vitest";
import { collectItemChildren, requireItemChildren } from "./collect-children";

interface IdProps {
  readonly id?: string;
}

function Item(_props: IdProps) {
  return null;
}

function Other(_props: IdProps) {
  return null;
}

describe("collectItemChildren", () => {
  it("returns the carrier elements, skipping whitespace-only text", () => {
    const children = [
      "\n  ",
      <Item key="a" id="a" />,
      " ",
      <Item key="b" id="b" />,
    ];

    const items = collectItemChildren<IdProps>(children, Item, "Item", "id");

    expect(Array.isArray(items) && items.map((item) => item.props.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("returns an empty list when there are no children", () => {
    expect(collectItemChildren<IdProps>(undefined, Item, "Item", "id")).toEqual(
      [],
    );
  });

  it("rejects a child that is not the carrier tag", () => {
    const children = [<Other key="a" id="a" />];

    const items = collectItemChildren<IdProps>(children, Item, "Item", "id");

    expect(items).toBe("only accepts <Item> children");
  });

  it("rejects a non-whitespace text child", () => {
    const items = collectItemChildren<IdProps>(["stray"], Item, "Item", "id");

    expect(items).toBe("only accepts <Item> children");
  });

  it("names the required prop a carrier is missing", () => {
    const children = [<Item key="a" />];

    const items = collectItemChildren<IdProps>(children, Item, "Item", "id");

    expect(items).toBe('every <Item> requires a "id" prop');
  });
});

describe("requireItemChildren", () => {
  it("rejects zero children", () => {
    expect(requireItemChildren<IdProps>([" "], Item, "Item", "id")).toBe(
      "requires at least one <Item> child",
    );
  });

  it("passes collected carriers through", () => {
    const items = requireItemChildren<IdProps>(
      [<Item key="a" id="a" />],
      Item,
      "Item",
      "id",
    );

    expect(Array.isArray(items) && items).toHaveLength(1);
  });
});
