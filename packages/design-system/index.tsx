import type { ReactNode } from "react";
import { DirectionProvider } from "./components/ui/direction";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { type UiLabels, UiLabelsProvider } from "./lib/labels";

interface DesignSystemProviderProperties {
  readonly children: ReactNode;
  /** Text direction; set "rtl" for Arabic (also set on <html>). */
  readonly dir?: "ltr" | "rtl";
  /** Translated screen-reader texts for the UI components. */
  readonly labels?: Partial<UiLabels>;
}

/**
 * Direction, labels, tooltips and toasts. There is no theme switcher: SAL is
 * light everywhere, and the ink theme is set per page with data-theme="dark".
 */
export const DesignSystemProvider = ({
  children,
  dir = "ltr",
  labels,
}: DesignSystemProviderProperties) => (
  // Radix components (menus, popovers, sliders…) read the direction from here.
  <DirectionProvider dir={dir}>
    <UiLabelsProvider labels={labels}>
      <TooltipProvider>{children}</TooltipProvider>
    </UiLabelsProvider>
    <Toaster
      dir={dir}
      position={dir === "rtl" ? "bottom-left" : "bottom-right"}
    />
  </DirectionProvider>
);
