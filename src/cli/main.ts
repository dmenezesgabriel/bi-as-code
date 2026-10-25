const USAGE = `biac — business intelligence as code

Usage: biac <command>

Commands:
  dev       Start the dev server for a pages directory
  build     Build a static site from a pages directory
  preview   Serve a built site locally
  serve     Serve a built site in production, behind basic auth
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
    const { preview } = await import("./commands/preview.js");
    await preview(rest);
    return;
  }
  if (command === "serve") {
    const { serve } = await import("./commands/serve.js");
    await serve(rest);
    return;
  }
  process.stdout.write(USAGE);
  process.exit(command === undefined || command === "--help" ? 0 : 1);
}
