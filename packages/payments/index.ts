/**
 * Isomorphic exports: payment types and the in-app purchase policy. Server
 * code (providers, billing) lives in `@repo/payments/server`.
 */
export {
  canPurchaseInApp,
  detectPlatform,
  getPurchasePolicy,
  type Platform,
  type PurchasePolicy,
} from "./policy";
export * from "./types";
