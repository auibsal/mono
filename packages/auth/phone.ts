import {
  type CountryCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js/min";

export const DEFAULT_PHONE_COUNTRY: CountryCode = "IQ";

// Arabic-Indic (٠-٩) and Extended Arabic-Indic/Persian (۰-۹) digits, which
// Arabic and Kurdish keyboards produce.
const ARABIC_INDIC_DIGITS = /[٠-٩]/g;
const PERSIAN_DIGITS = /[۰-۹]/g;
// Iraqi mobile numbers: +964 7X XXXX XXXX (Asiacell, Zain, Korek, …).
const IRAQI_MOBILE = /^\+9647\d{9}$/;
const INTERNATIONAL_PREFIX = /^00/;

/** Converts Arabic-Indic and Persian digits to ASCII digits. */
export const toWesternDigits = (value: string) =>
  value
    .replace(ARABIC_INDIC_DIGITS, (digit) =>
      String(digit.charCodeAt(0) - 0x06_60)
    )
    .replace(PERSIAN_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x06_f0));

/**
 * Normalizes user input such as "0770 123 4567", "٠٧٧٠١٢٣٤٥٦٧",
 * "00964 770…" or "+964 770…" to E.164 ("+9647701234567").
 * Returns null when the number is not valid.
 */
export const normalizePhone = (
  input: string,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY
): string | null => {
  const western = toWesternDigits(input)
    .trim()
    .replace(INTERNATIONAL_PREFIX, "+");
  const phone = parsePhoneNumberFromString(western, defaultCountry);

  return phone?.isValid() ? phone.number : null;
};

export const isIraqiMobile = (e164: string) => IRAQI_MOBILE.test(e164);

/** Formats an E.164 number for display; returns the input if it can't parse. */
export const formatPhone = (
  e164: string,
  style: "international" | "national" = "international"
) => {
  const phone = parsePhoneNumberFromString(
    e164.startsWith("+") ? e164 : `+${e164}`
  );

  if (!phone) {
    return e164;
  }

  return style === "national"
    ? phone.formatNational()
    : phone.formatInternational();
};
