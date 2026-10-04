import { describe, expect, test, vi } from "vitest";
import { sendPhoneOtp, toOtpErrorCode, verifyPhoneOtp } from "./otp";

const clientWith = (auth: Record<string, unknown>) =>
  ({ auth }) as unknown as Parameters<typeof sendPhoneOtp>[0];

describe("phone OTP", () => {
  test("maps Supabase error codes", () => {
    expect(
      toOtpErrorCode({ code: "over_sms_send_rate_limit", status: 429 })
    ).toBe("rate_limited");
    expect(toOtpErrorCode({ code: "otp_expired", status: 403 })).toBe(
      "invalid_code"
    );
    expect(toOtpErrorCode({ code: undefined, status: 429 })).toBe(
      "rate_limited"
    );
    expect(toOtpErrorCode({ code: "something_new", status: 500 })).toBe(
      "unknown"
    );
  });

  test("rejects invalid numbers without calling Supabase", async () => {
    const signInWithOtp = vi.fn();
    const result = await sendPhoneOtp(clientWith({ signInWithOtp }), "123");

    expect(result).toMatchObject({ code: "invalid_phone", ok: false });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  test("sends the code to the normalized number", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    const result = await sendPhoneOtp(
      clientWith({ signInWithOtp }),
      "٠٧٧٠ ١٢٣ ٤٥٦٧",
      { channel: "whatsapp", fullName: " Sara ", locale: "ar" }
    );

    expect(result).toEqual({
      ok: true,
      phone: "+9647701234567",
      value: undefined,
    });
    expect(signInWithOtp).toHaveBeenCalledWith({
      options: {
        captchaToken: undefined,
        channel: "whatsapp",
        data: { full_name: "Sara", locale: "ar" },
        shouldCreateUser: true,
      },
      phone: "+9647701234567",
    });
  });

  test("verifies the code", async () => {
    const verifyOtp = vi
      .fn()
      .mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const result = await verifyPhoneOtp(
      clientWith({ verifyOtp }),
      "+9647701234567",
      "123456"
    );

    expect(result).toEqual({
      ok: true,
      phone: "+9647701234567",
      value: { userId: "user-1" },
    });
    expect(verifyOtp).toHaveBeenCalledWith({
      phone: "+9647701234567",
      token: "123456",
      type: "sms",
    });
  });
});
