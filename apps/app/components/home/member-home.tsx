"use client";

import { useLocale, useTranslations } from "next-intl";
import { useProfile } from "@/lib/queries";
import { JournalSection } from "./journal";
import { MembershipCard } from "./membership-card";
import { NextEvents } from "./next-events";
import { Notices } from "./notices";
import { MyProgrammes } from "./programmes";
import { SixWords } from "./six-words";
import { VotingEligibility } from "./voting";

/**
 * Member home, mobile-first: what to do next first (notices only when there
 * are some), then voting and the Book of Members. The calendar feed is a
 * setting, so it lives in Profile and privacy.
 */
export const MemberHome = () => {
  const t = useTranslations("nexus.home");
  const locale = useLocale();
  const profile = useProfile();
  const name =
    (locale === "ar" && profile.data?.full_name_ar) ||
    profile.data?.full_name_en ||
    "";

  return (
    <div className="grid gap-8">
      <h1 className="type-display">
        {name ? t("greeting", { name }) : t("greetingPlain")}
      </h1>
      <MembershipCard />
      <div className="grid gap-8 lg:grid-cols-2">
        <Notices />
        <NextEvents />
        <JournalSection />
        <MyProgrammes />
        <VotingEligibility />
        <SixWords />
      </div>
    </div>
  );
};
