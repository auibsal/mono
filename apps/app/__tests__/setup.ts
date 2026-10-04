import { cleanup } from "@testing-library/react";
import { afterEach, type Mock, vi } from "vitest";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3002");
vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
vi.stubEnv("NEXT_PUBLIC_WEB_URL", "http://localhost:3001");

export const router: Record<"back" | "push" | "refresh" | "replace", Mock> = {
  back: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
};

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  permanentRedirect: vi.fn(),
  redirect: vi.fn(),
  useParams: () => ({}),
  usePathname: () => "/ar",
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));
