"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import { Button } from "@repo/design-system/components/ui/button";
import type { Locale } from "@repo/internationalization";
import {
  formatDateTime,
  formatNumber,
} from "@repo/internationalization/format";
import { governance, localized, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useFlags } from "@/lib/queries";
import { SectionSpinner } from "../../states";
import {
  BilingualField,
  ConfirmAction,
  DateTimeField,
  ErrorLine,
  SaveButton,
} from "../kit";
import { useMemberNames } from "../member-picker";
import { memberName } from "../members/directory";

const key = ["admin", "governance", "elections"];
const EXECUTIVE_ROLES = [
  "president",
  "vice_president",
  "general_secretary",
  "treasurer",
] as const;

type ElectionStatus =
  | "draft"
  | "nominations"
  | "review"
  | "voting"
  | "closed"
  | "published";
type CandidateStatus = "nominated" | "approved" | "rejected" | "withdrawn";

interface Round {
  eliminated?: string | null;
  exhausted?: number;
  round: number;
  tallies: Record<string, number>;
}

const useElection = (electionId: string) => {
  const { supabase } = useAuth();
  return useQuery({
    queryFn: async () => {
      const [positions, results, turnout] = await Promise.all([
        supabase
          .schema("governance")
          .from("positions")
          .select("*")
          .eq("election_id", electionId)
          .order("sort"),
        supabase
          .schema("governance")
          .from("election_results")
          .select("*")
          .eq("election_id", electionId),
        supabase
          .schema("governance")
          .rpc("turnout", { election_id: electionId }),
      ]);
      const positionRows = unwrap(positions) ?? [];
      const candidates = positionRows.length
        ? (unwrap(
            await supabase
              .schema("governance")
              .from("candidates")
              .select("*")
              .in(
                "position_id",
                positionRows.map((p) => p.id)
              )
          ) ?? [])
        : [];
      return {
        candidates,
        positions: positionRows,
        results: unwrap(results) ?? [],
        turnout: (turnout.data ?? [])[0] ?? null,
      };
    },
    queryKey: [...key, electionId],
  });
};

const ElectionCard = ({
  election,
}: {
  election: {
    id: string;
    status: string;
    title_ar: string;
    title_en: string;
    voting_closes_at: string;
    voting_opens_at: string;
    nominations_open_at: string;
    nominations_close_at: string;
  };
}) => {
  const t = useTranslations("nexus.admin.governance.elections");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const data = useElection(election.id);
  const names = useMemberNames(
    data.data?.candidates.map((c) => c.user_id) ?? []
  );
  const { data: roles } = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("access")
          .from("roles")
          .select("key, name_en, name_ar")
          .in("key", [...EXECUTIVE_ROLES])
      ) ?? [],
    queryKey: ["admin", "executive-roles"],
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });
  const status = election.status as ElectionStatus;

  const setStatus = useMutation({
    mutationFn: async (next: ElectionStatus) =>
      unwrap(
        await supabase
          .schema("governance")
          .from("elections")
          .update({ status: next })
          .eq("id", election.id)
      ),
    onSuccess: invalidate,
  });
  const openVoting = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase
          .schema("governance")
          .rpc("open_voting", { election_id: election.id })
      ),
    onSuccess: invalidate,
  });
  const count = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase
          .schema("governance")
          .rpc("count_election", { election_id: election.id })
      ),
    onSuccess: invalidate,
  });
  const decide = useMutation({
    mutationFn: async ({ approve, id }: { approve: boolean; id: string }) =>
      unwrap(
        await supabase
          .schema("governance")
          .rpc("decide_candidate", { approve, candidate_id: id })
      ),
    onSuccess: invalidate,
  });
  const addPositions = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase
          .schema("governance")
          .from("positions")
          .insert(
            EXECUTIVE_ROLES.map((role, index) => {
              const r = roles?.find((x) => x.key === role);
              return {
                election_id: election.id,
                role_key: role,
                sort: index,
                title_ar: r?.name_ar ?? role,
                title_en: r?.name_en ?? role,
              };
            })
          )
      ),
    onSuccess: invalidate,
  });

  const candidateName = (candidateId: string) => {
    if (candidateId === governance.RON) {
      return t("ron");
    }
    const candidate = data.data?.candidates.find((c) => c.id === candidateId);
    const person = names.data?.find((n) => n.id === candidate?.user_id);
    return person ? memberName(person, locale) : "—";
  };

  return (
    <SalCard>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="type-subheading">
          {localized(election, "title", locale)}
        </h3>
        <p className="font-bold text-title">{t(`statuses.${status}`)}</p>
      </div>
      <p className="type-caption">
        {t("nominationsOpen")}:{" "}
        {formatDateTime(election.nominations_open_at, locale)} ·{" "}
        {t("votingOpens")}: {formatDateTime(election.voting_opens_at, locale)} ·{" "}
        {t("votingCloses")}: {formatDateTime(election.voting_closes_at, locale)}
      </p>
      {data.data?.turnout ? (
        <p className="font-medium">
          {t("turnout", {
            eligible: formatNumber(data.data.turnout.eligible),
            voted: formatNumber(data.data.turnout.voted),
          })}
        </p>
      ) : null}

      {data.isPending ? <SectionSpinner /> : null}
      <section className="grid gap-3">
        <h4 className="font-bold text-sm">{t("positions")}</h4>
        {data.data && data.data.positions.length === 0 && status === "draft" ? (
          <Button
            className="justify-self-start"
            disabled={addPositions.isPending}
            onClick={() => addPositions.mutate()}
            size="sm"
            variant="outline"
          >
            {t("addPositions")}
          </Button>
        ) : null}
        {data.data?.positions.map((position) => {
          const candidates = data.data.candidates.filter(
            (c) => c.position_id === position.id
          );
          const result = data.data.results.find(
            (r) => r.position_id === position.id
          );
          const rounds = (result?.rounds ?? []) as unknown as Round[];
          return (
            <div
              className="grid gap-2 border-rule border-b pb-3"
              key={position.id}
            >
              <p className="font-bold">
                {localized(position, "title", locale)}
              </p>
              {candidates.length === 0 ? (
                <p className="type-caption">{t("noCandidates")}</p>
              ) : null}
              <ul className="grid gap-2">
                {candidates.map((c) => (
                  <li className="grid gap-1" key={c.id}>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-medium">{candidateName(c.id)}</span>
                      <span className="type-caption">
                        {t(`candidateStatuses.${c.status as CandidateStatus}`)}
                      </span>
                      {status === "nominations" || status === "review" ? (
                        <>
                          <Button
                            disabled={decide.isPending}
                            onClick={() =>
                              decide.mutate({ approve: true, id: c.id })
                            }
                            size="sm"
                            variant="ghost"
                          >
                            {t("approveCandidate")}
                          </Button>
                          <Button
                            disabled={decide.isPending}
                            onClick={() =>
                              decide.mutate({ approve: false, id: c.id })
                            }
                            size="sm"
                            variant="ghost"
                          >
                            {t("rejectCandidate")}
                          </Button>
                        </>
                      ) : null}
                    </div>
                    {c.statement_en || c.statement_ar ? (
                      <p className="type-caption whitespace-pre-line">
                        {localized(c, "statement", locale)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
              {result ? (
                <div className="grid gap-2">
                  <p className="font-bold text-title">
                    {result.ron_won
                      ? t("ronWon")
                      : t("winner", {
                          name: result.winner_candidate_id
                            ? candidateName(result.winner_candidate_id)
                            : "—",
                        })}
                  </p>
                  <ol className="grid gap-1">
                    {rounds.map((round) => (
                      <li className="type-caption" key={round.round}>
                        {t("round", { number: formatNumber(round.round) })}:{" "}
                        {Object.entries(round.tallies)
                          .map(
                            ([id, votes]) =>
                              `${candidateName(id)} ${formatNumber(votes)}`
                          )
                          .join(" · ")}
                        {round.exhausted
                          ? ` · ${t("exhausted", { count: formatNumber(round.exhausted) })}`
                          : ""}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      <div className="flex flex-wrap gap-3">
        {status === "draft" ? (
          <Button
            disabled={setStatus.isPending}
            onClick={() => setStatus.mutate("nominations")}
            size="sm"
          >
            {t("openNominations")}
          </Button>
        ) : null}
        {status === "nominations" ? (
          <Button
            disabled={setStatus.isPending}
            onClick={() => setStatus.mutate("review")}
            size="sm"
            variant="outline"
          >
            {t("startReview")}
          </Button>
        ) : null}
        {status === "nominations" || status === "review" ? (
          <ConfirmAction
            confirmLabel={t("openVoting")}
            description={t("openVotingConfirm")}
            disabled={openVoting.isPending}
            onConfirm={() => openVoting.mutate()}
            variant="default"
          >
            {t("openVoting")}
          </ConfirmAction>
        ) : null}
        {status === "voting" ? (
          <ConfirmAction
            confirmLabel={t("count")}
            description={t("countConfirm")}
            disabled={count.isPending}
            onConfirm={() => count.mutate()}
            variant="default"
          >
            {t("count")}
          </ConfirmAction>
        ) : null}
        {status === "closed" ? (
          <ConfirmAction
            confirmLabel={t("publish")}
            description={t("publishConfirm")}
            disabled={setStatus.isPending}
            onConfirm={() => setStatus.mutate("published")}
            variant="default"
          >
            {t("publish")}
          </ConfirmAction>
        ) : null}
      </div>
      <ErrorLine
        error={
          setStatus.error ??
          openVoting.error ??
          count.error ??
          decide.error ??
          addPositions.error
        }
      />
    </SalCard>
  );
};

export const Elections = () => {
  const t = useTranslations("nexus.admin.governance.elections");
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const flags = useFlags();
  const [form, setForm] = useState({
    nominations_close_at: null as string | null,
    nominations_open_at: null as string | null,
    title: { ar: "", en: "" },
    voting_closes_at: null as string | null,
    voting_opens_at: null as string | null,
  });
  const [problem, setProblem] = useState<string | null>(null);
  const elections = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("governance")
          .from("elections")
          .select("*")
          .order("voting_opens_at", { ascending: false })
      ) ?? [],
    queryKey: key,
  });
  const create = useMutation({
    mutationFn: async () => {
      const times = [
        form.nominations_open_at,
        form.nominations_close_at,
        form.voting_opens_at,
        form.voting_closes_at,
      ];
      const [no, nc, vo, vc] = times.map((v) =>
        v ? new Date(v).getTime() : Number.NaN
      );
      if (!(nc > no && vo >= nc && vc > vo)) {
        setProblem(t("dateError"));
        throw new Error("invalid");
      }
      setProblem(null);
      unwrap(
        await supabase
          .schema("governance")
          .from("elections")
          .insert({
            nominations_close_at: form.nominations_close_at ?? "",
            nominations_open_at: form.nominations_open_at ?? "",
            title_ar: form.title.ar,
            title_en: form.title.en,
            voting_closes_at: form.voting_closes_at ?? "",
            voting_opens_at: form.voting_opens_at ?? "",
          })
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return (
    <div className="grid gap-6">
      {flags.data && !flags.data.elections ? (
        <p className="type-body rounded-card bg-surface-tint p-card-padding">
          {t("flagOff")}
        </p>
      ) : null}
      {elections.isPending ? <SectionSpinner /> : null}
      {elections.data?.map((election) => (
        <ElectionCard election={election} key={election.id} />
      ))}
      <form
        className="grid max-w-3xl gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <h3 className="type-subheading">{t("new")}</h3>
        <BilingualField
          label={t("titleField")}
          maxLength={200}
          onChange={(title) => setForm((f) => ({ ...f, title }))}
          required
          value={form.title}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <DateTimeField
            label={t("nominationsOpen")}
            onChange={(v) => setForm((f) => ({ ...f, nominations_open_at: v }))}
            required
            value={form.nominations_open_at}
          />
          <DateTimeField
            label={t("nominationsClose")}
            onChange={(v) =>
              setForm((f) => ({ ...f, nominations_close_at: v }))
            }
            required
            value={form.nominations_close_at}
          />
          <DateTimeField
            label={t("votingOpens")}
            onChange={(v) => setForm((f) => ({ ...f, voting_opens_at: v }))}
            required
            value={form.voting_opens_at}
          />
          <DateTimeField
            label={t("votingCloses")}
            onChange={(v) => setForm((f) => ({ ...f, voting_closes_at: v }))}
            required
            value={form.voting_closes_at}
          />
        </div>
        {problem ? (
          <p className="text-sm text-title" role="alert">
            {problem}
          </p>
        ) : null}
        <SaveButton pending={create.isPending} />
        {create.error && create.error.message !== "invalid" ? (
          <ErrorLine error={create.error} />
        ) : null}
      </form>
    </div>
  );
};
