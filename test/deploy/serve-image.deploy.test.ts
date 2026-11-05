import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eventually } from "../lib/http.js";
import {
  buildServeImage,
  containerLogs,
  execInContainer,
  removeServeImageContainers,
  type RunningServeImage,
  runServeImageToExit,
  startServeImage,
  stopTimed,
} from "../lib/serve-image.js";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../lib/temp-project.js";

const TAG = "biac-serve:deploy-test";
const BASIC_AUTH_ENV = {
  BIAC_BASIC_USER: "viewer",
  BIAC_BASIC_PASSWORD: "s3cret",
};
const AUTHORIZATION = `Basic ${Buffer.from("viewer:s3cret").toString("base64")}`;

/** Starts the image and waits until it answers HTTP at all. */
async function startAndAwaitHttp(
  env: Record<string, string>,
  containerPort: number,
  tag: string = TAG,
): Promise<RunningServeImage> {
  const running = await startServeImage(tag, env, containerPort);
  // fetch rejects until the server listens; any status means it is up.
  await eventually(async () => {
    await fetch(`${running.origin}/`);
    return true;
  });
  return running;
}

beforeAll(async () => {
  await buildServeImage(TAG);
});

afterAll(removeServeImageContainers);

describe("boot guard", () => {
  it("exits 1 naming every auth variable when none is set", async () => {
    // Act
    const { exitCode, stderr } = await runServeImageToExit(TAG, {});

    // Assert
    expect(exitCode).toBe(1);
    expect(stderr).toContain("BIAC_BASIC_USER");
    expect(stderr).toContain("BIAC_BASIC_PASSWORD");
    expect(stderr).toContain("BIAC_AUTH_DISABLED");
  });
});

describe("basic auth on $PORT", () => {
  let running: RunningServeImage;

  beforeAll(async () => {
    running = await startAndAwaitHttp(
      { ...BASIC_AUTH_ENV, PORT: "8080" },
      8080,
    );
  });

  it("logs the basic auth mode", async () => {
    // Act
    const logs = await containerLogs(running.id);

    // Assert
    expect(logs).toContain("auth: basic (user viewer)");
  });

  it("challenges a request without credentials", async () => {
    // Act
    const res = await fetch(`${running.origin}/`);

    // Assert
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toMatch(/^Basic /);
  });

  it("serves a page to a request with credentials", async () => {
    // Act
    const res = await fetch(`${running.origin}/weekly-review/`, {
      headers: { Authorization: AUTHORIZATION },
    });

    // Assert
    expect(res.status).toBe(200);
  });

  it("serves every built data file to uid 10001, whatever its mode in the build context", async () => {
    // Arrange: a working tree can hold files only their owner may read
    // (data/*.parquet came out of their generator as 0600), and COPY keeps
    // that mode.
    const files = ["/data/orders.parquet", "/data/flights.parquet"];

    // Act
    const statuses = await Promise.all(
      files.map(async (file) => {
        const res = await fetch(`${running.origin}${file}`, {
          headers: { Authorization: AUTHORIZATION },
        });
        await res.arrayBuffer();
        return res.status;
      }),
    );

    // Assert
    expect(statuses).toEqual([200, 200]);
  });
});

describe("default port and process contract", () => {
  let running: RunningServeImage;

  beforeAll(async () => {
    running = await startAndAwaitHttp(BASIC_AUTH_ENV, 3000);
  });

  it("listens on 3000 when PORT is unset", async () => {
    // Act
    const res = await fetch(`${running.origin}/`);

    // Assert
    expect(res.status).toBe(401);
  });

  it("runs as uid 10001", async () => {
    // Act
    const { stdout } = await execInContainer(running.id, ["id", "-u"]);

    // Assert
    expect(stdout.trim()).toBe("10001");
  });

  it("cannot write to the application directory", async () => {
    // Act
    const { exitCode, stderr } = await execInContainer(running.id, [
      "touch",
      "/app/x",
    ]);

    // Assert
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("Read-only file system");
  });

  it("stops cleanly on SIGTERM before the kill timeout", async () => {
    // Act
    const { elapsedMs, exitCode } = await stopTimed(running.id);

    // Assert: vite preview's own SIGTERM listener closes the server and
    // exits 128 + 15; a PID 1 that ignored the signal would be SIGKILLed
    // after 10 s with 137.
    expect(elapsedMs).toBeLessThan(5_000);
    expect(exitCode).toBe(143);
  });
});

describe("a project outside the clone", () => {
  const EXTERNAL_TAG = "biac-serve:deploy-test-external";
  const PEOPLE_CSV = "name\nAda\n";
  let running: RunningServeImage;

  beforeAll(async () => {
    // Arrange: the Getting-started shape, a pages/ and a data/ directory and
    // no biac.config.ts, beside the clone rather than inside it.
    const project = makeTempProject();
    writeProjectFile(project, "pages/hello.md", "# Hello\n");
    writeProjectFile(project, "data/people.csv", PEOPLE_CSV);
    await buildServeImage(EXTERNAL_TAG, project);
    running = await startAndAwaitHttp(BASIC_AUTH_ENV, 3000, EXTERNAL_TAG);
  });

  afterAll(cleanupProjects);

  it("serves that project's page and data file", async () => {
    // Act
    const page = await fetch(`${running.origin}/hello/`, {
      headers: { Authorization: AUTHORIZATION },
    });
    const csv = await fetch(`${running.origin}/data/people.csv`, {
      headers: { Authorization: AUTHORIZATION },
    });

    // Assert
    expect(page.status).toBe(200);
    expect(await csv.text()).toBe(PEOPLE_CSV);
  });

  it("does not serve the clone's own pages", async () => {
    // Act
    const res = await fetch(`${running.origin}/weekly-review/`, {
      headers: { Authorization: AUTHORIZATION },
    });

    // Assert
    expect(res.status).toBe(404);
  });
});
