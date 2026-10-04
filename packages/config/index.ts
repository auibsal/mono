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

const projectSchema = z
  .object({
    domain: z.string().min(1),
    hosts: z.object({
      api: z.url(),
      app: z.url(),
      docs: z.url(),
      web: z.url(),
    }),
    /**
     * Default journal name. The live value is the `journal.name_*` setting in
     * the database, so the name can change without a code edit.
     */
    journal: z.object({ name_ar: z.string().min(1), name_en: z.string().min(1) }),
    locale: z
      .object({
        default: z.enum(supportedLocales),
        enabled: z.array(z.enum(supportedLocales)).nonempty(),
      })
      .refine((locale) => locale.enabled.includes(locale.default), {
        message: "locale.default must be one of locale.enabled",
      }),
    motto: z.object({ ar: z.string().min(1), en: z.string().min(1) }),
    name: z.string().min(1),
    nameAr: z.string().min(1),
    orgName: z.string().min(1),
    orgNameAr: z.string().min(1),
    orgSlug: z.string().min(1),
    region: z.object({
      country: z.string().length(2),
      currency: z.string().length(3),
      numberingSystem: z.enum(["latn", "arab"]),
      timeZone: z.string().min(1),
      weekStartsOn: z.number().int().min(0).max(6),
    }),
    repoUrl: filled(z.url()),
    shortName: z.string().min(1),
    slug: z.string().min(1),
    supportEmail: filled(z.email()),
    url: filled(z.url()),
  })
  .strict();

export type Project = z.infer<typeof projectSchema>;

export const project: Project = projectSchema.parse(raw);
