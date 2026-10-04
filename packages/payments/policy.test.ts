import { afterEach, describe, expect, test } from "vitest";
import { canPurchaseInApp, detectPlatform, getPurchasePolicy } from "./policy";

const globals = globalThis as { Capacitor?: unknown };

describe("in-app purchase policy", () => {
  afterEach(() => {
    globals.Capacitor = undefined;
  });

  test("always allows purchases on the web", () => {
    expect(getPurchasePolicy("web", false)).toEqual({
      allowed: true,
      reason: "web",
    });
  });

  test("blocks native checkout for digital products by default", () => {
    expect(getPurchasePolicy("ios", false)).toEqual({
      allowed: false,
      reason: "store-billing-required",
    });
    expect(canPurchaseInApp("android", false)).toBe(false);
  });

  test("allows native checkout when the project sells physical goods", () => {
    expect(getPurchasePolicy("ios", true)).toEqual({
      allowed: true,
      reason: "native-checkout-allowed",
    });
  });

  test("uses the project setting by default (digital)", () => {
    expect(canPurchaseInApp("ios")).toBe(false);
  });

  test("detects the Capacitor native shell", () => {
    expect(detectPlatform()).toBe("web");
    globals.Capacitor = {
      getPlatform: () => "ios",
      isNativePlatform: () => true,
    };
    expect(detectPlatform()).toBe("ios");
    globals.Capacitor = {
      getPlatform: () => "android",
      isNativePlatform: () => true,
    };
    expect(detectPlatform()).toBe("android");
  });
});
