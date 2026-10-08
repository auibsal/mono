"use client";

import { useLocale, useTranslations } from "next-intl";
import { useProfile } from "@/lib/queries";
import { CalendarFeed } from "./calendar-feed";
import { JournalSection } from "./journal";
import { MembershipCard } from "./membership-card";
import { NextEvents } from "./next-events";
import { Notices } from "./notices";
import { MyProgrammes } from "./programmes";
import { SixWords } from "./six-words";
import { VotingEligibility } from "./voting";

/** Member home, mobile-first, in the order of the brief (§7). */
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
      <h1 className="type-display">{t("greeting", { name })}</h1>
      <MembershipCard />
      <div className="grid gap-8 lg:grid-cols-2">
        <NextEvents />
        <VotingEligibility />
        <Notices />
        <JournalSection />
        <MyProgrammes />
        <CalendarFeed />
        <SixWords />
      </div>
    </div>
  );
};
