import type { CapacitorConfig } from "@capacitor/cli";
import project from "../../packages/config/project.json";

if (project.bundleId.startsWith("{{")) {
  throw new Error(
    "Run `bun run init` first: the app id comes from packages/config/project.json."
  );
}

/**
 * The iOS and Android apps load the static export of this app (`out/`).
 * Build it with `bun run build:native`, then `bun run cap:sync`.
 *
 * CAP_SERVER_URL points the apps at a running `next dev` instead (live
 * reload on a device): CAP_SERVER_URL=http://192.168.1.20:3000 bun run cap:sync
 */
const devServerUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: project.bundleId,
  appName: project.name,
  plugins: {
    SystemBars: {
      // Edge-to-edge with --safe-area-inset-* CSS variables (see styles.css).
      initialViewportFitValueHint: "cover",
      insetsHandling: "css",
    },
  },
  server: {
    // Origins https://localhost (Android) and capacitor://localhost (iOS)
    // are allowed by apps/api's CORS (apps/api/lib/cors.ts).
    androidScheme: "https",
    ...(devServerUrl ? { cleartext: true, url: devServerUrl } : {}),
  },
  webDir: "out",
};

export default config;
