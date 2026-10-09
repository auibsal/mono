import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import type { Locale } from "@repo/internationalization";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/section";
import { localizedMetadata } from "@/lib/metadata";

const CODE = /^[a-z0-9]{6,32}$/;

interface VerifyParams {
  readonly params: Promise<{ locale: Locale }>;
  readonly searchParams: Promise<{ code?: string }>;
}

export const generateMetadata = async ({
  params,
}: VerifyParams): Promise<Metadata> => {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "web.verify" });
  return {
    ...localizedMetadata(locale, "/verify", {
      description: t("lede"),
      title: t("title"),
    }),
    robots: { follow: false, index: false },
  };
};

/** Check a certificate: type the code printed at its foot. */
const VerifyPage = async ({ params, searchParams }: VerifyParams) => {
  const { locale } = await params;
  setRequestLocale(locale);
  const { code } = await searchParams;
  const typed = code?.trim().toLowerCase();
  if (typed && CODE.test(typed)) {
    redirect(`/${locale}/verify/${typed}`);
  }
  const t = await getTranslations({ locale, namespace: "web.verify" });

  return (
    <div className="mx-auto grid w-full max-w-xl gap-8 px-4 py-16">
      <PageHeader lede={t("lede")} title={t("title")} />
      <form action={`/${locale}/verify`} className="grid gap-3" method="get">
        <Label htmlFor="verify-code">{t("code")}</Label>
        <Input
          autoComplete="off"
          dir="ltr"
          id="verify-code"
          name="code"
          pattern="[A-Za-z0-9]{6,32}"
          required
        />
        {typed ? (
          <p className="text-title" role="alert">
            {t("invalid")}
          </p>
        ) : null}
        <Button className="justify-self-start" type="submit">
          {t("check")}
        </Button>
      </form>
    </div>
  );
};

export default VerifyPage;
