import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import remarkGfm from "remark-gfm";

// Colocated stories and MDX docs pages glob, telemetry off, viteFinal
// merge. The tailwind plugin is merged in so component stories render with
// the same styles as the app.
const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
  staticDirs: ["../public"],
  // The MCP server shares the dev server at /mcp on the storybook port;
  // addon-docs renders the `*.mdx` docs pages, whose canvases embed stories.
  // MDX has no GFM tables of its own, so addon-docs is handed `remark-gfm`
  // — the dialect the docs site compiles with (src/engine/compile-page.ts).
  addons: [
    {
      name: "@storybook/addon-docs",
      options: {
        mdxPluginOptions: {
          mdxCompileOptions: { remarkPlugins: [remarkGfm] },
        },
      },
    },
    "@storybook/addon-mcp",
  ],
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
