"use client";

import { useAuth } from "@repo/auth/provider";
import { project } from "@repo/config";
import { formatLongDate } from "@repo/internationalization/format";
import { governance, localized, unwrap } from "@repo/sal-data";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useFlags } from "@/lib/queries";
import { EmptyLine, ErrorState, SectionSpinner } from "../states";
import { Elections } from "./elections";
import { SocietySection } from "./section";

type Lang = "en" | "ar";

const Council = () => {
  const t = useTranslations("nexus.society.council");
  const ta = useTranslations("nexus.next");
  const locale = useLocale() as Lang;
  const { supabase } = useAuth();
  const roster = useQuery({
    queryFn: () => governance.councilRoster(supabase),
    queryKey: ["council-roster"],
  });

  return (
    <SocietySection id="council" lede={t("lede")} title={t("title")}>
      {roster.isPending ? <SectionSpinner /> : null}
      {roster.isError ? <ErrorState onRetry={() => roster.refetch()} /> : null}
      {roster.data?.length === 0 ? (
        <EmptyLine
          action={{
            href: `${project.hosts.web}/${locale}/documents/roles-and-staffing`,
            label: ta("readRoles"),
          }}
        >
          {t("empty")}
        </EmptyLine>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roster.data?.map((seat) => (
          <li
            className="frame grid gap-1 bg-surface p-card-padding"
            key={`${seat.role}-${seat.full_name_en}`}
          >
            <p className="type-kicker">
              {localized(seat, "title", locale) ||
                localized(seat, "role_name", locale)}
            </p>
            <p className="type-subheading">
              {localized(seat, "full_name", locale)}
            </p>
          </li>
        ))}
      </ul>
    </SocietySection>
  );
};

const Minutes = () => {
  const t = useTranslations("nexus.society.minutes");
  const ta = useTranslations("nexus.next");
  const locale = useLocale() as Lang;
  const { supabase } = useAuth();
  const minutes = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("governance")
          .from("minutes")
          .select(
            "id, body, meeting_on, adopted_on, title_en, title_ar, text_en, text_ar"
          )
          .eq("status", "adopted")
          .order("meeting_on", { ascending: false })
          .limit(30)
      ) ?? [],
    queryKey: ["adopted-minutes"],
  });

  return (
    <SocietySection id="minutes" lede={t("lede")} title={t("title")}>
      {minutes.isPending ? <SectionSpinner /> : null}
      {minutes.isError ? (
        <ErrorState onRetry={() => minutes.refetch()} />
      ) : null}
      {minutes.data?.length === 0 ? (
        <EmptyLine
          action={{
            href: `${project.hosts.web}/${locale}/documents`,
            label: ta("readDocuments"),
          }}
        >
          {t("empty")}
        </EmptyLine>
      ) : null}
      <ul className="grid">
        {minutes.data?.map((entry) => (
          <li className="border-rule border-b py-3" key={entry.id}>
            <details>
              <summary className="cursor-pointer">
                <span className="type-subheading">
                  {localized(entry, "title", locale)}
                </span>{" "}
                <span className="type-caption">
                  {t(entry.body === "council" ? "council" : "assembly")} ·{" "}
                  {formatLongDate(entry.meeting_on, locale)}
                </span>
              </summary>
              <div className="type-body mt-3 whitespace-pre-line">
                {localized(entry, "text", locale)}
              </div>
              {entry.adopted_on ? (
                <p className="type-caption mt-2">
                  {t("adoptedOn", {
                    date: formatLongDate(entry.adopted_on, locale),
                  })}
                </p>
              ) : null}
            </details>
          </li>
        ))}
      </ul>
    </SocietySection>
  );
};

const BookOfMembers = () => {
  const t = useTranslations("nexus.society.book");
  const locale = useLocale() as Lang;
  const { supabase } = useAuth();
  const book = useQuery({
    queryFn: async () => {
      // Verified members read each other's names (RLS); six-word entries
      // show only once a moderator has approved them.
      const [people, words] = await Promise.all([
        supabase
          .schema("core")
          .from("profiles")
          .select("id, full_name_en, full_name_ar, verified_at")
          .not("verified_at", "is", null)
          .order("full_name_en"),
        supabase
          .schema("programmes")
          .from("six_words")
          .select("user_id, text, language, show_name")
          .eq("status", "approved"),
      ]);
      const entries = new Map(
        (unwrap(words) ?? [])
          .filter((entry) => entry.show_name)
          .map((entry) => [entry.user_id, entry])
      );
      return (unwrap(people) ?? []).map((person) => ({
        ...person,
        six: entries.get(person.id) ?? null,
      }));
    },
    queryKey: ["book-of-members"],
  });

  return (
    <SocietySection
      id="book"
      lede={
        book.data
          ? t("lede", { count: book.data.length, members: book.data.length })
          : undefined
      }
      title={t("title")}
    >
      {book.isPending ? <SectionSpinner /> : null}
      {book.isError ? <ErrorState onRetry={() => book.refetch()} /> : null}
      <ul className="grid gap-x-8 sm:grid-cols-2">
        {book.data?.map((person) => (
          <li className="border-rule border-b py-3" key={person.id}>
            <p className="type-subheading">
              {localized(person, "full_name", locale)}
            </p>
            {person.six ? (
              <p
                className="type-body text-text-secondary italic"
                lang={person.six.language}
              >
                {person.six.text}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </SocietySection>
  );
};

/** The Society page: who serves, what was decided, and who belongs. */
export const Society = () => {
  const t = useTranslations("nexus.society");
  const flags = useFlags();

  return (
    <div className="grid gap-12">
      <header className="grid gap-2">
        <h1 className="type-display">{t("title")}</h1>
        <p className="type-lede max-w-2xl">{t("lede")}</p>
      </header>
      <Council />
      {flags.data?.elections ? <Elections /> : null}
      <Minutes />
      <BookOfMembers />
    </div>
  );
};
