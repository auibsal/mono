import type { Locale } from "@repo/internationalization";
import {
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { localized, recognition } from "@repo/sal-data";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/section";
import { localizedMetadata } from "@/lib/metadata";
import { readPublished } from "@/lib/supabase";

const CODE = /^[a-z0-9]{6,32}$/;

interface CertificateParams {
  readonly params: Promise<{ code: string; locale: Locale }>;
}

export const generateMetadata = async ({
  params,
}: CertificateParams): Promise<Metadata> => {
  const { code, locale } = await params;
  const t = await getTranslations({ locale, namespace: "web.verify" });
  return {
    ...localizedMetadata(locale, `/verify/${code}`, {
      description: t("lede"),
      title: t("title"),
    }),
    robots: { follow: false, index: false },
  };
};

/**
 * The public check of a certificate (issued or revoked) by its code: who
 * holds it, for what, and whether it still stands.
 */
const CertificatePage = async ({ params }: CertificateParams) => {
  const { code, locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "web.verify" });
  const certificate = CODE.test(code)
    ? await readPublished(
        ["certificates"],
        (c) => recognition.verifyCertificate(c, code),
        null
      )
    : null;

  if (!certificate) {
    return (
      <div className="mx-auto grid w-full max-w-xl gap-6 px-4 py-16">
        <PageHeader lede={t("notFound")} title={t("title")} />
        <Link className="underline underline-offset-4" href="/verify">
          {t("again")}
        </Link>
      </div>
    );
  }

  const kind = certificate.kind as recognition.CertificateKind;
  const date = (value: string | null) =>
    value ? formatLongDate(value, locale, true) : "";
  const rows: [string, string][] = [
    [t("holder"), localized(certificate, "holder", locale)],
    [t("kind"), t(`kinds.${kind}`)],
  ];
  if (certificate.role_en || certificate.role_ar) {
    rows.push([t("role"), localized(certificate, "role", locale)]);
  }
  if (certificate.partner_en || certificate.partner_ar) {
    rows.push([t("partner"), localized(certificate, "partner", locale)]);
  }
  if (certificate.citation_en || certificate.citation_ar) {
    rows.push([t("citation"), localized(certificate, "citation", locale)]);
  }
  if (certificate.hours) {
    rows.push([t("hours"), formatNumber(Number(certificate.hours))]);
  }
  if (certificate.period_from) {
    rows.push([
      t("period"),
      `${date(certificate.period_from)} – ${date(certificate.period_to) || t("present")}`,
    ]);
  }
  rows.push([t("issued"), date(certificate.issued_at)]);
  rows.push([t("serial"), certificate.serial ?? ""]);

  return (
    <div className="mx-auto grid w-full max-w-xl gap-8 px-4 py-16">
      <PageHeader lede={t("lede")} title={t("title")} />
      <p
        className={
          certificate.status === "revoked"
            ? "font-bold text-title"
            : "font-bold text-text"
        }
        role="status"
      >
        {certificate.status === "revoked"
          ? t("revoked", { date: date(certificate.revoked_at) })
          : t("valid")}
      </p>
      <dl className="grid gap-3 rounded-card bg-surface-tint p-5">
        {rows.map(([label, value]) => (
          <div className="grid gap-1 sm:grid-cols-[10rem_1fr]" key={label}>
            <dt className="type-kicker">{label}</dt>
            <dd className="type-body" dir="auto">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="type-caption">{t("signedBy")}</p>
    </div>
  );
};

export default CertificatePage;
