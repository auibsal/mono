import { showBetaFeature } from "@repo/feature-flags";
import type { Locale } from "@repo/internationalization";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localizedMetadata } from "@/lib/metadata";
import { Cases } from "./components/cases";
import { CTA } from "./components/cta";
import { FAQ } from "./components/faq";
import { Features } from "./components/features";
import { Hero } from "./components/hero";
import { Stats } from "./components/stats";
import { Testimonials } from "./components/testimonials";

interface HomeProps {
  params: Promise<{
    locale: Locale;
  }>;
}

export const generateMetadata = async ({
  params,
}: HomeProps): Promise<Metadata> => {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "web.home.meta" });

  return localizedMetadata(locale, "/", {
    description: t("description"),
    title: t("title"),
  });
};

const Home = async ({ params }: HomeProps) => {
  const { locale } = await params;
  setRequestLocale(locale);
  // <module:feature-flags>
  const [betaFeature, t] = await Promise.all([
    showBetaFeature(),
    getTranslations("web.home"),
  ]);
  // </module:feature-flags>

  return (
    <>
      {/* <module:feature-flags> */}
      {betaFeature ? (
        <div className="w-full bg-black py-2 text-center text-white">
          {t("beta")}
        </div>
      ) : null}
      {/* </module:feature-flags> */}
      <Hero />
      <Cases />
      <Features />
      <Stats />
      <Testimonials />
      <FAQ />
      <CTA />
    </>
  );
};

export default Home;
