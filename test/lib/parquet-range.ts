import { statSync } from "node:fs";
import { expect } from "vitest";

/**
 * Asserts `ranged` answers a `Range: bytes=0-3` read of the parquet file at
 * `parquetPath` the way duckdb-wasm needs: `206`, the parquet media type, a
 * `Content-Range` naming the file's true size, and the four magic bytes.
 *
 * @example
 * const ranged = await fetch(url, { headers: { Range: "bytes=0-3" } });
 * await expectParquetMagicRange(ranged, join(root, "build/data/flights.parquet"));
 */
export async function expectParquetMagicRange(
  ranged: Response,
  parquetPath: string,
): Promise<void> {
  expect(ranged.status).toBe(206);
  expect(ranged.headers.get("content-type")).toBe(
    "application/vnd.apache.parquet",
  );
  expect(ranged.headers.get("content-range")).toBe(
    `bytes 0-3/${statSync(parquetPath).size}`,
  );
  expect(await ranged.text()).toBe("PAR1");
}
