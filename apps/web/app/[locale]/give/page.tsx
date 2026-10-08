import { project } from "@repo/config";
import { formatIqd, formatNumber } from "@repo/internationalization/format";
import { charity, content, localized } from "@repo/sal-data";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader, Section } from "@/components/section";
import { type LocaleParams, sectionMetadata } from "@/lib/page";
import { readPublished } from "@/lib/supabase";

export const generateMetadata = sectionMetadata("web.give", "/give");

const WAYS = ["books", "volunteer", "warm"] as const;

const GivePage = async ({ params }: LocaleParams) => {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "web.give" });
  const [campaigns, progress, perSet] = await Promise.all([
    readPublished(["charity"], (c) => charity.activeCampaigns(c), []),
    readPublished(["charity"], (c) => charity.campaignProgress(c), []),
    readPublished(
      ["charity"],
      (c) => content.publicSetting(c, "charity.cost_per_winter_set_iqd"),
      null
    ),
  ]);
  const campaign = campaigns?.[0];
  const meter = campaign
    ? progress.find((p) => p.campaign_id === campaign.id)
    : undefined;
  const [receipts, impact] = campaign
    ? await Promise.all([
        readPublished(
          ["charity"],
          (c) => charity.publicReceipts(c, campaign.id),
          []
        ),
        readPublished(
          ["charity"],
          (c) => charity.impactMetrics(c, campaign.id),
          []
        ),
      ])
    : [[], []];
  const unitLabel = campaign ? localized(campaign, "unit_label", locale) : "";
  const setCost = Number(perSet);

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-12 px-4 py-16">
      <PageHeader lede={t("lede")} title={t("title")} />

      <Section id="ways" title={t("waysTitle")}>
        <ul className="grid gap-4 sm:grid-cols-3">
          {WAYS.map((way) => (
            <li className="frame bg-surface-tint p-5" key={way}>
              <h3 className="type-subheading">{t(`ways.${way}`)}</h3>
            </li>
          ))}
        </ul>
        <p className="type-body">{t("waysNote")}</p>
      </Section>

      <Section id="meter" title={t("meterTitle")}>
        {campaign && meter ? (
          <div className="grid gap-3">
            <h3 className="type-subheading">
              {localized(campaign, "title", locale)}
            </h3>
            {meter.target_units ? (
              <>
                <div
                  aria-hidden="true"
                  className="h-3 w-full rounded-full bg-rule"
                >
                  <div
                    className="h-3 rounded-full bg-title"
                    style={{
                      width: `${Math.min(100, (meter.units / meter.target_units) * 100)}%`,
                    }}
                  />
                </div>
                <progress
                  aria-label={t("meterTitle")}
                  className="sr-only"
                  max={meter.target_units}
                  value={Math.min(meter.units, meter.target_units)}
                />
                <p className="type-body font-medium">
                  {t("meterUnits", {
                    label: unitLabel,
                    target: formatNumber(meter.target_units, locale),
                    units: formatNumber(meter.units, locale),
                  })}
                </p>
              </>
            ) : (
              <p className="type-body font-medium">
                {t("meterUnitsOpen", {
                  label: unitLabel,
                  units: formatNumber(meter.units, locale),
                })}
              </p>
            )}
            <p className="type-caption">
              {t("counted", { amount: formatIqd(meter.counted_iqd, locale) })}
              {meter.pending_iqd > 0
                ? ` · ${t("pending", { amount: formatIqd(meter.pending_iqd, locale) })}`
                : ""}
            </p>
            <p className="type-caption">{t("countedNote")}</p>
          </div>
        ) : (
          <p className="type-body text-text-secondary">{t("noCampaign")}</p>
        )}
        {Number.isFinite(setCost) && setCost > 0 ? (
          <p className="type-caption">
            {t("perSet", { amount: formatIqd(setCost, locale) })}
          </p>
        ) : null}
      </Section>

      <Section id="transparency" title={t("transparencyTitle")}>
        <p className="type-lede">{t("transparencyLede")}</p>
        <blockquote className="grid gap-1 border-accent-line border-s-4 ps-4">
          <p className="type-body">{t("policy")}</p>
          <footer className="type-caption">{t("policySource")}</footer>
        </blockquote>
        {impact.length > 0 ? (
          <div className="grid gap-3">
            <h3 className="type-subheading">{t("impactTitle")}</h3>
            <dl className="grid gap-4 sm:grid-cols-3">
              {impact.map((m) => (
                <div className="frame bg-surface-tint p-5" key={m.id}>
                  <dt className="type-caption">
                    {localized(m, "label", locale)}
                  </dt>
                  <dd className="type-heading">
                    {formatNumber(Number(m.value), locale)}{" "}
                    {localized(m, "unit", locale)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
        <div className="grid gap-3">
          <h3 className="type-subheading">{t("receiptsTitle")}</h3>
          {receipts.length === 0 ? (
            <p className="type-body text-text-secondary">{t("noReceipts")}</p>
          ) : (
            <ul className="grid gap-2">
              {receipts.map((r) => (
                <li
                  className="flex flex-wrap items-baseline justify-between gap-3 border-rule border-b pb-2"
                  key={r.id}
                >
                  <span>{localized(r, "description", locale)}</span>
                  <span className="flex items-baseline gap-3">
                    {r.amount_iqd ? (
                      <span className="type-caption">
                        {formatIqd(r.amount_iqd, locale)}
                      </span>
                    ) : null}
                    <a
                      className="text-sm underline underline-offset-4"
                      href={`${project.hosts.api}/files/receipt?id=${r.id}`}
                      rel="noopener"
                      target="_blank"
                    >
                      {t("openReceipt")}
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </div>
  );
};

export default GivePage;
