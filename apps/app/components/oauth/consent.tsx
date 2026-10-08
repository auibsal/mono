"use client";

import { useAuth } from "@repo/auth/provider";
import { project } from "@repo/config";
import { FormHeader } from "@repo/design-system/components/sal/form-header";
import { Button } from "@repo/design-system/components/ui/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { ErrorState, SectionSpinner } from "../states";

const AREAS = [
  "profile",
  "journal",
  "events",
  "programmes",
  "content",
] as const;
type Area = (typeof AREAS)[number];

/**
 * The consent screen for "Sign in with SAL" (Supabase OAuth 2.1 server).
 * Supabase Auth sends the member here with an authorization id; they allow
 * or refuse, and Supabase sends them back to the app. What the app may
 * reach is decided by the Society (access.oauth_clients), not by the app,
 * and enforced in the database.
 */
export const OAuthConsent = () => {
  const t = useTranslations("nexus.oauth");
  const locale = useLocale();
  const { supabase, user } = useAuth();
  const authorizationId = useSearchParams().get("authorization_id") ?? "";

  const details = useQuery({
    enabled: Boolean(authorizationId),
    queryFn: async () => {
      const { data, error } =
        await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (error) {
        throw error;
      }
      if (!("authorization_id" in data)) {
        // Allowed before: Supabase answers with the way back straight away.
        return { kind: "redirect" as const, url: data.redirect_url };
      }
      const { data: approved } = await supabase
        .schema("access")
        .rpc("oauth_client_info", { client_id: data.client.id });
      return {
        approved: approved?.[0] ?? null,
        kind: "ask" as const,
        request: data,
      };
    },
    queryKey: ["oauth-consent", authorizationId],
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const redirect = details.data?.kind === "redirect" ? details.data.url : null;
  useEffect(() => {
    if (redirect) {
      window.location.assign(redirect);
    }
  }, [redirect]);

  const decide = useMutation({
    mutationFn: async (allow: boolean) => {
      const options = { skipBrowserRedirect: true };
      const { data, error } = allow
        ? await supabase.auth.oauth.approveAuthorization(
            authorizationId,
            options
          )
        : await supabase.auth.oauth.denyAuthorization(authorizationId, options);
      if (error) {
        throw error;
      }
      return data.redirect_url;
    },
    onSuccess: (url) => window.location.assign(url),
  });

  if (!authorizationId || details.isError) {
    return (
      <div className="grid gap-4">
        <FormHeader title={t("title")} />
        <p className="type-body" role="alert">
          {t("invalid")}
        </p>
      </div>
    );
  }
  if (details.isPending || redirect || decide.isSuccess) {
    return <SectionSpinner />;
  }
  if (details.data.kind !== "ask") {
    return <ErrorState onRetry={() => details.refetch()} />;
  }

  const { approved, request } = details.data;
  const app = request.client.name || t("title");
  const usable = Boolean(approved?.enabled);
  const areas = AREAS.filter((a: Area) => approved?.areas.includes(a));

  return (
    <div className="grid gap-5">
      <FormHeader title={t("title")} />
      <p className="type-body">{t("intro", { app })}</p>
      <p className="type-caption" dir="auto">
        {t("account", { email: user?.email ?? request.user.email })}
      </p>
      {usable ? (
        <>
          <div className="grid gap-2">
            <p className="type-body">{t("canTitle", { app })}</p>
            <ul className="type-body grid list-disc gap-1 ps-5">
              <li>{t("always")}</li>
              {areas.map((area) => (
                <li key={area}>{t(`areas.${area}`)}</li>
              ))}
            </ul>
          </div>
          <p className="type-caption">{t("never")}</p>
          <p className="type-caption">{t("disconnectLater")}</p>
        </>
      ) : (
        <p className="type-body" role="alert">
          {t("notApproved", {
            app,
            email: project.supportEmail ?? project.domain,
          })}
        </p>
      )}
      {decide.isError ? (
        <p className="text-title" role="alert">
          {t("failed")}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3" lang={locale}>
        {usable ? (
          <Button
            disabled={decide.isPending}
            onClick={() => decide.mutate(true)}
          >
            {decide.isPending ? t("working") : t("allow")}
          </Button>
        ) : null}
        <Button
          disabled={decide.isPending}
          onClick={() => decide.mutate(false)}
          variant="outline"
        >
          {t("deny")}
        </Button>
      </div>
    </div>
  );
};
