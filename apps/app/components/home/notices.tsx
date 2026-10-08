"use client";

import { localized } from "@repo/sal-data";
import { useLocale, useTranslations } from "next-intl";
import { useAnnouncements } from "@/lib/queries";
import { EmptyLine } from "../states";
import { Section } from "./section";

export const Notices = () => {
  const t = useTranslations("nexus.home.notices");
  const ta = useTranslations("nexus.next");
  const locale = useLocale();
  const announcements = useAnnouncements();

  return (
    <Section id="notices" title={t("title")}>
      {announcements.data?.length === 0 ? (
        <EmptyLine action={{ href: "/events", label: ta("browseEvents") }}>
          {t("empty")}
        </EmptyLine>
      ) : null}
      <ul className="grid gap-3">
        {announcements.data?.map((notice) => (
          <li className="grid gap-1 border-rule border-b pb-3" key={notice.id}>
            <h3 className="type-subheading">
              {localized(notice, "title", locale)}
            </h3>
            {localized(notice, "body", locale) ? (
              <p className="type-body">{localized(notice, "body", locale)}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
};
