import { detectPlatform } from "@repo/payments";

export { detectPlatform, type Platform } from "@repo/payments";

/** True inside the Capacitor iOS/Android apps. */
export const isNativeApp = () => detectPlatform() !== "web";
