import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ForgotForm } from "@/components/auth/forgot-form";
import { fakeSupabase, renderWithApp } from "./render";

describe("forgot password", () => {
  test("a second submit while the first is sending sends nothing", async () => {
    let finish: (value: { error: null }) => void = () => undefined;
    const resetPasswordForEmail = vi.fn(
      () =>
        new Promise<{ error: null }>((resolve) => {
          finish = resolve;
        })
    );
    const supabase = fakeSupabase();
    Object.assign(supabase.auth, { resetPasswordForEmail });
    renderWithApp(<ForgotForm />, { locale: "en", supabase });

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "member@auib.edu.iq" },
    });
    const form = screen
      .getByRole("button", { name: "Send reset link" })
      .closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
    expect(
      (screen.getByRole("button", { name: "Sending…" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);

    finish({ error: null });
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
  });
});
