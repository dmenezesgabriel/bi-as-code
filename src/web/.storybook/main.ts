import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// Colocated stories and MDX docs pages glob, telemetry off, viteFinal
// merge. The tailwind plugin is merged in so component stories render with
// the same styles as the app.
const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
  staticDirs: ["../public"],
  // The MCP server shares the dev server at /mcp on the storybook port;
  // addon-docs renders the `*.mdx` docs pages, whose canvases embed stories.
  addons: ["@storybook/addon-docs", "@storybook/addon-mcp"],
  // The MCP docs toolset reads the components manifest — react-vite
  // generates it (storybook.js.org/docs/ai/mcp/overview).
  features: {
    componentsManifest: true,
  },
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  viteFinal: (viteConfig) =>
    mergeConfig(viteConfig, {
      plugins: [tailwindcss()],
    }),
};

export default config;
