import type { Preview } from "@storybook/react-vite";
import { configure } from "storybook/test";

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
  decorators: [
    (Story) => (
      <div className="min-h-screen w-full bg-white px-6 py-6 text-neutral-900">
        <Story />
      </div>
    ),
  ],
};

export default preview;
