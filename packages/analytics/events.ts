/**
 * The one event catalog, sent to GA4 as-is. No personal data in
 * parameters: ids and slugs only.
 */
export interface AnalyticsEvents {
  calendar_download: { event_slug: string };
  contact_sent: Record<string, never>;
  document_pdf_download: { code: string };
  join_click: { location: string };
  language_switch: { to: string };
  nexus_handoff: {
    action: "rsvp" | "submit" | "sign_in" | "sign_up";
    slug?: string;
  };
  removal_request_sent: Record<string, never>;
  search: { search_term: string };
}

export type AnalyticsEvent = keyof AnalyticsEvents;
