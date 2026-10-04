import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { CreateOrganizationForm } from "@/components/organization-form";
import { fakeSupabase, renderWithApp } from "./render";

const GENERATED_SLUG = /^org-[a-z0-9]+$/;

const setup = (rpc: ReturnType<typeof vi.fn>, locale: "ar" | "en" = "en") => {
  const onCreated = vi.fn();
  renderWithApp(<CreateOrganizationForm onCreated={onCreated} />, {
    locale,
    supabase: fakeSupabase({ rpc }),
  });
  return { onCreated };
};

describe("create organization", () => {
  test("suggests an address and creates the organization", async () => {
    const rpc = vi.fn(async () => ({
      data: { id: "org-1", name: "Acme Trading", slug: "acme-trading" },
      error: null,
    }));
    const { onCreated } = setup(rpc);

    fireEvent.change(screen.getByLabelText("Organization name"), {
      target: { value: "Acme Trading" },
    });
    expect((screen.getByLabelText("Address") as HTMLInputElement).value).toBe(
      "acme-trading"
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Create organization" })
    );

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("org-1"));
    expect(rpc).toHaveBeenCalledWith("create_organization", {
      org_name: "Acme Trading",
      org_slug: "acme-trading",
    });
    expect(localStorage.getItem("active-organization")).toBe("org-1");
  });

  test("gives Arabic names an editable Latin address", () => {
    setup(vi.fn(), "ar");

    fireEvent.change(screen.getByLabelText("اسم المؤسسة"), {
      target: { value: "شركة الرافدين" },
    });
    expect((screen.getByLabelText("المعرّف") as HTMLInputElement).value).toMatch(
      GENERATED_SLUG
    );
  });

  test("explains a taken address", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    }));
    setup(rpc);

    fireEvent.change(screen.getByLabelText("Organization name"), {
      target: { value: "Acme" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create organization" })
    );

    expect(
      await screen.findByText("That address is already taken. Try another one.")
    ).toBeDefined();
  });

  test("validates before calling the database", () => {
    const rpc = vi.fn();
    setup(rpc);

    fireEvent.click(
      screen.getByRole("button", { name: "Create organization" })
    );

    expect(screen.getByRole("alert").textContent).toBe("Enter a name.");
    expect(rpc).not.toHaveBeenCalled();
  });
});
