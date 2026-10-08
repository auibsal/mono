import type { Database } from "@repo/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/env";

/**
 * Phone and browser notifications (Web Push). The browser's push service
 * delivers what apps/api sends, so no vendor is involved. iPhone and iPad
 * show them only once the Nexus is added to the Home Screen.
 */

const WORKER = "/sw.js";

const APPLE_MOBILE = /iPad|iPhone|iPod/;
const PLUS = /\+/g;
const SLASH = /\//g;
const DASH = /-/g;
const UNDERSCORE = /_/g;
const PADDING = /[=]+$/;

// First match wins: Edge and Chrome both say "Safari", Edge also says "Chrome".
const DEVICES: [RegExp, string][] = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
];
const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

export type PushState =
  | "unsupported"
  | "needs-install"
  | "denied"
  | "off"
  | "on";

const isAppleMobile = () =>
  APPLE_MOBILE.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isInstalled = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const supported = () =>
  Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

const existing = async () => {
  const registration = await navigator.serviceWorker.getRegistration(WORKER);
  return (await registration?.pushManager.getSubscription()) ?? null;
};

/** What this device can do now. */
export const pushState = async (): Promise<PushState> => {
  if (typeof window === "undefined") {
    return "unsupported";
  }
  if (!supported()) {
    return isAppleMobile() && !isInstalled() ? "needs-install" : "unsupported";
  }
  if (Notification.permission === "denied") {
    return "denied";
  }
  return (await existing()) ? "on" : "off";
};

const keyBytes = (base64Url: string) => {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4))
    .replace(DASH, "+")
    .replace(UNDERSCORE, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
};

/** "iPhone · Safari", so members can tell their devices apart. */
const deviceLabel = () => {
  const ua = navigator.userAgent;
  const device =
    DEVICES.find(([pattern]) => pattern.test(ua))?.[1] ??
    (isAppleMobile() ? "iPad" : "Computer");
  const browser =
    BROWSERS.find(([pattern]) => pattern.test(ua))?.[1] ?? "Browser";
  return `${device} · ${browser}`;
};

const toBase64Url = (buffer: ArrayBuffer | null) =>
  buffer
    ? btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(PLUS, "-")
        .replace(SLASH, "_")
        .replace(PADDING, "")
    : "";

/** Asks permission, subscribes this browser and saves it for the member. */
export const enablePush = async (
  supabase: SupabaseClient<Database>
): Promise<PushState> => {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return permission === "denied" ? "denied" : "off";
  }
  const registration = await navigator.serviceWorker.register(WORKER);
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      applicationServerKey: keyBytes(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""),
      userVisibleOnly: true,
    }));
  const { error } = await supabase
    .schema("core")
    .rpc("save_push_subscription", {
      auth: toBase64Url(subscription.getKey("auth")),
      endpoint: subscription.endpoint,
      label: deviceLabel(),
      p256dh: toBase64Url(subscription.getKey("p256dh")),
    });
  if (error) {
    throw error;
  }
  return "on";
};

/**
 * Stops notifications on this browser. Called on sign-out too, so a shared
 * computer never shows the last member's notices.
 */
export const disablePush = async (supabase: SupabaseClient<Database>) => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  const subscription = await existing();
  if (!subscription) {
    return;
  }
  await supabase
    .schema("core")
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", subscription.endpoint);
  await subscription.unsubscribe();
};
