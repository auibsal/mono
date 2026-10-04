import { z } from "zod";
import raw from "./project.json" with { type: "json" };

const PLACEHOLDER = /^\{\{[A-Z_]+\}\}$/;

/** True while a value is still an unfilled placeholder token from the template. */
export const isPlaceholder = (value: string) => PLACEHOLDER.test(value);

/**
 * Functional values (URLs, emails, IDs) resolve to `undefined` until
 * `bun run init` replaces the placeholder, so an uninitialized template still
 * builds and runs. Display names keep the raw token so it is visibly obvious.
 */
const filled = <T extends z.ZodType<string, string>>(schema: T) =>
  z
    .string()
    .transform((value) => (isPlaceholder(value) ? undefined : value))
    .pipe(schema.optional());

/** Every locale the template ships configuration for. */
export const supportedLocales = ["ar", "en", "ckb"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

// Android application IDs: dot-separated segments starting with a letter.
const BUNDLE_ID = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

const projectSchema = z
  .object({
    bundleId: filled(z.string().regex(BUNDLE_ID)),
    commerce: z.object({
      /**
       * Whether purchases may be made inside the iOS/Android apps.
       *
       * - `false` (default): digital goods/subscriptions. Apple (App Review
       *   Guideline 3.1.1) and Google Play require their own in-app billing
       *   for these, so native apps must not show a third-party checkout.
       * - `true`: physical goods or real-world services (retail, bookings),
       *   which may use third-party gateways such as Wayl (Guideline 3.1.3(e)).
       */
      allowNativeCheckout: z.boolean(),
    }),
    locale: z
      .object({
        default: z.enum(supportedLocales),
        enabled: z.array(z.enum(supportedLocales)).nonempty(),
      })
      .refine((locale) => locale.enabled.includes(locale.default), {
        message: "locale.default must be one of locale.enabled",
      }),
    name: z.string().min(1),
    orgName: z.string().min(1),
    orgSlug: z.string().min(1),
    region: z.object({
      country: z.string().length(2),
      currency: z.string().length(3),
      numberingSystem: z.enum(["latn", "arab"]),
      timeZone: z.string().min(1),
      weekStartsOn: z.number().int().min(0).max(6),
    }),
    repoUrl: filled(z.url()),
    slug: z.string().min(1),
    supportEmail: filled(z.email()),
    url: filled(z.url()),
  })
  .strict();

export type Project = z.infer<typeof projectSchema>;

export const project: Project = projectSchema.parse(raw);
