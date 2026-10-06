import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LineBreak } from "./line-break";

describe("LineBreak", () => {
  it("renders one br by default", () => {
    const { container } = render(<LineBreak />);

    expect(container.querySelectorAll("br")).toHaveLength(1);
  });

  it("renders lines brs when lines is set", () => {
    const { container } = render(<LineBreak lines={3} />);

    expect(container.querySelectorAll("br")).toHaveLength(3);
  });

  it("renders nothing when lines is zero or negative", () => {
    const { container } = render(<LineBreak lines={-1} />);

    expect(container.querySelectorAll("br")).toHaveLength(0);
  });
});
