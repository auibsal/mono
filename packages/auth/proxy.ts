import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { keys } from "./keys";

export interface UpdateSessionOptions {
  /** Path prefixes that don't require a signed-in user. */
  publicPaths?: string[];
  /** Where anonymous visitors are redirected. `null` disables redirects. */
  signInPath?: string | null;
}

const defaultPublicPaths = ["/sign-in", "/sign-up", "/auth"];

/**
 * Refreshes the Supabase session cookies on every request and, unless the
 * path is public, redirects anonymous visitors to the sign-in page.
 */
export const updateSession = async (
  request: NextRequest,
  {
    publicPaths = defaultPublicPaths,
    signInPath = "/sign-in",
  }: UpdateSessionOptions = {}
) => {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    keys();
  let supabaseResponse = NextResponse.next({
    request,
  });

  if (!(NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({
            request,
          });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // Do not run code between createServerClient and getUser(): it refreshes
  // the session, and anything in between can cause random sign-outs.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = publicPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (!(user || isPublic || signInPath === null)) {
    const url = request.nextUrl.clone();
    url.pathname = signInPath;
    return NextResponse.redirect(url);
  }

  // Return supabaseResponse as-is: it carries the refreshed session cookies.
  return supabaseResponse;
};
