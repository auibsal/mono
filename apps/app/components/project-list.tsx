"use client";

import { formatDate } from "@repo/internationalization/format";
import { FolderIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

interface ProjectListProps {
  readonly projects: { created_at: string; id: string; name: string }[];
}

export const ProjectList = ({ projects }: ProjectListProps) => {
  const t = useTranslations("app.dashboard");
  const locale = useLocale();

  return (
    <ul className="grid auto-rows-min gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <li
          className="flex flex-col gap-3 rounded-xl border bg-card p-4"
          key={project.id}
        >
          <FolderIcon className="size-5 text-muted-foreground" />
          <div className="grid gap-1">
            <span className="truncate font-medium">{project.name}</span>
            <span className="text-muted-foreground text-xs">
              {t("createdAt", { date: formatDate(project.created_at, locale) })}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
};
