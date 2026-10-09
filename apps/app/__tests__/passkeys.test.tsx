import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Passkeys } from "@/components/profile/passkeys";
import { fakeSupabase, renderWithApp } from "./render";

const signedOut = {
  getSession: vi.fn(async () => ({ data: { session: null } })),
  onAuthStateChange: vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
};

beforeEach(() => {
  vi.stubGlobal("PublicKeyCredential", () => undefined);
  Object.defineProperty(navigator, "credentials", {
    configurable: true,
    value: { create: vi.fn(), get: vi.fn() },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("offers a passkey on the sign-in page and explains a dismissed prompt", async () => {
  const signInWithPasskey = vi.fn(async () => ({
    data: null,
    error: { code: "ERROR_CEREMONY_ABORTED" },
  }));
  const supabase = fakeSupabase({
    auth: { ...signedOut, signInWithPasskey },
  });

  renderWithApp(<SignInForm />, { locale: "en", supabase });
  fireEvent.click(
    await screen.findByRole("button", { name: "Sign in with a passkey" })
  );

  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "No passkey was used. Try again, or sign in with your email."
    )
  );
  expect(signInWithPasskey).toHaveBeenCalledOnce();
});

test("hides the passkey button where the browser has no passkeys", () => {
  vi.stubGlobal("PublicKeyCredential", undefined);
  renderWithApp(<SignInForm />, {
    locale: "en",
    supabase: fakeSupabase({ auth: signedOut }),
  });
  expect(
    screen.queryByRole("button", { name: "Sign in with a passkey" })
  ).toBeNull();
});

test("lists, adds and removes passkeys on the profile", async () => {
  let stored = [
    {
      created_at: "2026-10-01T09:00:00Z",
      friendly_name: "Phone",
      id: "pk-1",
      last_used_at: "2026-10-08T09:00:00Z",
    },
  ];
  const passkey = {
    delete: vi.fn(({ passkeyId }: { passkeyId: string }) => {
      stored = stored.filter((item) => item.id !== passkeyId);
      return Promise.resolve({ data: null, error: null });
    }),
    list: vi.fn(async () => ({ data: stored, error: null })),
    update: vi.fn(async () => ({ data: null, error: null })),
  };
  const registerPasskey = vi.fn(() => {
    stored = [
      ...stored,
      { created_at: "2026-10-09T09:00:00Z", id: "pk-2" } as (typeof stored)[0],
    ];
    return Promise.resolve({ data: { id: "pk-2" }, error: null });
  });
  const supabase = fakeSupabase({
    auth: { ...signedOut, passkey, registerPasskey },
  });

  renderWithApp(<Passkeys />, { locale: "en", supabase });
  expect(await screen.findByText("Phone")).toBeTruthy();
  expect(screen.getByText("Last used Thursday, October 8")).toBeTruthy();

  fireEvent.change(screen.getByLabelText("Device name"), {
    target: { value: "Laptop" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add a passkey" }));
  await waitFor(() =>
    expect(passkey.update).toHaveBeenCalledWith({
      friendlyName: "Laptop",
      passkeyId: "pk-2",
    })
  );
  expect(await screen.findByRole("status")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Remove Phone" }));
  await waitFor(() => expect(screen.queryByText("Phone")).toBeNull());
  expect(passkey.delete).toHaveBeenCalledWith({ passkeyId: "pk-1" });
});
