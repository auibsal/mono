"use client";

import { localized } from "@repo/sal-data";
import { useLocale, useTranslations } from "next-intl";
import { useAnnouncements } from "@/lib/queries";
import { Section } from "./section";

export const Notices = () => {
  const t = useTranslations("nexus.home.notices");
  const locale = useLocale();
  const announcements = useAnnouncements();

  // Notices are occasional: the section appears only when there is one.
  if (!announcements.data?.length) {
    return null;
  }
  return (
    <Section id="notices" title={t("title")}>
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
