/**
 * One event catalogue for every destination. Call `track("purchase", …)`
 * once; GA4, Meta and TikTok each receive their own event name and
 * parameter shape.
 */

export interface AnalyticsItem {
  category?: string;
  id: string;
  name?: string;
  /** Unit price, in the event currency. */
  price?: number;
  quantity?: number;
}

interface Commerce {
  /** ISO 4217 code; defaults to the project currency. */
  currency?: string;
  items?: AnalyticsItem[];
  value?: number;
}

export interface EventProperties {
  add_payment_info: Commerce;
  add_to_cart: Commerce;
  begin_checkout: Commerce;
  contact: { method?: string };
  generate_lead: { currency?: string; value?: number };
  login: { method: string };
  purchase: Commerce & { transactionId: string; value: number };
  search: { query: string };
  sign_up: { method: string };
  start_trial: Commerce;
  subscribe: Commerce & { transactionId?: string };
  view_item: Commerce;
}

export type AnalyticsEvent = keyof EventProperties;

interface Destinations {
  /** GA4 recommended event, or a custom one. */
  ga4: string;
  /** Meta standard event; omitted when Meta has no equivalent. */
  meta?: string;
  /** TikTok standard event (2025 names); omitted when there's none. */
  tiktok?: string;
}

export const eventNames: Record<AnalyticsEvent, Destinations> = {
  add_payment_info: {
    ga4: "add_payment_info",
    meta: "AddPaymentInfo",
    tiktok: "AddPaymentInfo",
  },
  add_to_cart: { ga4: "add_to_cart", meta: "AddToCart", tiktok: "AddToCart" },
  begin_checkout: {
    ga4: "begin_checkout",
    meta: "InitiateCheckout",
    tiktok: "InitiateCheckout",
  },
  contact: { ga4: "contact", meta: "Contact", tiktok: "Contact" },
  generate_lead: { ga4: "generate_lead", meta: "Lead", tiktok: "Lead" },
  login: { ga4: "login" },
  purchase: { ga4: "purchase", meta: "Purchase", tiktok: "Purchase" },
  search: { ga4: "search", meta: "Search", tiktok: "Search" },
  sign_up: {
    ga4: "sign_up",
    meta: "CompleteRegistration",
    tiktok: "CompleteRegistration",
  },
  start_trial: { ga4: "start_trial", meta: "StartTrial", tiktok: "StartTrial" },
  subscribe: { ga4: "subscribe", meta: "Subscribe", tiktok: "Subscribe" },
  view_item: { ga4: "view_item", meta: "ViewContent", tiktok: "ViewContent" },
};

type Params = Record<string, unknown>;

export interface MappedEvent {
  name: string;
  params: Params;
}

/** Drops undefined values so destinations don't receive empty keys. */
const compact = (params: Params): Params =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined)
  );

const commerceOf = (properties: object) => properties as Commerce;

const stringOf = (properties: object, key: string) => {
  const value = (properties as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
};

/**
 * The id that lets Meta and TikTok merge a browser event with the same event
 * sent from the server. Purchases default to one derived from the order.
 */
export const defaultEventId = <E extends AnalyticsEvent>(
  event: E,
  properties: EventProperties[E]
) => {
  const transactionId = stringOf(properties, "transactionId");
  return transactionId ? `${event}:${transactionId}` : undefined;
};

export const toGa4 = <E extends AnalyticsEvent>(
  event: E,
  properties: EventProperties[E],
  defaultCurrency: string
): MappedEvent => {
  const { currency, items, value } = commerceOf(properties);

  return {
    name: eventNames[event].ga4,
    params: compact({
      currency: value === undefined ? currency : (currency ?? defaultCurrency),
      items: items?.map((item) =>
        compact({
          item_category: item.category,
          item_id: item.id,
          item_name: item.name,
          price: item.price,
          quantity: item.quantity,
        })
      ),
      method: stringOf(properties, "method"),
      search_term: stringOf(properties, "query"),
      transaction_id: stringOf(properties, "transactionId"),
      value,
    }),
  };
};

export const toMeta = <E extends AnalyticsEvent>(
  event: E,
  properties: EventProperties[E],
  defaultCurrency: string
): MappedEvent | null => {
  const name = eventNames[event].meta;
  if (!name) {
    return null;
  }
  const { currency, items, value } = commerceOf(properties);

  return {
    name,
    params: compact({
      content_ids: items?.map((item) => item.id),
      content_type: items ? "product" : undefined,
      contents: items?.map((item) =>
        compact({
          id: item.id,
          item_price: item.price,
          quantity: item.quantity ?? 1,
        })
      ),
      currency: value === undefined ? currency : (currency ?? defaultCurrency),
      num_items: items?.reduce((sum, item) => sum + (item.quantity ?? 1), 0),
      order_id: stringOf(properties, "transactionId"),
      search_string: stringOf(properties, "query"),
      value,
    }),
  };
};

export const toTikTok = <E extends AnalyticsEvent>(
  event: E,
  properties: EventProperties[E],
  defaultCurrency: string
): MappedEvent | null => {
  const name = eventNames[event].tiktok;
  if (!name) {
    return null;
  }
  const { currency, items, value } = commerceOf(properties);

  return {
    name,
    params: compact({
      content_type: items ? "product" : undefined,
      contents: items?.map((item) =>
        compact({
          content_category: item.category,
          content_id: item.id,
          content_name: item.name,
          price: item.price,
          quantity: item.quantity ?? 1,
        })
      ),
      currency: value === undefined ? currency : (currency ?? defaultCurrency),
      order_id: stringOf(properties, "transactionId"),
      query: stringOf(properties, "query"),
      value,
    }),
  };
};
