import { DesignSystemProvider } from "@repo/design-system";
import { withThemeByDataAttribute } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react";

import "@repo/design-system/styles/globals.css";

/**
 * SAL v4 with v5 Screens: the public site is light and the Nexus is on ink
 * (data-theme="dark"). Stories cover SAL components only; every one is
 * checked on both grounds (Theme) and in both directions (Direction).
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
