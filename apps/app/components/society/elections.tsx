"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { formatClock, formatLongDate } from "@repo/internationalization/format";
import { governance, localized, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { EmptyLine, ErrorState, SectionSpinner } from "../states";
import { SocietySection } from "./section";

type Lang = "en" | "ar";

/**
 * Elections (behind the `features.elections` flag): stand during
 * nominations, rank candidates while voting is open, read the results once
 * published. RLS shows only announced elections, approved candidates (and
 * the member's own nomination); cast_ballot enforces eligibility and the
 * one-ballot rule, and keeps the ballot apart from the voter.
 */
const useElections = () => {
  const { supabase, user } = useAuth();
  return useQuery({
    enabled: Boolean(user),
    queryFn: async () => {
      const elections =
        unwrap(
          await supabase
            .schema("governance")
            .from("elections")
            .select(
              "id, title_en, title_ar, status, nominations_open_at, nominations_close_at, voting_opens_at, voting_closes_at, positions(id, title_en, title_ar, sort, candidates(id, user_id, status, statement_en, statement_ar))"
            )
            .neq("status", "draft")
            .order("voting_opens_at", { ascending: false })
            .limit(5)
        ) ?? [];
      const ids = elections.map((e) => e.id);
      const userIds = [
        ...new Set(
          elections.flatMap((e) =>
            e.positions.flatMap((p) => p.candidates.map((c) => c.user_id))
          )
        ),
      ];
      const [voters, receipts, results, people] = await Promise.all([
        supabase
          .schema("governance")
          .from("voters")
          .select("election_id")
          .in("election_id", ids),
        supabase
          .schema("governance")
          .from("ballot_receipts")
          .select("election_id")
          .in("election_id", ids),
        supabase
          .schema("governance")
          .from("election_results")
          .select("election_id, position_id, winner_candidate_id, ron_won")
          .in("election_id", ids),
        userIds.length
          ? supabase
              .schema("core")
              .from("profiles")
              .select("id, full_name_en, full_name_ar")
              .in("id", userIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      return {
        elections: elections.map((e) => ({
          ...e,
          positions: [...e.positions].sort((a, b) => a.sort - b.sort),
        })),
        me: user?.id ?? "",
        names: new Map((unwrap(people) ?? []).map((p) => [p.id, p])),
        results: unwrap(results) ?? [],
        voted: new Set((unwrap(receipts) ?? []).map((r) => r.election_id)),
        voter: new Set((unwrap(voters) ?? []).map((v) => v.election_id)),
      };
    },
    queryKey: ["elections", user?.id ?? ""],
  });
};

type Data = NonNullable<ReturnType<typeof useElections>["data"]>;
type Election = Data["elections"][number];
type Position = Election["positions"][number];

const between = (from: string, to: string) => {
  const now = Date.now();
  return now >= Date.parse(from) && now <= Date.parse(to);
};

const errorKey = (error: unknown) => {
  const code = (error as { code?: string } | null)?.code;
  if (code === "23505") {
    return "already";
  }
  if (code === "42501") {
    return "notEligible";
  }
  if (code === "22023") {
    return "closed";
  }
  return "failed";
};

const Nominate = ({ position }: { readonly position: Position }) => {
  const t = useTranslations("nexus.society.elections");
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const nominate = useMutation({
    mutationFn: async ({ ar, en }: { ar: string; en: string }) =>
      unwrap(
        await supabase.schema("governance").rpc("nominate", {
          position_id: position.id,
          statement_ar: ar || undefined,
          statement_en: en,
        })
      ),
    onError: (error) => setNotice(errorKey(error)),
    onSuccess: () => {
      setNotice("nominated");
      setOpen(false);
      return queryClient.invalidateQueries({ queryKey: ["elections"] });
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    nominate.mutate({
      ar: String(data.get("ar") ?? "").trim(),
      en: String(data.get("en") ?? "").trim(),
    });
  };

  return (
    <div className="grid gap-3">
      {open ? (
        <form className="grid gap-3" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor={`en-${position.id}`}>{t("statementEn")}</Label>
            <Textarea
              id={`en-${position.id}`}
              maxLength={4000}
              name="en"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`ar-${position.id}`}>{t("statementAr")}</Label>
            <Textarea
              dir="rtl"
              id={`ar-${position.id}`}
              lang="ar"
              maxLength={4000}
              name="ar"
            />
          </div>
          <Button
            className="justify-self-start"
            disabled={nominate.isPending}
            type="submit"
          >
            {t("submitNomination")}
          </Button>
        </form>
      ) : (
        <Button
          className="justify-self-start"
          onClick={() => setOpen(true)}
          variant="outline"
        >
          {t("stand")}
        </Button>
      )}
      {notice ? (
        <p
          className="type-body font-bold"
          role={notice === "nominated" ? "status" : "alert"}
        >
          {t(`notice.${notice as "nominated"}`)}
        </p>
      ) : null}
    </div>
  );
};

const Ballot = ({
  data,
  election,
}: {
  readonly data: Data;
  readonly election: Election;
}) => {
  const t = useTranslations("nexus.society.elections");
  const locale = useLocale() as Lang;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const cast = useMutation({
    mutationFn: (ballot: governance.Ballot) =>
      governance.castBallot(supabase, election.id, ballot),
    onError: (error) => setNotice(errorKey(error)),
    onSuccess: () => {
      setNotice("voted");
      return queryClient.invalidateQueries({ queryKey: ["elections"] });
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ballot: governance.Ballot = {};
    for (const position of election.positions) {
      const ranks = form
        .getAll(position.id)
        .map(String)
        .filter((value) => value !== "");
      if (new Set(ranks).size !== ranks.length) {
        setNotice("duplicate");
        return;
      }
      ballot[position.id] = ranks;
    }
    cast.mutate(ballot);
  };

  const name = (userId: string) => {
    const person = data.names.get(userId);
    return person ? localized(person, "full_name", locale) : "";
  };

  return (
    <form className="grid gap-6" onSubmit={submit}>
      <p className="type-body">{t("ballotHelp")}</p>
      {election.positions.map((position) => {
        const candidates = position.candidates.filter(
          (c) => c.status === "approved"
        );
        const options = [
          ...candidates.map((c) => ({ id: c.id, label: name(c.user_id) })),
          ...(candidates.length <= 1
            ? [{ id: governance.RON, label: t("ron") }]
            : []),
        ];
        return (
          <fieldset
            className="frame grid gap-3 p-card-padding"
            key={position.id}
          >
            <legend className="type-subheading px-1">
              {localized(position, "title", locale)}
            </legend>
            {options.map((slot, rank) => (
              <div className="grid gap-1" key={`${position.id}-${slot.id}`}>
                <Label htmlFor={`${position.id}-${rank}`}>
                  {t("rank", { rank: String(rank + 1) })}
                </Label>
                <select
                  className="frame h-10 bg-surface px-3 text-text"
                  defaultValue=""
                  id={`${position.id}-${rank}`}
                  name={position.id}
                >
                  <option value="">{t("noChoice")}</option>
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </fieldset>
        );
      })}
      <Button
        className="justify-self-start"
        disabled={cast.isPending}
        type="submit"
      >
        {t("cast")}
      </Button>
      {notice ? (
        <p
          className="type-body font-bold"
          role={notice === "voted" ? "status" : "alert"}
        >
          {t(`notice.${notice as "voted"}`)}
        </p>
      ) : null}
    </form>
  );
};

const ElectionCard = ({
  data,
  election,
}: {
  readonly data: Data;
  readonly election: Election;
}) => {
  const t = useTranslations("nexus.society.elections");
  const locale = useLocale() as Lang;
  const nominating = between(
    election.nominations_open_at,
    election.nominations_close_at
  );
  const voting =
    election.status === "voting" &&
    between(election.voting_opens_at, election.voting_closes_at);
  const name = (userId: string) => {
    const person = data.names.get(userId);
    return person ? localized(person, "full_name", locale) : "";
  };
  const when = (iso: string) =>
    `${formatLongDate(iso, locale)} · ${formatClock(iso, locale)}`;

  return (
    <article className="frame grid gap-4 bg-surface p-card-padding shadow-offset">
      <header className="grid gap-1">
        <p className="type-kicker">
          {t(`status.${election.status as "voting"}`)}
        </p>
        <h3 className="type-heading">{localized(election, "title", locale)}</h3>
        <p className="type-caption">
          {t("dates", {
            nominations: when(election.nominations_close_at),
            voting: when(election.voting_closes_at),
          })}
        </p>
      </header>

      {voting && data.voted.has(election.id) ? (
        <p className="type-body font-bold">{t("youVoted")}</p>
      ) : null}
      {voting && !data.voted.has(election.id) && data.voter.has(election.id) ? (
        <Ballot data={data} election={election} />
      ) : null}
      {voting && !data.voter.has(election.id) ? (
        <p className="type-body">{t("notEligible")}</p>
      ) : null}

      {election.status !== "voting" && election.status !== "published"
        ? election.positions.map((position) => {
            const mine = position.candidates.find((c) => c.user_id === data.me);
            const approved = position.candidates.filter(
              (c) => c.status === "approved"
            );
            return (
              <section
                className="grid gap-2 border-rule border-t pt-3"
                key={position.id}
              >
                <h4 className="type-subheading">
                  {localized(position, "title", locale)}
                </h4>
                {approved.length === 0 ? (
                  <p className="type-caption">{t("noCandidates")}</p>
                ) : (
                  <ul className="grid gap-2">
                    {approved.map((c) => (
                      <li key={c.id}>
                        <p className="font-bold">{name(c.user_id)}</p>
                        <p className="type-body text-text-secondary">
                          {localized(c, "statement", locale)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                {mine ? (
                  <p className="type-caption">
                    {t(`yourNomination.${mine.status as "nominated"}`)}
                  </p>
                ) : null}
                {nominating && !mine ? <Nominate position={position} /> : null}
              </section>
            );
          })
        : null}

      {election.status === "published" ? (
        <ul className="grid gap-2">
          {election.positions.map((position) => {
            const result = data.results.find(
              (r) => r.position_id === position.id
            );
            const winner = position.candidates.find(
              (c) => c.id === result?.winner_candidate_id
            );
            let outcome = t("pending");
            if (result?.ron_won) {
              outcome = t("ronWon");
            } else if (winner) {
              outcome = name(winner.user_id);
            }
            return (
              <li className="border-rule border-b py-2" key={position.id}>
                <span className="type-caption">
                  {localized(position, "title", locale)}
                </span>
                <p className="type-subheading">{outcome}</p>
              </li>
            );
          })}
        </ul>
      ) : null}
    </article>
  );
};

export const Elections = () => {
  const t = useTranslations("nexus.society.elections");
  const elections = useElections();

  return (
    <SocietySection id="elections" lede={t("lede")} title={t("title")}>
      {elections.isPending ? <SectionSpinner /> : null}
      {elections.isError ? (
        <ErrorState onRetry={() => elections.refetch()} />
      ) : null}
      {elections.data?.elections.length === 0 ? (
        <EmptyLine>{t("empty")}</EmptyLine>
      ) : null}
      {elections.data?.elections.map((election) => (
        <ElectionCard
          data={elections.data}
          election={election}
          key={election.id}
        />
      ))}
    </SocietySection>
  );
};
