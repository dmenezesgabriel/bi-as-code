const USAGE = `biac — business intelligence as code

Usage: biac <command>

Commands:
  dev       Start the dev server for a pages directory
  build     Build a static site from a pages directory
  preview   Serve a built site locally
`;

export async function main(args: string[]): Promise<void> {
  const [command, ...rest] = args;
  if (command === "dev") {
    // Lazy import: keeps `biac --help` free of vite's startup cost.
    const { dev } = await import("./commands/dev.js");
    await dev(rest);
    return;
  }
  if (command === "build") {
    const { build } = await import("./commands/build.js");
    await build(rest);
    return;
  }
  if (command === "preview") {
    console.error(`biac ${command}: not implemented yet (see docs/backlog.md)`);
    process.exit(1);
  }
  process.stdout.write(USAGE);
  process.exit(command === undefined || command === "--help" ? 0 : 1);
}
