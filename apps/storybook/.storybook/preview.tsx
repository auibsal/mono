import { DesignSystemProvider } from "@repo/design-system";
import { withThemeByDataAttribute } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react";

import "@repo/design-system/styles/globals.css";

/**
 * SAL v4: light everywhere, the ink theme (data-theme="dark") only on the
 * "why" pages and the Open Call page. Every component is checked in both
 * directions with the Direction toolbar (LTR English, RTL Arabic).
 */
const preview: Preview = {
  decorators: [
    withThemeByDataAttribute({
      attributeName: "data-theme",
      defaultTheme: "light",
      themes: { ink: "dark", light: "light" },
    }),
    (Story, context) => {
      const dir = context.globals.direction === "rtl" ? "rtl" : "ltr";
      return (
        <div
          className="bg-surface p-4 text-text"
          dir={dir}
          lang={dir === "rtl" ? "ar" : "en"}
        >
          <DesignSystemProvider dir={dir}>
            <Story />
          </DesignSystemProvider>
        </div>
      );
    },
  ],
  globalTypes: {
    direction: {
      description: "Text direction",
      toolbar: {
        dynamicTitle: true,
        items: [
          { title: "LTR (English)", value: "ltr" },
          { title: "RTL (Arabic)", value: "rtl" },
        ],
      },
    },
  },
  initialGlobals: { direction: "ltr" },
  parameters: {
    chromatic: {
      modes: {
        ink: { direction: "ltr", theme: "ink" },
        "light ltr": { direction: "ltr", theme: "light" },
        "light rtl": { direction: "rtl", theme: "light" },
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
