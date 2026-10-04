"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useOrganization } from "@/components/organization-provider";
import { PageHeader } from "@/components/page-header";
import { ProjectList } from "@/components/project-list";
import { ErrorState, SectionSpinner } from "@/components/states";
import { useProjects } from "@/lib/queries";

export const SearchResults = () => {
  const t = useTranslations("app.search");
  const query = useSearchParams().get("q")?.trim() ?? "";
  const { active } = useOrganization();
  const projects = useProjects(active.id, query);

  return (
    <>
      <PageHeader title={t("title")} />
      <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
        {query ? (
          <h2 className="font-semibold text-xl tracking-tight">
            {t("resultsFor", { query })}
          </h2>
        ) : (
          <p className="text-muted-foreground">{t("prompt")}</p>
        )}
        {query && projects.isPending ? <SectionSpinner /> : null}
        {projects.isError ? (
          <ErrorState onRetry={() => projects.refetch()} />
        ) : null}
        {query && projects.data?.length === 0 ? (
          <p className="text-muted-foreground">{t("empty", { query })}</p>
        ) : null}
        {query && projects.data?.length ? (
          <ProjectList projects={projects.data} />
        ) : null}
      </div>
    </>
  );
};
