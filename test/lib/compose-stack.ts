import {
  DockerComposeEnvironment,
  getContainerRuntimeClient,
  type StartedDockerComposeEnvironment,
} from "testcontainers";

/** What a deploy test needs from a running compose example. */
export interface ComposeStack {
  /** Runs `curl <args>` inside `service`; resolves to its stdout. */
  curlFrom(service: string, args: readonly string[]): Promise<string>;
  /** Host bindings `service` publishes, as `"<host ip>:<host port>-><container port>/<proto>"`. */
  publishedPorts(service: string): Promise<string[]>;
  down(): Promise<void>;
}

export interface ComposeStackOptions {
  /** Directory holding the compose file; relative paths in it resolve here. */
  dir: string;
  file?: string;
  /** Interpolated into the compose file, e.g. a fixture site directory. */
  environment?: Record<string, string>;
  profiles?: readonly string[];
}

/**
 * Brings a compose example up under a throwaway project name and waits, as
 * `docker compose up --wait` does, for every healthcheck and one-shot.
 *
 * @example
 * const stack = await startComposeStack({ dir: "examples/s3-sso" });
 * await stack.curlFrom("probe", ["-s", "http://moto:5000/"]);
 * await stack.down();
 */
export async function startComposeStack(
  options: ComposeStackOptions,
): Promise<ComposeStack> {
  const started = await new DockerComposeEnvironment(
    options.dir,
    options.file ?? "compose.yaml",
  )
    .withEnvironment(options.environment ?? {})
    .withProfiles(...(options.profiles ?? []))
    .withClientOptions({ commandOptions: ["--wait"] })
    .up();
  return wrapStarted(started);
}

function wrapStarted(started: StartedDockerComposeEnvironment): ComposeStack {
  // Compose names a service's first replica `<service>-1`.
  const container = (service: string) => started.getContainer(`${service}-1`);
  return {
    async curlFrom(service, args) {
      const result = await container(service).exec(["curl", ...args]);
      if (result.exitCode !== 0) {
        throw new Error(
          `curl ${args.join(" ")} in ${service} exited ${result.exitCode}, expected 0: ${result.output}`,
        );
      }
      return result.stdout;
    },
    async publishedPorts(service) {
      return hostBoundPorts(container(service).getId());
    },
    async down() {
      await started.down({ removeVolumes: true });
    },
  };
}

async function hostBoundPorts(containerId: string): Promise<string[]> {
  const client = await getContainerRuntimeClient();
  const inspect = await client.container.inspect(
    client.container.getById(containerId),
  );
  const ports = inspect.NetworkSettings.Ports ?? {};
  return Object.entries(ports).flatMap(([port, bindings]) =>
    (bindings ?? []).map(
      (binding) => `${binding.HostIp}:${binding.HostPort}->${port}`,
    ),
  );
}
