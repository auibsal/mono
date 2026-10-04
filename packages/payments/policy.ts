import { project } from "@repo/config";

export type Platform = "web" | "ios" | "android";

interface CapacitorGlobal {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
}

/** Detects the Capacitor native shell without importing @capacitor/core. */
export const detectPlatform = (): Platform => {
  const capacitor = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;

  if (!capacitor?.isNativePlatform?.()) {
    return "web";
  }

  return capacitor.getPlatform?.() === "ios" ? "ios" : "android";
};

export type PurchasePolicy =
  | { allowed: true; reason: "web" | "native-checkout-allowed" }
  | { allowed: false; reason: "store-billing-required" };

/**
 * Whether the UI may offer a purchase (Wayl checkout) on this platform.
 *
 * Web is always allowed. In the iOS/Android apps, Apple (App Review 3.1.1)
 * and Google Play require their own billing for digital goods, so checkout is
 * hidden unless the project sells physical goods or real-world services
 * (`commerce.allowNativeCheckout` in packages/config/project.json).
 */
export const getPurchasePolicy = (
  platform: Platform = detectPlatform(),
  allowNativeCheckout: boolean = project.commerce.allowNativeCheckout
): PurchasePolicy => {
  if (platform === "web") {
    return { allowed: true, reason: "web" };
  }

  return allowNativeCheckout
    ? { allowed: true, reason: "native-checkout-allowed" }
    : { allowed: false, reason: "store-billing-required" };
};

export const canPurchaseInApp = (
  platform?: Platform,
  allowNativeCheckout?: boolean
) => getPurchasePolicy(platform, allowNativeCheckout).allowed;
