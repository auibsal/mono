"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import type { Locale } from "@repo/internationalization";
import {
  formatClock,
  formatDateTime,
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import { localized, programmes, recognition, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { SectionSpinner } from "../../states";
import { useProgrammeOptions } from "../events/data";
import { slugify } from "../events/editor";
import {
  AdminHeading,
  BilingualField,
  ConfirmAction,
  DateTimeField,
  ErrorLine,
  Field,
  SaveButton,
  SelectInput,
} from "../kit";
import { useMemberNames } from "../member-picker";
import { memberName } from "../members/directory";

const invalidateKey = ["admin", "programmes-module"];

// ── Episodes ────────────────────────────────────────────────────────────────

interface EpisodeForm {
  id: string | null;
  number: string;
  season: string;
  segment: string;
  slug: string;
  summary: { ar: string; en: string };
  title: { ar: string; en: string };
  youtube: string;
}

const blankEpisode: EpisodeForm = {
  id: null,
  number: "",
  season: "",
  segment: "",
  slug: "",
  summary: { ar: "", en: "" },
  title: { ar: "", en: "" },
  youtube: "",
};

const Episodes = ({ programmeId }: { programmeId: string }) => {
  const t = useTranslations("nexus.admin.programmes.episodes");
  const tk = useTranslations("nexus.admin.kit");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EpisodeForm>(blankEpisode);
  const [problem, setProblem] = useState<string | null>(null);
  const episodes = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("episodes")
          .select("*")
          .eq("programme_id", programmeId)
          .order("season", { ascending: false, nullsFirst: false })
          .order("number", { ascending: false, nullsFirst: false })
      ) ?? [],
    queryKey: [...invalidateKey, "episodes", programmeId],
  });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: invalidateKey });

  const save = useMutation({
    mutationFn: async () => {
      const id = programmes.youtubeId(form.youtube);
      if (!id) {
        setProblem(t("youtubeError"));
        throw new Error("invalid");
      }
      setProblem(null);
      const row = {
        number: form.number ? Number(form.number) : null,
        programme_id: programmeId,
        season: form.season ? Number(form.season) : null,
        segment: form.segment.trim() || null,
        slug: form.slug || slugify(form.title.en),
        summary_ar: form.summary.ar || null,
        summary_en: form.summary.en || null,
        title_ar: form.title.ar,
        title_en: form.title.en,
        youtube_id: id,
      };
      const table = supabase.schema("programmes").from("episodes");
      unwrap(
        form.id
          ? await table.update(row).eq("id", form.id)
          : await table.insert(row)
      );
    },
    onSuccess: async () => {
      setForm(blankEpisode);
      await invalidate();
    },
  });
  const publish = useMutation({
    mutationFn: async (episode: { id: string; published_at: string | null }) =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("episodes")
          .update({
            published_at: episode.published_at
              ? null
              : new Date().toISOString(),
          })
          .eq("id", episode.id)
      ),
    onSuccess: invalidate,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  return (
    <div className="grid gap-6">
      <ul className="grid gap-3">
        {episodes.data?.map((e) => (
          <li
            className="flex flex-wrap items-center justify-between gap-3 border-rule border-b pb-3"
            key={e.id}
          >
            <div>
              <p className="font-bold">
                {e.season && e.number ? `${e.season}.${e.number} · ` : ""}
                {localized(e, "title", locale)}
              </p>
              <p className="type-caption">
                {e.segment ? `${e.segment} · ` : ""}
                {e.published_at ? t("published") : t("draft")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  setForm({
                    id: e.id,
                    number: e.number ? String(e.number) : "",
                    season: e.season ? String(e.season) : "",
                    segment: e.segment ?? "",
                    slug: e.slug,
                    summary: { ar: e.summary_ar ?? "", en: e.summary_en ?? "" },
                    title: { ar: e.title_ar, en: e.title_en },
                    youtube: e.youtube_id,
                  })
                }
                size="sm"
                variant="ghost"
              >
                {tk("edit")}
              </Button>
              <ConfirmAction
                confirmLabel={e.published_at ? t("unpublish") : t("publish")}
                description={
                  e.published_at ? localized(e, "title", locale) : t("careNote")
                }
                disabled={publish.isPending}
                onConfirm={() => publish.mutate(e)}
                variant={e.published_at ? "ghost" : "default"}
              >
                {e.published_at ? t("unpublish") : t("publish")}
              </ConfirmAction>
            </div>
          </li>
        ))}
      </ul>
      <form className="grid max-w-3xl gap-4" onSubmit={submit}>
        <h3 className="type-subheading">{form.id ? t("edit") : t("new")}</h3>
        <BilingualField
          label={t("titleField")}
          maxLength={200}
          onChange={(title) => setForm((f) => ({ ...f, title }))}
          required
          value={form.title}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("season")}>
            {(id) => (
              <Input
                dir="ltr"
                id={id}
                min={1}
                onChange={(e) =>
                  setForm((f) => ({ ...f, season: e.target.value }))
                }
                type="number"
                value={form.season}
              />
            )}
          </Field>
          <Field label={t("number")}>
            {(id) => (
              <Input
                dir="ltr"
                id={id}
                min={1}
                onChange={(e) =>
                  setForm((f) => ({ ...f, number: e.target.value }))
                }
                type="number"
                value={form.number}
              />
            )}
          </Field>
          <Field label={t("segment")}>
            {(id) => (
              <Input
                id={id}
                maxLength={80}
                onChange={(e) =>
                  setForm((f) => ({ ...f, segment: e.target.value }))
                }
                value={form.segment}
              />
            )}
          </Field>
        </div>
        <Field hint={t("youtubeHint")} label={t("youtube")}>
          {(id) => (
            <Input
              dir="ltr"
              id={id}
              onChange={(e) =>
                setForm((f) => ({ ...f, youtube: e.target.value }))
              }
              required
              value={form.youtube}
            />
          )}
        </Field>
        <Field hint={tk("slugHint")} label={tk("slug")}>
          {(id) => (
            <Input
              dir="ltr"
              id={id}
              maxLength={80}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder={slugify(form.title.en)}
              value={form.slug}
            />
          )}
        </Field>
        <BilingualField
          label={t("summary")}
          maxLength={600}
          multiline
          onChange={(summary) => setForm((f) => ({ ...f, summary }))}
          rows={3}
          value={form.summary}
        />
        {problem ? (
          <p className="text-sm text-title" role="alert">
            {problem}
          </p>
        ) : null}
        <div className="flex gap-3">
          <SaveButton pending={save.isPending} />
          {form.id ? (
            <Button
              onClick={() => setForm(blankEpisode)}
              type="button"
              variant="ghost"
            >
              {t("new")}
            </Button>
          ) : null}
        </div>
        {save.error && save.error.message !== "invalid" ? (
          <ErrorLine error={save.error} />
        ) : null}
        <ErrorLine error={publish.error} />
      </form>
    </div>
  );
};

// ── Reels ───────────────────────────────────────────────────────────────────

const platforms = ["instagram", "tiktok", "youtube_shorts"] as const;

const Reels = ({ programmeId }: { programmeId: string }) => {
  const t = useTranslations("nexus.admin.programmes.reels");
  const te = useTranslations("nexus.admin.programmes.episodes");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    caption: { ar: "", en: "" },
    episode_id: "",
    platform: "instagram" as (typeof platforms)[number],
    url: "",
  });
  const [problem, setProblem] = useState<string | null>(null);
  const data = useQuery({
    queryFn: async () => {
      const [reels, episodes] = await Promise.all([
        supabase
          .schema("programmes")
          .from("reels")
          .select("*")
          .eq("programme_id", programmeId)
          .order("created_at", { ascending: false }),
        supabase
          .schema("programmes")
          .from("episodes")
          .select("id, title_en, title_ar")
          .eq("programme_id", programmeId),
      ]);
      return { episodes: unwrap(episodes) ?? [], reels: unwrap(reels) ?? [] };
    },
    queryKey: [...invalidateKey, "reels", programmeId],
  });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: invalidateKey });
  const add = useMutation({
    mutationFn: async () => {
      if (!programmes.isReelUrl(form.url)) {
        setProblem(t("urlError"));
        throw new Error("invalid");
      }
      setProblem(null);
      unwrap(
        await supabase
          .schema("programmes")
          .from("reels")
          .insert({
            caption_ar: form.caption.ar || null,
            caption_en: form.caption.en || null,
            episode_id: form.episode_id || null,
            platform: form.platform,
            programme_id: programmeId,
            url: form.url.trim(),
          })
      );
    },
    onSuccess: async () => {
      setForm((f) => ({ ...f, caption: { ar: "", en: "" }, url: "" }));
      await invalidate();
    },
  });
  const publish = useMutation({
    mutationFn: async (reel: { id: string; published_at: string | null }) =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("reels")
          .update({
            published_at: reel.published_at ? null : new Date().toISOString(),
          })
          .eq("id", reel.id)
      ),
    onSuccess: invalidate,
  });

  return (
    <div className="grid gap-6">
      <ul className="grid gap-3">
        {data.data?.reels.map((r) => (
          <li
            className="flex flex-wrap items-center justify-between gap-3 border-rule border-b pb-3"
            key={r.id}
          >
            <div className="min-w-0">
              <p className="font-medium">
                {t(`platforms.${r.platform as (typeof platforms)[number]}`)}
              </p>
              <p className="type-caption break-all" dir="ltr">
                {r.url}
              </p>
              {r.caption_en || r.caption_ar ? (
                <p className="type-caption">
                  {localized(r, "caption", locale)}
                </p>
              ) : null}
            </div>
            <ConfirmAction
              confirmLabel={r.published_at ? te("unpublish") : te("publish")}
              description={te("careNote")}
              disabled={publish.isPending}
              onConfirm={() => publish.mutate(r)}
              variant={r.published_at ? "ghost" : "default"}
            >
              {r.published_at ? te("unpublish") : te("publish")}
            </ConfirmAction>
          </li>
        ))}
      </ul>
      <form
        className="grid max-w-3xl gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <h3 className="type-subheading">{t("new")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("platform")}>
            {(id) => (
              <SelectInput
                id={id}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    platform: e.target.value as (typeof platforms)[number],
                  }))
                }
                value={form.platform}
              >
                {platforms.map((p) => (
                  <option key={p} value={p}>
                    {t(`platforms.${p}`)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
          <Field label={t("episode")}>
            {(id) => (
              <SelectInput
                id={id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, episode_id: e.target.value }))
                }
                value={form.episode_id}
              >
                <option value="">{t("none")}</option>
                {data.data?.episodes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {localized(e, "title", locale)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
        </div>
        <Field label={t("url")}>
          {(id) => (
            <Input
              dir="ltr"
              id={id}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              required
              type="url"
              value={form.url}
            />
          )}
        </Field>
        <BilingualField
          label={t("caption")}
          maxLength={300}
          onChange={(caption) => setForm((f) => ({ ...f, caption }))}
          value={form.caption}
        />
        {problem ? (
          <p className="text-sm text-title" role="alert">
            {problem}
          </p>
        ) : null}
        <SaveButton pending={add.isPending} />
        {add.error && add.error.message !== "invalid" ? (
          <ErrorLine error={add.error} />
        ) : null}
        <ErrorLine error={publish.error} />
      </form>
    </div>
  );
};

// ── Six Words ───────────────────────────────────────────────────────────────

const usePendingSixWords = () => {
  const { supabase } = useAuth();
  return useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("six_words")
          .select("id, user_id, text, language, show_name, created_at")
          .eq("status", "pending")
          .order("created_at")
      ) ?? [],
    queryKey: [...invalidateKey, "six-words"],
  });
};

const SixWords = () => {
  const t = useTranslations("nexus.admin.programmes.sixWords");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const pending = usePendingSixWords();
  const names = useMemberNames(pending.data?.map((w) => w.user_id) ?? []);
  const moderate = useMutation({
    mutationFn: async ({ approve, id }: { approve: boolean; id: string }) =>
      unwrap(
        await supabase
          .schema("programmes")
          .rpc("moderate_six_words", { approve, entry_id: id })
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invalidateKey }),
  });

  return (
    <div className="grid gap-4">
      <p className="type-body text-text-secondary">{t("lede")}</p>
      {pending.data?.length === 0 ? (
        <p className="type-body text-text-secondary">{t("empty")}</p>
      ) : null}
      <ul className="grid gap-3">
        {pending.data?.map((w) => {
          const person = names.data?.find((n) => n.id === w.user_id);
          return (
            <li
              className="flex flex-wrap items-center justify-between gap-3 border-rule border-b pb-3"
              key={w.id}
            >
              <div>
                <p
                  className="type-code text-lg"
                  dir={w.language === "ar" ? "rtl" : "ltr"}
                  lang={w.language}
                >
                  {w.text}
                </p>
                <p className="type-caption">
                  {person ? memberName(person, locale) : "—"}
                  {w.show_name ? "" : ` · ${t("anonymous")}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={moderate.isPending}
                  onClick={() => moderate.mutate({ approve: true, id: w.id })}
                  size="sm"
                >
                  {t("approve")}
                </Button>
                <Button
                  disabled={moderate.isPending}
                  onClick={() => moderate.mutate({ approve: false, id: w.id })}
                  size="sm"
                  variant="ghost"
                >
                  {t("reject")}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <ErrorLine error={moderate.error} />
    </div>
  );
};

// ── Rotas and shifts ────────────────────────────────────────────────────────

type SignupStatus = "signed_up" | "confirmed" | "swap_requested" | "cancelled";

const Shifts = ({ rotaId }: { rotaId: string }) => {
  const t = useTranslations("nexus.admin.programmes.rotas");
  const locale = useLocale() as Locale;
  const { supabase, user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    capacity: "1",
    ends_at: null as string | null,
    location: { ar: "", en: "" },
    role: { ar: "", en: "" },
    starts_at: null as string | null,
  });
  const data = useQuery({
    queryFn: async () => {
      const shifts =
        unwrap(
          await supabase
            .schema("programmes")
            .from("shifts")
            .select("*")
            .eq("rota_id", rotaId)
            .order("starts_at")
        ) ?? [];
      const signups = shifts.length
        ? (unwrap(
            await supabase
              .schema("programmes")
              .from("shift_signups")
              .select("shift_id, user_id, status")
              .in(
                "shift_id",
                shifts.map((s) => s.id)
              )
          ) ?? [])
        : [];
      // Shifts already recorded as worked (recorded service, F-16).
      const worked = shifts.length
        ? (unwrap(
            await supabase
              .schema("membership")
              .from("service_records")
              .select("source_id, user_id")
              .eq("source", "shift")
              .in(
                "source_id",
                shifts.map((s) => s.id)
              )
          ) ?? [])
        : [];
      return { shifts, signups, worked };
    },
    queryKey: [...invalidateKey, "shifts", rotaId],
  });
  const names = useMemberNames(data.data?.signups.map((s) => s.user_id) ?? []);
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: invalidateKey });

  const add = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("shifts")
          .insert({
            capacity: Number(form.capacity) || 1,
            ends_at: form.ends_at ?? "",
            location_ar: form.location.ar || null,
            location_en: form.location.en || null,
            role_ar: form.role.ar,
            role_en: form.role.en,
            rota_id: rotaId,
            starts_at: form.starts_at ?? "",
          })
      ),
    onSuccess: async () => {
      setForm((f) => ({ ...f, role: { ar: "", en: "" } }));
      await invalidate();
    },
  });
  const setStatus = useMutation({
    mutationFn: async (input: {
      shift_id: string;
      status: SignupStatus;
      user_id: string;
    }) =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("shift_signups")
          .update({ status: input.status })
          .eq("shift_id", input.shift_id)
          .eq("user_id", input.user_id)
      ),
    onSuccess: invalidate,
  });
  const markWorked = useMutation({
    mutationFn: (input: { shift_id: string; user_id: string }) =>
      recognition.recordShiftService(supabase, input.shift_id, input.user_id),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (shiftId: string) =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("shifts")
          .delete()
          .eq("id", shiftId)
      ),
    onSuccess: invalidate,
  });

  // After a shift ends, its manager records who worked it: the hours count
  // as confirmed service (Bylaws B4.1).
  const workedState = (
    shift: { ends_at: string; id: string },
    userId: string
  ) => {
    if (Date.parse(shift.ends_at) > Date.now() || userId === user?.id) {
      return null;
    }
    const done = data.data?.worked.some(
      (w) => w.source_id === shift.id && w.user_id === userId
    );
    if (done) {
      return <span className="type-caption">{t("worked")}</span>;
    }
    return (
      <Button
        disabled={markWorked.isPending}
        onClick={() =>
          markWorked.mutate({ shift_id: shift.id, user_id: userId })
        }
        size="sm"
        variant="ghost"
      >
        {t("markWorked")}
      </Button>
    );
  };

  return (
    <div className="grid gap-4">
      {data.data?.shifts.length === 0 ? (
        <p className="type-caption">{t("noShifts")}</p>
      ) : null}
      <ul className="grid gap-3">
        {data.data?.shifts.map((shift) => {
          const signups = (data.data?.signups ?? []).filter(
            (s) => s.shift_id === shift.id && s.status !== "cancelled"
          );
          return (
            <li className="grid gap-2 border-rule border-b pb-3" key={shift.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold">
                  {localized(shift, "role", locale)}
                  {shift.location_en || shift.location_ar
                    ? ` · ${localized(shift, "location", locale)}`
                    : ""}
                </p>
                <p className="type-caption">
                  {formatLongDate(shift.starts_at, locale)},{" "}
                  {formatClock(shift.starts_at, locale)}–
                  {formatClock(shift.ends_at, locale)} ·{" "}
                  {t("signups", {
                    capacity: formatNumber(shift.capacity),
                    count: formatNumber(signups.length),
                  })}
                </p>
              </div>
              <ul className="grid gap-1 ps-4">
                {signups.map((s) => {
                  const person = names.data?.find((n) => n.id === s.user_id);
                  return (
                    <li
                      className="flex flex-wrap items-center gap-3"
                      key={s.user_id}
                    >
                      <span>{person ? memberName(person, locale) : "—"}</span>
                      <span className="type-caption">
                        {t(`statuses.${s.status as SignupStatus}`)}
                      </span>
                      {s.status === "confirmed" ? null : (
                        <Button
                          disabled={setStatus.isPending}
                          onClick={() =>
                            setStatus.mutate({ ...s, status: "confirmed" })
                          }
                          size="sm"
                          variant="ghost"
                        >
                          {t("confirm")}
                        </Button>
                      )}
                      <Button
                        disabled={setStatus.isPending}
                        onClick={() =>
                          setStatus.mutate({ ...s, status: "cancelled" })
                        }
                        size="sm"
                        variant="ghost"
                      >
                        {t("release")}
                      </Button>
                      {workedState(shift, s.user_id)}
                    </li>
                  );
                })}
              </ul>
              <div>
                <ConfirmAction
                  confirmLabel={t("deleteShift")}
                  description={t("deleteShiftConfirm")}
                  disabled={remove.isPending}
                  onConfirm={() => remove.mutate(shift.id)}
                  variant="ghost"
                >
                  {t("deleteShift")}
                </ConfirmAction>
              </div>
            </li>
          );
        })}
      </ul>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <h4 className="font-bold text-sm">{t("addShift")}</h4>
        <BilingualField
          label={t("role")}
          maxLength={120}
          onChange={(role) => setForm((f) => ({ ...f, role }))}
          required
          value={form.role}
        />
        <BilingualField
          label={t("location")}
          maxLength={120}
          onChange={(location) => setForm((f) => ({ ...f, location }))}
          value={form.location}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <DateTimeField
            label={t("starts")}
            onChange={(starts_at) => setForm((f) => ({ ...f, starts_at }))}
            required
            value={form.starts_at}
          />
          <DateTimeField
            label={t("ends")}
            onChange={(ends_at) => setForm((f) => ({ ...f, ends_at }))}
            required
            value={form.ends_at}
          />
          <Field label={t("capacity")}>
            {(id) => (
              <Input
                dir="ltr"
                id={id}
                min={1}
                onChange={(e) =>
                  setForm((f) => ({ ...f, capacity: e.target.value }))
                }
                type="number"
                value={form.capacity}
              />
            )}
          </Field>
        </div>
        <SaveButton
          disabled={!(form.starts_at && form.ends_at)}
          pending={add.isPending}
        />
        <ErrorLine error={add.error ?? setStatus.error ?? remove.error} />
      </form>
    </div>
  );
};

const Rotas = ({ programmeId }: { programmeId: string }) => {
  const t = useTranslations("nexus.admin.programmes.rotas");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    ends_on: "",
    starts_on: "",
    title: { ar: "", en: "" },
  });
  const rotas = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("rotas")
          .select("*")
          .eq("programme_id", programmeId)
          .order("created_at", { ascending: false })
      ) ?? [],
    queryKey: [...invalidateKey, "rotas", programmeId],
  });
  const add = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("rotas")
          .insert({
            ends_on: form.ends_on || null,
            programme_id: programmeId,
            starts_on: form.starts_on || null,
            title_ar: form.title.ar,
            title_en: form.title.en,
          })
      ),
    onSuccess: async () => {
      setForm({ ends_on: "", starts_on: "", title: { ar: "", en: "" } });
      await queryClient.invalidateQueries({ queryKey: invalidateKey });
    },
  });

  return (
    <div className="grid gap-6">
      {rotas.data?.map((rota) => (
        <SalCard key={rota.id}>
          <h3 className="type-subheading">
            {localized(rota, "title", locale)}
          </h3>
          {rota.starts_on ? (
            <p className="type-caption">
              {formatLongDate(rota.starts_on, locale, true)}
              {rota.ends_on
                ? ` – ${formatLongDate(rota.ends_on, locale, true)}`
                : ""}
            </p>
          ) : null}
          <Shifts rotaId={rota.id} />
        </SalCard>
      ))}
      <form
        className="grid max-w-3xl gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
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
          <Field label={t("startsOn")}>
            {(id) => (
              <Input
                dir="ltr"
                id={id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, starts_on: e.target.value }))
                }
                type="date"
                value={form.starts_on}
              />
            )}
          </Field>
          <Field label={t("endsOn")}>
            {(id) => (
              <Input
                dir="ltr"
                id={id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ends_on: e.target.value }))
                }
                type="date"
                value={form.ends_on}
              />
            )}
          </Field>
        </div>
        <SaveButton pending={add.isPending} />
        <ErrorLine error={add.error} />
      </form>
    </div>
  );
};

// ── Removal requests ────────────────────────────────────────────────────────

type RemovalStatus = (typeof programmes.removalStatuses)[number];

const useOpenRemovals = () => {
  const { supabase } = useAuth();
  return useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("programmes")
          .from("removal_requests")
          .select("*")
          .order("due_at")
          .limit(100)
      ) ?? [],
    queryKey: [...invalidateKey, "removals"],
  });
};

const Countdown = ({ dueAt }: { dueAt: string }) => {
  const t = useTranslations("nexus.admin.programmes.removals");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const left = programmes.timeLeft(dueAt, now);
  const values = {
    hours: formatNumber(left.hours),
    minutes: formatNumber(left.minutes),
  };
  return (
    <p
      className={left.overdue ? "font-bold text-title" : "font-bold"}
      role="timer"
    >
      {left.overdue ? t("overdue", values) : t("left", values)}
    </p>
  );
};

const RemovalCard = ({
  request,
}: {
  request: NonNullable<ReturnType<typeof useOpenRemovals>["data"]>[number];
}) => {
  const t = useTranslations("nexus.admin.programmes.removals");
  const locale = useLocale() as Locale;
  const { supabase, user } = useAuth();
  const queryClient = useQueryClient();
  const [action, setAction] = useState(request.action_taken ?? "");
  const [status, setStatus] = useState<RemovalStatus>("removed");
  const update = useMutation({
    mutationFn: async (next: RemovalStatus) => {
      const closing = next !== "open" && next !== "in_progress";
      unwrap(
        await supabase
          .schema("programmes")
          .from("removal_requests")
          .update({
            action_taken: action.trim() || null,
            closed_at: closing ? new Date().toISOString() : null,
            handled_by: user?.id ?? null,
            status: next,
          })
          .eq("id", request.id)
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invalidateKey }),
  });

  return (
    <SalCard>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-bold">
          {t("from", { name: request.requester_name })}
        </p>
        <Countdown dueAt={request.due_at} />
      </div>
      <p className="type-caption">
        <span dir="ltr">{request.requester_email}</span> ·{" "}
        {t("due", { time: formatDateTime(request.due_at, locale) })} ·{" "}
        {t(`statuses.${request.status as RemovalStatus}`)}
      </p>
      {request.content_url ? (
        <p className="break-all text-sm" dir="ltr">
          {t("content")}: {request.content_url}
        </p>
      ) : null}
      <p className="type-body whitespace-pre-line">{request.details}</p>
      <Field label={t("action")}>
        {(id) => (
          <Textarea
            id={id}
            maxLength={2000}
            onChange={(e) => setAction(e.target.value)}
            rows={2}
            value={action}
          />
        )}
      </Field>
      <div className="flex flex-wrap items-end gap-3">
        {request.status === "open" ? (
          <Button
            disabled={update.isPending}
            onClick={() => update.mutate("in_progress")}
            size="sm"
            variant="outline"
          >
            {t("start")}
          </Button>
        ) : null}
        <SelectInput
          aria-label={t("close")}
          className="w-44"
          onChange={(e) => setStatus(e.target.value as RemovalStatus)}
          value={status}
        >
          {(["removed", "declined", "closed"] as const).map((s) => (
            <option key={s} value={s}>
              {t(`statuses.${s}`)}
            </option>
          ))}
        </SelectInput>
        <ConfirmAction
          confirmLabel={t("close")}
          description={t("closeConfirm")}
          disabled={!action.trim() || update.isPending}
          onConfirm={() => update.mutate(status)}
          variant="default"
        >
          {t("close")}
        </ConfirmAction>
      </div>
      <ErrorLine error={update.error} />
    </SalCard>
  );
};

const Removals = () => {
  const t = useTranslations("nexus.admin.programmes.removals");
  const locale = useLocale() as Locale;
  const requests = useOpenRemovals();
  const open = (requests.data ?? []).filter(
    (r) => r.status === "open" || r.status === "in_progress"
  );
  const closed = (requests.data ?? [])
    .filter((r) => !open.includes(r))
    .slice(0, 20);
  return (
    <div className="grid gap-4">
      <p className="type-body text-text-secondary">{t("lede")}</p>
      {requests.isPending ? <SectionSpinner /> : null}
      {requests.data && open.length === 0 ? (
        <p className="type-body text-text-secondary">{t("empty")}</p>
      ) : null}
      {open.map((r) => (
        <RemovalCard key={r.id} request={r} />
      ))}
      {closed.length > 0 ? (
        <section className="grid gap-2">
          <h3 className="type-subheading">{t("recent")}</h3>
          <ul className="grid gap-1">
            {closed.map((r) => (
              <li className="type-caption" key={r.id}>
                {r.requester_name} ·{" "}
                {t(`statuses.${r.status as RemovalStatus}`)}
                {r.closed_at ? ` · ${formatDateTime(r.closed_at, locale)}` : ""}
                {r.action_taken ? ` · ${r.action_taken}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};

// ── Page ────────────────────────────────────────────────────────────────────

export const ProgrammesAdmin = () => {
  const t = useTranslations("nexus.admin.programmes");
  const programmeOptions = useProgrammeOptions("programmes.manage");
  const [programmeId, setProgrammeId] = useState("");
  const sixWords = usePendingSixWords();
  const removals = useOpenRemovals();
  const selected = programmeId || programmeOptions.options[0]?.id || "";
  const openRemovals = (removals.data ?? []).filter(
    (r) => r.status === "open" || r.status === "in_progress"
  ).length;

  if (programmeOptions.isPending) {
    return <SectionSpinner />;
  }

  return (
    <div className="grid gap-6">
      <AdminHeading title={t("title")}>{t("lede")}</AdminHeading>
      <Field label={t("programme")}>
        {(id) => (
          <SelectInput
            className="max-w-sm"
            id={id}
            onChange={(e) => setProgrammeId(e.target.value)}
            value={selected}
          >
            {programmeOptions.options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </SelectInput>
        )}
      </Field>
      <Tabs defaultValue="episodes">
        <TabsList className="flex-wrap">
          <TabsTrigger value="episodes">{t("tabs.episodes")}</TabsTrigger>
          <TabsTrigger value="reels">{t("tabs.reels")}</TabsTrigger>
          <TabsTrigger value="rotas">{t("tabs.rotas")}</TabsTrigger>
          <TabsTrigger value="six-words">
            {t("tabs.sixWords", {
              count: formatNumber(sixWords.data?.length ?? 0),
            })}
          </TabsTrigger>
          <TabsTrigger value="removals">
            {t("tabs.removals", { count: formatNumber(openRemovals) })}
          </TabsTrigger>
        </TabsList>
        {selected ? (
          <>
            <TabsContent className="pt-4" value="episodes">
              <Episodes programmeId={selected} />
            </TabsContent>
            <TabsContent className="pt-4" value="reels">
              <Reels programmeId={selected} />
            </TabsContent>
            <TabsContent className="pt-4" value="rotas">
              <Rotas programmeId={selected} />
            </TabsContent>
          </>
        ) : null}
        <TabsContent className="pt-4" value="six-words">
          <SixWords />
        </TabsContent>
        <TabsContent className="pt-4" value="removals">
          <Removals />
        </TabsContent>
      </Tabs>
    </div>
  );
};
