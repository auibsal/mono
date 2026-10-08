import { afterEach, expect, test, vi } from "vitest";
import { track } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("track is a no-op without GA4", () => {
  vi.stubGlobal("window", {});
  expect(() => track("join_click", { location: "home" })).not.toThrow();
});

test("track sends the event to gtag", () => {
  const gtag = vi.fn();
  vi.stubGlobal("window", { gtag });
  track("search", { search_term: "journal" });
  expect(gtag).toHaveBeenCalledWith("event", "search", {
    search_term: "journal",
  });
});
