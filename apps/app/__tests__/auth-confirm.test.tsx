import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthConfirm } from "@/components/auth/auth-confirm";
import { fakeSupabase, renderWithApp } from "./render";

const replace = vi.fn();
let search = new URLSearchParams();

vi.mock("@repo/internationalization/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ replace }),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => search }));

const back = (next: string) =>
  `${window.location.origin}/en/auth/callback?next=${encodeURIComponent(next)}`;

describe("auth confirm", () => {
  beforeEach(() => {
    replace.mockReset();
  });

  test("verifies only when the member presses Continue", async () => {
    search = new URLSearchParams({
      next: back("/en/events"),
      token_hash: "h",
      type: "magiclink",
    });
    const verifyOtp = vi.fn(async () => ({ error: null }));
    const supabase = fakeSupabase();
    Object.assign(supabase.auth, { verifyOtp });
    renderWithApp(<AuthConfirm />, { locale: "en", supabase });

    expect(verifyOtp).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/events"));
    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "h",
      type: "magiclink",
    });
  });

  test("a recovery link goes on to the new-password page", async () => {
    search = new URLSearchParams({
      next: back("/en/auth/reset"),
      token_hash: "h",
      type: "recovery",
    });
    const supabase = fakeSupabase();
    Object.assign(supabase.auth, {
      verifyOtp: vi.fn(async () => ({ error: null })),
    });
    renderWithApp(<AuthConfirm />, { locale: "en", supabase });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/auth/reset"));
  });

  test("a return address on another site is ignored", async () => {
    search = new URLSearchParams({
      next: "https://evil.example/en/auth/callback?next=%2Fevents",
      token_hash: "h",
      type: "magiclink",
    });
    const supabase = fakeSupabase();
    Object.assign(supabase.auth, {
      verifyOtp: vi.fn(async () => ({ error: null })),
    });
    renderWithApp(<AuthConfirm />, { locale: "en", supabase });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  test("a link without a token shows the error", () => {
    search = new URLSearchParams({ type: "magiclink" });
    renderWithApp(<AuthConfirm />, { locale: "en" });
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});
