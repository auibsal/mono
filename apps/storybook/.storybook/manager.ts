import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

// The SAL Design System: brand book colors (brand/tokens.json) and the
// supplied lockup in place of Storybook's own logo and name.
addons.setConfig({
  theme: create({
    appBg: "#faf7f5",
    appBorderColor: "#e3dedf",
    appBorderRadius: 8,
    appContentBg: "#ffffff",
    barBg: "#ffffff",
    barSelectedColor: "#9c213e",
    base: "light",
    brandImage: "/brand/sal-lockup-horizontal.svg",
    brandTarget: "_self",
    brandTitle: "SAL Design System",
    brandUrl: "https://auibsal.org",
    colorPrimary: "#9c213e",
    colorSecondary: "#9c213e",
    fontBase: "Ubuntu, 'Segoe UI', Tahoma, Arial, sans-serif",
    textColor: "#273236",
    textMutedColor: "#4a5559",
  }),
});
