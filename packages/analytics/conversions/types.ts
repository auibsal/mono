/** Who converted. Values are normalized and SHA-256 hashed before sending. */
export interface ConversionUser {
  email?: string | null;
  /** Your user id; hashed, then used to match across devices. */
  externalId?: string | null;
  /** With country code, e.g. +9647701234567 or 9647701234567. */
  phone?: string | null;
}

/** Browser context captured when the visitor started the action. */
export interface Attribution {
  /** Meta click id cookie (_fbc). */
  fbc?: string;
  /** Meta browser id cookie (_fbp). */
  fbp?: string;
  ipAddress?: string;
  /** Page where the action started. */
  sourceUrl?: string;
  /** TikTok click id from the landing URL. */
  ttclid?: string;
  /** TikTok browser id cookie (_ttp). */
  ttp?: string;
  userAgent?: string;
}

export interface ConversionContext {
  attribution?: Attribution;
  /** Shared with the browser event so the platforms count it once. */
  eventId?: string;
  eventTime?: Date;
  user?: ConversionUser;
}

export class ConversionError extends Error {
  readonly destination: string;
  readonly status: number;

  constructor(destination: string, status: number, detail: string) {
    super(`${destination} conversion failed (${status}): ${detail}`);
    this.name = "ConversionError";
    this.destination = destination;
    this.status = status;
  }
}

export const REQUEST_TIMEOUT_MS = 10_000;
