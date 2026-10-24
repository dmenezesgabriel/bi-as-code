import {
  DuckDBDataProtocol,
  type AsyncDuckDB,
  type AsyncDuckDBConnection,
} from "@duckdb/duckdb-wasm";
import { identifier } from "./sql-identifier";

/** The insert options of the real connection — not exported at the root. */
type ArrowInsertOptions = Parameters<
  AsyncDuckDBConnection["insertArrowFromIPCStream"]
>[1];

/** The file-registration slice of `AsyncDuckDB` — injectable so tests fake it. */
export type FileRegistry = Pick<AsyncDuckDB, "registerFileURL" | "dropFile">;

/**
 * The slice of `AsyncDuckDBConnection` registration needs — declared rather
 * than `Pick`-ed so fakes can return `Promise<void>` where the real
 * `query` returns a `Table` we ignore.
 */
export interface RegistrationConnection {
  query(sql: string): Promise<unknown>;
  insertArrowFromIPCStream(
    buffer: Uint8Array,
    options: ArrowInsertOptions,
  ): Promise<void>;
}

/**
 * Registers one `sql:` source as a DuckDB table. `source` is a
 * project-relative `data/…` path — served under the deployment's base
 * (`/data/…` at the root, `<base>/data/…` when `biac.config.ts` sets
 * `base`), so the URL resolves `source` against `dataBase`. The default is
 * the SPA's own: its origin plus the base vite baked as
 * `import.meta.env.BASE_URL`. An exported widget module passes
 * `new URL("../", import.meta.url)` instead (`module-runtime.ts`), so its
 * data resolves beside the module on the publishing origin, never under
 * the host page's root.
 *
 * csv/json/parquet read through duckdb's HTTP filesystem (ranged GETs
 * against `/data/`); arrow has no lazy reader so the file is fetched whole
 * and its IPC stream inserted. `.csv/.json/.parquet` materialize as TABLE —
 * a missing file then fails registration naming the source and its HTTP
 * status, and cross-filter re-queries never re-scan HTTP. `OR REPLACE`
 * keeps registration idempotent: project-wide tables re-register on every
 * page mount, and a changed file re-registers under `biac dev`.
 */
export async function registerSource(
  files: FileRegistry,
  connection: RegistrationConnection,
  name: string,
  source: string,
  dataBase: string = new URL(import.meta.env.BASE_URL, location.origin).href,
): Promise<void> {
  // `new URL` resolves a relative `source` beside the base's last segment
  // unless the base ends in "/", so a slash-less base gets one before the
  // join — a caller's "…/bi-as-code" still means "…/bi-as-code/".
  const base = dataBase.endsWith("/") ? dataBase : `${dataBase}/`;
  const url = new URL(source, base).href;
  // duckdb-wasm 1.32.0, measured in the browser: re-registering a name at
  // the same URL is a no-op that keeps reading the file's first bytes, and
  // at another URL it throws "File already registered". Dropping first
  // makes every registration read the file as it is now (with the external
  // file cache off — `duckdb-live.ts`).
  await files.dropFile(source);
  await files.registerFileURL(source, url, DuckDBDataProtocol.HTTP, false);
  if (source.endsWith(".arrow")) {
    const response = await fetch(url);
    if (!response.ok) throw await httpFailure(url, response);
    const buffer = new Uint8Array(await response.arrayBuffer());
    await connection.insertArrowFromIPCStream(buffer, {
      name,
      schema: "main",
    });
    return;
  }
  // Engine-side validation already restricted sources to
  // .csv/.json/.parquet — duckdb picks the reader from the extension.
  try {
    await connection.query(
      `CREATE OR REPLACE TABLE ${identifier(name)} AS FROM ${stringLiteral(source)}`,
    );
  } catch (cause) {
    throw (await diagnoseUnreadable(url)) ?? cause;
  }
}

/**
 * DuckDB's HTTP reader reports any failed response as "Failed to open
 * file", dropping the status and body — where the dev server says which
 * data loader failed and why. Only after a failed read is the URL fetched
 * once more to recover them; `null` when it now reads fine or cannot be
 * reached, so duckdb's own error stands.
 */
async function diagnoseUnreadable(url: string): Promise<Error | null> {
  try {
    const response = await fetch(url);
    return response.ok ? null : await httpFailure(url, response);
  } catch {
    return null;
  }
}

/** `fetch <url> → HTTP <status>`, plus the body when the server explains in plain text. */
async function httpFailure(url: string, response: Response): Promise<Error> {
  const head = `fetch ${url} → HTTP ${response.status}`;
  const type = response.headers.get("Content-Type") ?? "";
  if (!type.startsWith("text/plain")) return new Error(head);
  const reason = (await response.text()).trim();
  return new Error(reason ? `${head}: ${reason}` : head);
}

/** `'data/…'` — embedded `'` doubled per SQL string quoting. */
function stringLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
