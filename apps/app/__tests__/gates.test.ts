import { expect, test } from "vitest";
import { isGuestPath } from "@/components/gates";

test("a partner's members reach only the Journal, profile and service", () => {
  expect(isGuestPath("/journal")).toBe(true);
  expect(isGuestPath("/journal/submit")).toBe(true);
  expect(isGuestPath("/profile")).toBe(true);
  expect(isGuestPath("/service")).toBe(true);
  expect(isGuestPath("/certificate")).toBe(true);
  expect(isGuestPath("/")).toBe(false);
  expect(isGuestPath("/events")).toBe(false);
  expect(isGuestPath("/offers")).toBe(false);
  expect(isGuestPath("/journalism")).toBe(false);
});
