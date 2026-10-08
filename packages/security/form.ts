import arcjet, {
  detectBot,
  shield,
  slidingWindow,
  validateEmail,
} from "@arcjet/next";
import { keys } from "./keys";

const arcjetKey = keys().ARCJET_KEY;

/**
 * Guards a public form endpoint (no sign-in): common attacks, automated
 * clients, five submissions per address per ten minutes, and addresses
 * that cannot receive mail. Arcjet fails open, so an outage or a spent
 * quota never blocks a real person; the endpoint's own checks still run.
 */
const formGuard = arcjetKey
  ? arcjet({
      characteristics: ["ip.src"],
      key: arcjetKey,
      rules: [
        shield({ mode: "LIVE" }),
        detectBot({ allow: [], mode: "LIVE" }),
        slidingWindow({ interval: "10m", max: 5, mode: "LIVE" }),
        validateEmail({
          deny: ["DISPOSABLE", "INVALID", "NO_MX_RECORDS"],
          mode: "LIVE",
        }),
      ],
    })
  : undefined;

export type FormVerdict = "ok" | "bot" | "rate_limited" | "invalid_email";

export const protectForm = async (
  request: Request,
  email: string
): Promise<FormVerdict> => {
  if (!formGuard) {
    return "ok";
  }
  const decision = await formGuard.protect(request, { email });
  if (!decision.isDenied()) {
    return "ok";
  }
  if (decision.reason.isRateLimit()) {
    return "rate_limited";
  }
  if (decision.reason.isEmail()) {
    return "invalid_email";
  }
  return "bot";
};
