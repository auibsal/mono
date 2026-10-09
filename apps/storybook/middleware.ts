import { next } from "@vercel/functions";
import { checkAccess } from "./lib/gate";

// Every path: the stories, the manager and the static files.
export const config = { matcher: "/:path*" };

const FORBIDDEN = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SAL Design System</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#273236;background:#faf7f5"><h1>SAL Design System</h1><p>This is for Society officers. If you hold a role and still see this, finish two-step sign-in in the Nexus, then come back.</p><p><a href="https://nexus.auibsal.org">Open the Nexus</a></p></body></html>`;

/** Lets officers signed in to the Nexus through; see lib/gate.ts. */
export default async function middleware(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const nexusUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://nexus.auibsal.org";
  if (!(supabaseUrl && publishableKey)) {
    // Fail closed.
    return new Response("Not configured", { status: 503 });
  }
  const result = await checkAccess(request, {
    nexusUrl,
    publishableKey,
    supabaseUrl,
  });
  if (result.kind === "allow") {
    return next({ headers: { "Cache-Control": "private, no-store" } });
  }
  if (result.kind === "sign-in") {
    return Response.redirect(result.location, 302);
  }
  return new Response(FORBIDDEN, {
    headers: { "content-type": "text/html; charset=utf-8" },
    status: 403,
  });
}
