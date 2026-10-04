"use client";

import { createContext, type ReactNode, use, useMemo } from "react";

/**
 * Screen-reader texts used inside the UI components (close buttons, the
 * sidebar toggle, loading spinners…). Apps pass translated ones through
 * <DesignSystemProvider labels={…}>; English is the fallback.
 */
export interface UiLabels {
  close: string;
  loading: string;
  more: string;
  morePages: string;
  nextPage: string;
  nextSlide: string;
  previousPage: string;
  previousSlide: string;
  sidebar: string;
  sidebarDescription: string;
  toggleSidebar: string;
}

export const defaultUiLabels: UiLabels = {
  close: "Close",
  loading: "Loading",
  more: "More",
  morePages: "More pages",
  nextPage: "Go to next page",
  nextSlide: "Next slide",
  previousPage: "Go to previous page",
  previousSlide: "Previous slide",
  sidebar: "Sidebar",
  sidebarDescription: "Displays the mobile sidebar.",
  toggleSidebar: "Toggle Sidebar",
};

const UiLabelsContext = createContext<UiLabels>(defaultUiLabels);

export const UiLabelsProvider = ({
  children,
  labels,
}: {
  children: ReactNode;
  labels?: Partial<UiLabels>;
}) => {
  const value = useMemo(() => ({ ...defaultUiLabels, ...labels }), [labels]);
  return <UiLabelsContext value={value}>{children}</UiLabelsContext>;
};

export const useUiLabels = () => use(UiLabelsContext);
