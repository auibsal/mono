import { fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { SignInForm } from "@/components/auth/sign-in-form";
import { fakeSupabase, renderWithApp } from "./render";

test("shows a translated error for wrong credentials", async () => {
  const signInWithPassword = vi.fn(async () => ({
    data: {},
    error: { code: "invalid_credentials", status: 400 },
  }));
  const supabase = fakeSupabase({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithPassword,
    },
  });

  renderWithApp(<SignInForm />, { locale: "en", supabase });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "Student@AUIB.edu.iq" },
  });
  // AUIB addresses default to a link; this member picks the password.
  fireEvent.click(
    screen.getByRole("button", { name: "Use my password instead" })
  );
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "wrong-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "That email and password don't match."
    )
  );
  expect(signInWithPassword).toHaveBeenCalledWith({
    email: "student@auib.edu.iq",
    password: "wrong-password",
  });
});

test("magic links never reveal whether an account exists", async () => {
  const signInWithOtp = vi.fn(async () => ({
    data: {},
    error: { code: "otp_disabled", status: 422 },
  }));
  const supabase = fakeSupabase({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithOtp,
    },
  });

  renderWithApp(<SignInForm />, { locale: "ar", supabase });
  fireEvent.click(
    screen.getByRole("button", {
      name: "أرسل لي رابط دخول بالبريد بدلًا من ذلك",
    })
  );
  fireEvent.change(screen.getByLabelText("البريد الإلكتروني"), {
    target: { value: "nobody@gmail.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "أرسل الرابط" }));

  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain("nobody@gmail.com")
  );
  expect(signInWithOtp).toHaveBeenCalledWith(
    expect.objectContaining({
      options: expect.objectContaining({ shouldCreateUser: false }),
    })
  );
});

test("an AUIB address signs in by link by default", () => {
  const supabase = fakeSupabase({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  });

  renderWithApp(<SignInForm />, { locale: "en", supabase });
  expect(screen.getByLabelText("Password")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "student@auib.edu.iq" },
  });
  expect(screen.queryByLabelText("Password")).toBeNull();
  expect(screen.getByRole("button", { name: "Send the link" })).toBeTruthy();
});
