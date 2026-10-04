import type { ThemeProviderProps } from "next-themes";
import { DirectionProvider } from "./components/ui/direction";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { type UiLabels, UiLabelsProvider } from "./lib/labels";
import { ThemeProvider } from "./providers/theme";

type DesignSystemProviderProperties = ThemeProviderProps & {
  /** Text direction; set "rtl" for Arabic and Kurdish (also set on <html>). */
  dir?: "ltr" | "rtl";
  /** Translated screen-reader texts for the UI components. */
  labels?: Partial<UiLabels>;
};

export const DesignSystemProvider = ({
  children,
  dir = "ltr",
  labels,
  ...properties
}: DesignSystemProviderProperties) => (
  <ThemeProvider {...properties}>
    {/* Radix components (menus, popovers, sliders…) read the direction from here. */}
    <DirectionProvider dir={dir}>
      <UiLabelsProvider labels={labels}>
        <TooltipProvider>{children}</TooltipProvider>
      </UiLabelsProvider>
      <Toaster
        dir={dir}
        position={dir === "rtl" ? "bottom-left" : "bottom-right"}
      />
    </DirectionProvider>
  </ThemeProvider>
);
