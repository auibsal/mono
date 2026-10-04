/** What the visitor allowed. Ads covers Meta, TikTok and Google Ads. */
export interface ConsentState {
  ads: boolean;
  analytics: boolean;
}

type GoogleConsentValue = "denied" | "granted";

export interface GoogleConsent {
  ad_personalization: GoogleConsentValue;
  ad_storage: GoogleConsentValue;
  ad_user_data: GoogleConsentValue;
  analytics_storage: GoogleConsentValue;
}

/**
 * Regions where Google requires consent before ads and analytics storage
 * (EEA, United Kingdom, Switzerland). Visitors there start denied whatever the
 * project default is, until `setConsent` grants it.
 */
export const CONSENT_REQUIRED_REGIONS = [
  "AT",
  "BE",
  "BG",
  "CH",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GB",
  "GR",
  "HR",
  "HU",
  "IE",
  "IS",
  "IT",
  "LI",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
];

const value = (granted: boolean): GoogleConsentValue =>
  granted ? "granted" : "denied";

/** Maps our consent state to Google Consent Mode v2. */
export const toGoogleConsent = ({
  ads,
  analytics,
}: ConsentState): GoogleConsent => ({
  ad_personalization: value(ads),
  ad_storage: value(ads),
  ad_user_data: value(ads),
  analytics_storage: value(analytics),
});
