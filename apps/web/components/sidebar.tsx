import { capitalize } from "@repo/design-system/lib/utils";
import type { Locale } from "@repo/internationalization";
import { formatDate, intlLocale } from "@repo/internationalization/format";
import type { ReactNode } from "react";

interface SidebarProperties {
  readonly date: Date;
  readonly labels: {
    published: string;
    sections: string;
    tags: string;
  };
  readonly locale: Locale;
  readonly readingTime: string;
  readonly tags?: string[];
  readonly toc?: ReactNode;
}

export const Sidebar = ({
  date,
  labels,
  locale,
  readingTime,
  tags,
  toc: Toc,
}: SidebarProperties) => (
  <div className="col-span-4 flex w-72 flex-col items-start gap-8 border-foreground/10 border-s px-6 lg:col-span-2">
    <div className="grid gap-2">
      <p className="text-muted-foreground text-sm">{labels.published}</p>
      <p className="rounded-sm text-foreground text-sm">
        {formatDate(date, locale, "medium")}
      </p>
    </div>
    <div className="grid gap-2">
      <p className="rounded-sm text-foreground text-sm">{readingTime}</p>
    </div>
    {tags ? (
      <div className="grid gap-2">
        <p className="text-muted-foreground text-sm">{labels.tags}</p>
        <p className="rounded-sm text-foreground text-sm">
          {new Intl.ListFormat(intlLocale(locale)).format(tags.map(capitalize))}
        </p>
      </div>
    ) : null}
    {Toc ? (
      <div className="-mx-2">
        <div className="grid gap-2 p-2">
          <p className="text-muted-foreground text-sm">{labels.sections}</p>
          {Toc}
        </div>
      </div>
    ) : null}
  </div>
);
