"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import { Input } from "@repo/design-system/components/ui/input";
import type { Locale } from "@repo/internationalization";
import { formatLongDate } from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { membership, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ErrorState, SectionSpinner } from "../../states";
import { AdminHeading, ConfirmAction, ErrorLine, Field } from "../kit";
import { memberName } from "./directory";

interface Request {
  created_at: string;
  email: string;
  id: string;
  statement: string | null;
  user_id: string;
}

const RequestCard = ({ request, name }: { request: Request; name: string }) => {
  const t = useTranslations("nexus.admin.verification");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const decide = useMutation({
    mutationFn: (approve: boolean) =>
      membership.decideVerification(supabase, request.id, approve, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });

  return (
    <SalCard>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-bold">{name}</p>
        <p className="break-all text-sm" dir="ltr">
          {request.email}
        </p>
      </div>
      <p className="type-caption">
        {t("applied")}: {formatLongDate(request.created_at, locale, true)}
      </p>
      <div>
        <p className="type-kicker">{t("statement")}</p>
        <p className="type-body whitespace-pre-line">
          {request.statement || t("noStatement")}
        </p>
      </div>
      <Field label={t("decisionNote")}>
        {(id) => (
          <Input
            id={id}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            value={note}
          />
        )}
      </Field>
      <div className="flex flex-wrap gap-2">
        <ConfirmAction
          confirmLabel={t("approve")}
          description={t("approveConfirm", { email: request.email })}
          disabled={decide.isPending}
          onConfirm={() => decide.mutate(true)}
          variant="default"
        >
          {t("approve")}
        </ConfirmAction>
        <ConfirmAction
          confirmLabel={t("reject")}
          description={t("rejectConfirm", { email: request.email })}
          disabled={decide.isPending}
          onConfirm={() => decide.mutate(false)}
        >
          {t("reject")}
        </ConfirmAction>
      </div>
      <ErrorLine error={decide.error} />
    </SalCard>
  );
};

export const VerificationQueue = () => {
  const t = useTranslations("nexus.admin.verification");
  const tk = useTranslations("nexus.admin.kit");
  const locale = useLocale();
  const { supabase } = useAuth();
  const requests = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("membership")
          .from("verification_requests")
          .select("id, user_id, email, statement, created_at")
          .eq("status", "pending")
          .order("created_at")
      ) ?? [],
    queryKey: ["admin", "verification"],
  });
  const profiles = useQuery({
    enabled: Boolean(requests.data?.length),
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("core")
          .from("profiles")
          .select("id, full_name_en, full_name_ar")
          .in("id", requests.data?.map((r) => r.user_id) ?? [])
      ) ?? [],
    queryKey: ["admin", "verification", "profiles", requests.data],
  });

  if (requests.isPending) {
    return <SectionSpinner />;
  }
  if (requests.isError) {
    return <ErrorState onRetry={() => requests.refetch()} />;
  }

  return (
    <div className="grid gap-6">
      <AdminHeading
        actions={
          <Link
            className="text-sm underline underline-offset-4"
            href="/admin/members"
          >
            {tk("back")}
          </Link>
        }
        title={t("title")}
      >
        {t("lede")}
      </AdminHeading>
      {requests.data.length === 0 ? (
        <p className="type-body text-text-secondary">{t("empty")}</p>
      ) : (
        <ul className="grid gap-gap">
          {requests.data.map((request) => {
            const profile = profiles.data?.find(
              (p) => p.id === request.user_id
            );
            return (
              <li key={request.id}>
                <RequestCard
                  name={profile ? memberName(profile, locale) : ""}
                  request={request}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
