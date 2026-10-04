// Supabase Auth "Send SMS" hook: delivers one-time codes through the
// providers configured in SMS_PROVIDERS, in order, falling back to the next
// one on failure. Useful in Iraq, where a local aggregator or WhatsApp often
// delivers more reliably and cheaply than international SMS routes.
//
// Secrets (supabase secrets set …):
//   SEND_SMS_HOOK_SECRET   "v1,whsec_…" from Authentication → Hooks
//   SMS_PROVIDERS          comma-separated: http, twilio, twilio-whatsapp, log
//   SMS_GATEWAY_URL / SMS_GATEWAY_TOKEN / SMS_SENDER_ID   (http)
//   TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM   (twilio)
//   TWILIO_WHATSAPP_FROM                                   (twilio-whatsapp)
import { Webhook } from "standardwebhooks";

interface HookPayload {
  sms: { otp: string };
  user: {
    id: string;
    phone: string;
    user_metadata?: { locale?: string };
  };
}

type Provider = (to: string, message: string) => Promise<void>;

const LEADING_PLUS = /^\+/;

const env = (name: string) => Deno.env.get(name) ?? "";

const messageFor = (otp: string, locale?: string) =>
  locale === "en"
    ? `${otp} is your verification code. Do not share it with anyone.`
    : `${otp} هو رمز التحقق الخاص بك. لا تشاركه مع أي شخص.`;

const twilio =
  (from: string): Provider =>
  async (to, message) => {
    const sid = env("TWILIO_ACCOUNT_SID");
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        body: new URLSearchParams({ Body: message, From: from, To: to }),
        headers: {
          Authorization: `Basic ${btoa(`${sid}:${env("TWILIO_AUTH_TOKEN")}`)}`,
        },
        method: "POST",
      }
    );
    if (!response.ok) {
      throw new Error(`Twilio responded ${response.status}`);
    }
  };

const providers: Record<string, Provider> = {
  // Generic JSON gateway for local aggregators. Adapt the body to the
  // provider's API.
  http: async (to, message) => {
    const response = await fetch(env("SMS_GATEWAY_URL"), {
      body: JSON.stringify({ message, sender: env("SMS_SENDER_ID"), to }),
      headers: {
        Authorization: `Bearer ${env("SMS_GATEWAY_TOKEN")}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`SMS gateway responded ${response.status}`);
    }
  },
  // Local development only: prints the code instead of sending it.
  log: (to, message) => {
    console.log(`[send-sms] ${to}: ${message}`);
    return Promise.resolve();
  },
  twilio: (to, message) => twilio(env("TWILIO_FROM"))(to, message),
  "twilio-whatsapp": (to, message) =>
    twilio(`whatsapp:${env("TWILIO_WHATSAPP_FROM")}`)(
      `whatsapp:${to}`,
      message
    ),
};

const errorResponse = (status: number, message: string) =>
  Response.json({ error: { http_code: status, message } }, { status });

Deno.serve(async (request) => {
  const secret = env("SEND_SMS_HOOK_SECRET").replace("v1,whsec_", "");
  const body = await request.text();

  let payload: HookPayload;
  try {
    payload = new Webhook(secret).verify(
      body,
      Object.fromEntries(request.headers)
    ) as HookPayload;
  } catch {
    return errorResponse(401, "Invalid hook signature");
  }

  // Supabase stores numbers without the leading "+".
  const to = `+${payload.user.phone.replace(LEADING_PLUS, "")}`;
  const message = messageFor(
    payload.sms.otp,
    payload.user.user_metadata?.locale
  );
  const chain = env("SMS_PROVIDERS")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name in providers);

  for (const name of chain) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: providers are tried one at a time, in order
      await providers[name](to, message);
      return Response.json({});
    } catch (error) {
      console.error(
        `[send-sms] ${name} failed for user ${payload.user.id}`,
        error
      );
    }
  }

  return errorResponse(
    502,
    chain.length > 0 ? "All SMS providers failed" : "No SMS provider configured"
  );
});
