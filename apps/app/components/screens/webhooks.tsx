"use client";

import { useAuth } from "@repo/auth/provider";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useOrganization } from "@/components/organization-provider";
import { PageHeader } from "@/components/page-header";
import { ErrorState, SectionSpinner } from "@/components/states";
import { callApi } from "@/lib/api";

/** The organization's webhook settings (Svix portal, link from apps/api). */
export const Webhooks = () => {
  const t = useTranslations("app");
  const { supabase } = useAuth();
  const { active, canManage } = useOrganization();
  const portal = useQuery({
    enabled: canManage,
    // Portal links are single-use; fetch a fresh one each visit.
    gcTime: 0,
    queryFn: () =>
      callApi<{ url: string }>(supabase, "/webhooks/portal", {
        organizationId: active.id,
      }),
    queryKey: ["webhooks-portal", active.id],
    staleTime: 0,
  });

  return (
    <>
      <PageHeader title={t("nav.webhooks")} />
      <div className="flex flex-1 flex-col p-4 pt-0">
        {canManage ? null : (
          <p className="text-muted-foreground">
            {t("settings.organization.description")}
          </p>
        )}
        {portal.isPending && canManage ? <SectionSpinner /> : null}
        {portal.isError ? (
          <ErrorState onRetry={() => portal.refetch()} />
        ) : null}
        {portal.data ? (
          <iframe
            allow="clipboard-write"
            className="h-full min-h-[70vh] w-full rounded-lg border"
            src={portal.data.url}
            title={t("nav.webhooks")}
          />
        ) : null}
      </div>
    </>
  );
};
