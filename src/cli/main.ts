const USAGE = `biac — business intelligence as code

Usage: biac <command>

Commands:
  dev       Start the dev server for a pages directory
  build     Build a static site from a pages directory
  preview   Serve a built site locally
`;

export function main(args: string[]): void {
  const [command] = args;
  if (command === "dev" || command === "build" || command === "preview") {
    console.error(`biac ${command}: not implemented yet (see docs/backlog.md)`);
    process.exit(1);
  }
  process.stdout.write(USAGE);
  process.exit(command === undefined || command === "--help" ? 0 : 1);
}
