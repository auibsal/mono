"use client";

import { useTranslations } from "next-intl";
import { useMySixWords } from "@/lib/queries";
import { EmptyLine } from "../states";
import { Section } from "./section";

export const SixWords = () => {
  const t = useTranslations("nexus.home.sixWords");
  const entry = useMySixWords();

  return (
    <Section id="six-words" title={t("title")}>
      <p className="type-caption">{t("description")}</p>
      {entry.data ? (
        <blockquote className="type-heading" lang={entry.data.language}>
          {entry.data.text}
        </blockquote>
      ) : (
        <EmptyLine>{t("empty")}</EmptyLine>
      )}
      {entry.data?.status === "pending" ? (
        <p className="type-caption">{t("pending")}</p>
      ) : null}
    </Section>
  );
};
