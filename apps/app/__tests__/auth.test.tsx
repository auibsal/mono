import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { PhoneSignIn } from "@/components/auth/phone-sign-in";
import { renderWithApp } from "./render";

describe("phone sign-in", () => {
  test("asks for a mobile number in Arabic, kept left-to-right", () => {
    renderWithApp(<PhoneSignIn mode="sign-in" />);

    expect(screen.getByRole("heading", { name: "مرحباً بعودتك" })).toBeDefined();
    const phone = screen.getByLabelText("رقم الهاتف المحمول");
    expect(phone.getAttribute("type")).toBe("tel");
    // Phone numbers stay left-to-right in the Arabic (RTL) UI.
    expect(phone.getAttribute("dir")).toBe("ltr");
    expect(screen.queryByLabelText("الاسم الكامل")).toBeNull();
    expect(screen.getByRole("link", { name: "أنشئ حساباً" })).toBeDefined();
  });

  test("sign-up also asks for a name", () => {
    renderWithApp(<PhoneSignIn mode="sign-up" />, { locale: "en" });

    expect(screen.getByLabelText("Full name")).toBeDefined();
    expect(screen.getByLabelText("Mobile number")).toBeDefined();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeDefined();
  });
});
