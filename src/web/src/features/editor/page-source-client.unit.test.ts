import { describe, expect, it } from "vitest";
import { pageSourceClient } from "./page-source-client";

type RecordedRequest = { url: string; init?: RequestInit };

/** Stands in for the dev server's page-source endpoint. */
class FakePageSourceFetch {
  readonly requests: RecordedRequest[] = [];
  constructor(private readonly response: Response) {}
  readonly fetch = async (url: string, init?: RequestInit) => {
    this.requests.push({ url, init });
    return this.response;
  };
}

describe("pageSourceClient.read", () => {
  it("GETs the endpoint path under pages/ and returns the body", async () => {
    // Arrange
    const server = new FakePageSourceFetch(new Response("# Orders\n"));
    const client = pageSourceClient(server.fetch);

    // Act
    const source = await client.read("pages/nested/weekly review.md");

    // Assert
    expect(source).toBe("# Orders\n");
    expect(server.requests).toEqual([
      { url: "/__biac/page-source/nested/weekly%20review.md", init: undefined },
    ]);
  });

  it("rejects naming the file and status on a non-2xx response", async () => {
    // Arrange
    const server = new FakePageSourceFetch(new Response("", { status: 404 }));
    const client = pageSourceClient(server.fetch);

    // Act / Assert
    await expect(client.read("pages/gone.md")).rejects.toThrow(
      'Reading "pages/gone.md" failed: HTTP 404',
    );
  });
});

describe("pageSourceClient.save", () => {
  it("PUTs the source as JSON to the endpoint path", async () => {
    // Arrange
    const server = new FakePageSourceFetch(new Response(null, { status: 204 }));
    const client = pageSourceClient(server.fetch);

    // Act
    await client.save("pages/index.md", "# Home\n");

    // Assert
    expect(server.requests).toEqual([
      {
        url: "/__biac/page-source/index.md",
        init: {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "# Home\n" }),
        },
      },
    ]);
  });

  it("rejects naming the file and status on a non-2xx response", async () => {
    // Arrange
    const server = new FakePageSourceFetch(new Response("", { status: 413 }));
    const client = pageSourceClient(server.fetch);

    // Act / Assert
    await expect(client.save("pages/big.md", "x")).rejects.toThrow(
      'Saving "pages/big.md" failed: HTTP 413',
    );
  });
});

describe("pageSourceClient endpoint path", () => {
  it("refuses a file outside pages/ before any request", async () => {
    // Arrange
    const server = new FakePageSourceFetch(new Response(""));
    const client = pageSourceClient(server.fetch);

    // Act / Assert
    await expect(client.read("data/orders.csv")).rejects.toThrow(
      'Page source file "data/orders.csv" is outside pages/',
    );
    expect(server.requests).toEqual([]);
  });
});
