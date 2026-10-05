import type { Preview } from "@storybook/react-vite";
import { configure } from "storybook/test";
import { cn } from "../src/lib/cn";

// findBy/waitFor inside plays default to a 1s timeout, sized for unit tests.
// In a dev-server iframe mounting story after story, data can land a beat
// later than that and the play reports a missing element that simply
// arrived late.
configure({ asyncUtilTimeout: 4_000 });

// Same entry main.tsx imports: without it the iframe has no Tailwind CSS at
// all and utilities render with browser-default styles.
import "../src/styles.css";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
  },
  // Dark mode is class-strategy (`@custom-variant dark` in styles.css and
  // `useTheme` toggles `.dark` on <html>), so a toolbar global that toggles
  // the class on the canvas wrapper exercises both themes per story.
  globalTypes: {
    theme: {
      toolbar: {
        title: "Theme",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "light",
  },
  decorators: [
    (Story, context) => (
      <div
        className={cn(
          "min-h-screen w-full bg-white px-6 py-6 text-neutral-900",
          "dark:bg-neutral-950 dark:text-neutral-100",
          context.globals.theme === "dark" && "dark",
        )}
      >
        <Story />
      </div>
    ),
  ],
};

export default preview;
