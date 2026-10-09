"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { formatClock, formatLongDate } from "@repo/internationalization/format";
import { localized, productions, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { EmptyLine, ErrorState, SectionSpinner } from "../states";

const KEY = ["productions"];

type Stage = productions.ProductionStage;
type Kind = productions.ProductionKind;
type SignupStatus = productions.AuditionStatus;
type Notice = "signedUp" | "full" | "closed" | "notVerified" | "failed";

const noticeFor = (error: unknown): Notice => {
  const code = (error as { code?: string } | null)?.code;
  if (code === "42501") {
    return "notVerified";
  }
  if (code === "23514") {
    return "full";
  }
  if (code === "22023") {
    return "closed";
  }
  return "failed";
};

const useProductionsData = () => {
  const { supabase, user } = useAuth();
  return useQuery({
    enabled: Boolean(user),
    queryFn: async () => {
      const [list, auditions, signups, credits, rehearsals] = await Promise.all(
        [
          productions.memberProductions(supabase),
          supabase
            .schema("programmes")
            .from("auditions")
            .select(
              "id, production_id, starts_at, ends_at, location_en, location_ar, prepare_en, prepare_ar"
            )
            .gte("starts_at", new Date().toISOString())
            .order("starts_at"),
          supabase
            .schema("programmes")
            .from("audition_signups")
            .select("audition_id, status, interest")
            .eq("user_id", user?.id ?? ""),
          supabase
            .schema("programmes")
            .from("production_credits")
            .select(
              "id, production_id, department, role_en, role_ar, show_publicly, productions(title_en, title_ar, stage)"
            )
            .eq("user_id", user?.id ?? ""),
          supabase
            .schema("programmes")
            .from("rehearsals")
            .select(
              "id, production_id, starts_at, ends_at, location_en, location_ar, called"
            )
            .gte("ends_at", new Date().toISOString())
            .order("starts_at"),
        ]
      );
      return {
        auditions: unwrap(auditions) ?? [],
        credits: unwrap(credits) ?? [],
        list,
        rehearsals: unwrap(rehearsals) ?? [],
        signups: unwrap(signups) ?? [],
      };
    },
    queryKey: [...KEY, user?.id],
  });
};

/**
 * Productions in the Nexus: auditions open to members, and for the
 * company (cast, crew, creative team) their credits and rehearsals.
 */
export const Productions = () => {
  const t = useTranslations("nexus.productions");
  const locale = useLocale();
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const data = useProductionsData();
  const [notice, setNotice] = useState<{ id: string; key: Notice } | null>(
    null
  );
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });

  const signUp = useMutation({
    mutationFn: (input: { id: string; interest: string }) =>
      productions.signUpForAudition(supabase, input.id, input.interest),
    onError: (error, input) =>
      setNotice({ id: input.id, key: noticeFor(error) }),
    onSuccess: async (_r, input) => {
      setNotice({ id: input.id, key: "signedUp" });
      await refresh();
    },
  });
  const cancel = useMutation({
    mutationFn: (id: string) => productions.cancelAudition(supabase, id),
    onSuccess: refresh,
  });
  const visibility = useMutation({
    mutationFn: (input: { id: string; visible: boolean }) =>
      productions.setCreditVisibility(supabase, input.id, input.visible),
    onSuccess: refresh,
  });

  if (data.isPending) {
    return <SectionSpinner />;
  }
  if (data.isError) {
    return <ErrorState onRetry={() => data.refetch()} />;
  }

  const { auditions, credits, list, rehearsals, signups } = data.data;
  const auditioning = list.filter((p) => p.stage === "auditions");
  const signupFor = (id: string) => signups.find((s) => s.audition_id === id);
  const titleOf = (id: string) => {
    const row = list.find((p) => p.id === id);
    if (row) {
      return localized(row, "title", locale);
    }
    const credit = credits.find((c) => c.production_id === id);
    return credit?.productions
      ? localized(credit.productions, "title", locale)
      : "";
  };

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-8">
      <header className="grid gap-2">
        <h1 className="type-display">{t("title")}</h1>
        <p className="type-lede max-w-2xl">{t("lede")}</p>
      </header>

      {credits.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="type-subheading">{t("companyTitle")}</h2>
          <ul className="grid gap-3">
            {credits.map((c) => (
              <li key={c.id}>
                <SalCard>
                  <div className="grid gap-2">
                    <p className="type-kicker">
                      {t(
                        `departments.${c.department as productions.Department}`
                      )}
                    </p>
                    <p className="font-bold" dir="auto">
                      {localized(c, "role", locale)} ·{" "}
                      {titleOf(c.production_id)}
                    </p>
                    {c.productions ? (
                      <p className="type-caption">
                        {t(`stages.${c.productions.stage as Stage}`)}
                      </p>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={c.show_publicly}
                        disabled={visibility.isPending}
                        id={`show-${c.id}`}
                        onCheckedChange={(checked) =>
                          visibility.mutate({
                            id: c.id,
                            visible: checked === true,
                          })
                        }
                      />
                      <Label htmlFor={`show-${c.id}`}>{t("showName")}</Label>
                    </div>
                  </div>
                </SalCard>
              </li>
            ))}
          </ul>
          <h3 className="type-subheading">{t("rehearsalsTitle")}</h3>
          {rehearsals.length === 0 ? (
            <p className="type-body text-text-secondary">{t("noRehearsals")}</p>
          ) : (
            <ul className="grid gap-2">
              {rehearsals.map((r) => {
                const where = localized(r, "location", locale);
                return (
                  <li className="border-rule border-b pb-2" key={r.id}>
                    <p className="font-medium">
                      {titleOf(r.production_id)} ·{" "}
                      {formatLongDate(r.starts_at, locale)} ·{" "}
                      {formatClock(r.starts_at, locale)}–
                      {formatClock(r.ends_at, locale)}
                    </p>
                    <p className="type-caption" dir="auto">
                      {[where, r.called].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      <section className="grid gap-3">
        <h2 className="type-subheading">{t("auditionsTitle")}</h2>
        {auditioning.length === 0 ? (
          <EmptyLine action={{ href: "/programs", label: t("findShift") }}>
            {t("noAuditions")}
          </EmptyLine>
        ) : null}
        {auditioning.map((p) => (
          <SalCard key={p.id}>
            <div className="grid gap-3">
              <p className="type-kicker">{t(`kinds.${p.kind as Kind}`)}</p>
              <h3 className="type-heading">{localized(p, "title", locale)}</h3>
              {p.playwright ? (
                <p className="type-caption" dir="auto">
                  {t("by", { name: p.playwright })}
                </p>
              ) : null}
              {localized(p, "summary", locale) ? (
                <p className="type-body" dir="auto">
                  {localized(p, "summary", locale)}
                </p>
              ) : null}
              <ul className="grid gap-3">
                {auditions
                  .filter((a) => a.production_id === p.id)
                  .map((a) => (
                    <AuditionSlot
                      audition={a}
                      busy={signUp.isPending || cancel.isPending}
                      key={a.id}
                      notice={notice?.id === a.id ? notice.key : null}
                      onCancel={() => cancel.mutate(a.id)}
                      onSignUp={(interest) =>
                        signUp.mutate({ id: a.id, interest })
                      }
                      status={
                        signupFor(a.id)?.status as SignupStatus | undefined
                      }
                    />
                  ))}
              </ul>
            </div>
          </SalCard>
        ))}
      </section>
    </div>
  );
};

interface SlotProps {
  readonly audition: {
    ends_at: string;
    id: string;
    location_ar: string | null;
    location_en: string | null;
    prepare_ar: string | null;
    prepare_en: string | null;
    starts_at: string;
  };
  readonly busy: boolean;
  readonly notice: Notice | null;
  readonly onCancel: () => void;
  readonly onSignUp: (interest: string) => void;
  readonly status: SignupStatus | undefined;
}

const AuditionSlot = ({
  audition,
  busy,
  notice,
  onCancel,
  onSignUp,
  status,
}: SlotProps) => {
  const t = useTranslations("nexus.productions");
  const locale = useLocale();
  const id = useId();
  const [interest, setInterest] = useState("");
  const where = localized(audition, "location", locale);
  const prepare = localized(audition, "prepare", locale);
  const active = status && status !== "cancelled";

  return (
    <li className="grid gap-2 border-rule border-t pt-3">
      <p className="font-medium">
        {formatLongDate(audition.starts_at, locale)} ·{" "}
        {formatClock(audition.starts_at, locale)}–
        {formatClock(audition.ends_at, locale)}
        {where ? ` · ${where}` : ""}
      </p>
      {prepare ? (
        <p className="type-caption" dir="auto">
          {t("prepare", { what: prepare })}
        </p>
      ) : null}
      {active ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="type-body font-bold">{t(`statuses.${status}`)}</p>
          {status === "signed_up" ? (
            <Button
              disabled={busy}
              onClick={onCancel}
              size="sm"
              variant="ghost"
            >
              {t("cancel")}
            </Button>
          ) : null}
        </div>
      ) : (
        <form
          className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            onSignUp(interest);
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor={`${id}-interest`}>{t("interest")}</Label>
            <Input
              dir="auto"
              id={`${id}-interest`}
              maxLength={500}
              onChange={(e) => setInterest(e.target.value)}
              value={interest}
            />
          </div>
          <Button disabled={busy} type="submit">
            {t("signUp")}
          </Button>
        </form>
      )}
      {notice ? (
        <p
          className="type-body font-bold"
          role={notice === "signedUp" ? "status" : "alert"}
        >
          {t(`notice.${notice}`)}
        </p>
      ) : null}
    </li>
  );
};
