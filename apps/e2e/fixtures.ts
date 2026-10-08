import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const secret = process.env.SUPABASE_SECRET_KEY ?? "";

export const admin = () =>
  createClient(SUPABASE_URL, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

export const PASSWORD = "E2e-pass-12345";
export const member = { email: "e2e-member@auib.edu.iq", name: "E2E Member" };
export const editor = { email: "e2e-editor@auib.edu.iq", name: "E2E Editor" };
export const event = { slug: "e2e-open-pages", title: "Open Pages (e2e)" };
