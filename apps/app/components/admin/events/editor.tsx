"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { formatNumber } from "@repo/internationalization/format";
import { Link, useRouter } from "@repo/internationalization/navigation";
import { events, localized, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useEffect, useId, useState } from "react";
import { useQueryParam } from "@/lib/use-query-param";
import { ErrorState, SectionSpinner } from "../../states";
import { ImageField } from "../image-field";
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
import { NotionManaged } from "../notion-managed";
import { Attendance } from "./attendance";
import { useProgrammeOptions } from "./data";

interface Question {
  id: string;
  label_ar: string;
  label_en: string;
  required: boolean;
}

interface FormState {
  body: { ar: string; en: string };
  capacity: string;
  ends_at: string | null;
  image_path: string | null;
  members_only: boolean;
  programme_id: string;
  questions: Question[];
  rsvp_enabled: boolean;
  slug: string;
  starts_at: string | null;
  summary: { ar: string; en: string };
  title: { ar: string; en: string };
  venue: { ar: string; en: string };
}

const blank: FormState = {
  body: { ar: "", en: "" },
  capacity: "",
  ends_at: null,
  image_path: null,
  members_only: false,
  programme_id: "",
  questions: [],
  rsvp_enabled: true,
  slug: "",
  starts_at: null,
  summary: { ar: "", en: "" },
  title: { ar: "", en: "" },
  venue: { ar: "", en: "" },
};

const SLUG_TRIM = /^-+|-+$/g;
const NOT_SLUG = /[^a-z0-9]+/g;

/** "Charter Night 2026" → "charter-night-2026". */
export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(NOT_SLUG, "-")
    .replace(SLUG_TRIM, "")
    .slice(0, 80);

/** Registration questions from the jsonb column (always an array there). */
const asQuestions = (value: unknown): Question[] =>
  Array.isArray(value) ? (value as Question[]) : [];

type ProblemKey =
  | "errors.title"
  | "errors.ends_before_start"
  | "errors.slug"
  | "errors.starts"
  | "errors.questions";

/** The message for the first problem zod found in the event form. */
const problemKey = (
  issue: { message: string; path: PropertyKey[] } | undefined
): ProblemKey => {
  const field = String(issue?.path[0] ?? "");
  if (issue?.message === "ends_before_start") {
    return "errors.ends_before_start";
  }
  if (field === "slug") {
    return "errors.slug";
  }
  if (field === "starts_at") {
    return "errors.starts";
  }
  if (field === "questions") {
    return "errors.questions";
  }
  return "errors.title";
};

const newQuestionId = () => `q${Math.random().toString(36).slice(2, 8)}`;

export const EventEditor = () => {
  const t = useTranslations("nexus.admin.event");
  const tk = useTranslations("nexus.admin.kit");
  const tm = useTranslations("nexus.admin.member");
  const locale = useLocale();
  const id = useId();
  const router = useRouter();
  const eventId = useQueryParam("id");
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const programmes = useProgrammeOptions();
  const [form, setForm] = useState<FormState>(blank);
  const [problem, setProblem] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  const existing = useQuery({
    enabled: Boolean(eventId),
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("events")
          .from("events")
          .select("*")
          .eq("id", eventId ?? "")
          .maybeSingle()
      ),
    queryKey: ["admin", "event", eventId],
  });

  useEffect(() => {
    const e = existing.data;
    if (e) {
      setSlugTouched(true);
      setForm({
        body: { ar: e.body_ar ?? "", en: e.body_en ?? "" },
        capacity: e.capacity ? String(e.capacity) : "",
        ends_at: e.ends_at,
        image_path: e.image_path,
        members_only: e.members_only,
        programme_id: e.programme_id ?? "",
        questions: asQuestions(e.questions),
        rsvp_enabled: e.rsvp_enabled,
        slug: e.slug,
        starts_at: e.starts_at,
        summary: { ar: e.summary_ar ?? "", en: e.summary_en ?? "" },
        title: { ar: e.title_ar, en: e.title_en },
        venue: { ar: e.venue_ar ?? "", en: e.venue_en ?? "" },
      });
    }
  }, [existing.data]);

  const status = existing.data?.status ?? "draft";

  const toInput = (nextStatus: string) => ({
    body_ar: form.body.ar || undefined,
    body_en: form.body.en || undefined,
    capacity: form.capacity ? Number(form.capacity) : null,
    ends_at: form.ends_at,
    members_only: form.members_only,
    programme_id: form.programme_id || null,
    questions: form.questions,
    rsvp_enabled: form.rsvp_enabled,
    slug: form.slug,
    starts_at: form.starts_at ?? "",
    status: nextStatus as "draft" | "published" | "cancelled",
    summary_ar: form.summary.ar || undefined,
    summary_en: form.summary.en || undefined,
    title_ar: form.title.ar,
    title_en: form.title.en,
    venue_ar: form.venue.ar || undefined,
    venue_en: form.venue.en || undefined,
  });

  const save = useMutation({
    mutationFn: async (nextStatus: string) => {
      const parsed = events.eventSchema.safeParse(toInput(nextStatus));
      if (!parsed.success) {
        const [issue] = parsed.error.issues;
        setProblem(t(problemKey(issue)));
        throw new Error("invalid");
      }
      setProblem(null);
      const row = {
        ...parsed.data,
        body_ar: parsed.data.body_ar ?? null,
        body_en: parsed.data.body_en ?? null,
        image_path: form.image_path,
        published_at:
          nextStatus === "published"
            ? (existing.data?.published_at ?? new Date().toISOString())
            : (existing.data?.published_at ?? null),
        summary_ar: parsed.data.summary_ar ?? null,
        summary_en: parsed.data.summary_en ?? null,
        venue_ar: parsed.data.venue_ar ?? null,
        venue_en: parsed.data.venue_en ?? null,
      };
      const table = supabase.schema("events").from("events");
      if (eventId) {
        unwrap(await table.update(row).eq("id", eventId));
        return eventId;
      }
      const created = unwrap(await table.insert(row).select("id").single());
      if (!created) {
        throw new Error("not_created");
      }
      return created.id;
    },
    onSuccess: async (savedId) => {
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
      if (!eventId) {
        router.replace({
          pathname: "/admin/events/edit",
          query: { id: savedId },
        });
      }
    },
  });

  const remove = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase
          .schema("events")
          .from("events")
          .delete()
          .eq("id", eventId ?? "")
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
      router.replace("/admin/events");
    },
  });

  if (eventId && existing.isPending) {
    return <SectionSpinner />;
  }
  if (existing.isError) {
    return <ErrorState onRetry={() => existing.refetch()} />;
  }
  if (eventId && !existing.data) {
    return <p className="type-body text-text-secondary">{t("notFound")}</p>;
  }

  const setQuestion = (index: number, patch: Partial<Question>) =>
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) =>
        i === index ? { ...q, ...patch } : q
      ),
    }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(status);
  };

  return (
    <div className="grid gap-10">
      <AdminHeading
        actions={
          <Link
            className="text-sm underline underline-offset-4"
            href="/admin/events"
          >
            {tk("back")}
          </Link>
        }
        title={
          existing.data
            ? localized(existing.data, "title", locale)
            : t("newTitle")
        }
      >
        {existing.data
          ? `${tk("status")}: ${tk(`statuses.${status as "draft"}`)}`
          : null}
      </AdminHeading>
      <NotionManaged kind="event" recordId={eventId} />

      <form className="grid max-w-4xl gap-6" onSubmit={submit}>
        <BilingualField
          label={t("eventTitle")}
          maxLength={200}
          onChange={(title) =>
            setForm((f) => ({
              ...f,
              slug: slugTouched ? f.slug : slugify(title.en),
              title,
            }))
          }
          required
          value={form.title}
        />
        <Field hint={tk("slugHint")} label={tk("slug")}>
          {(fieldId) => (
            <Input
              dir="ltr"
              id={fieldId}
              maxLength={80}
              onChange={(e) => {
                setSlugTouched(true);
                setForm((f) => ({ ...f, slug: e.target.value }));
              }}
              required
              value={form.slug}
            />
          )}
        </Field>
        <Field label={tk("programme")}>
          {(fieldId) => (
            <SelectInput
              id={fieldId}
              onChange={(e) =>
                setForm((f) => ({ ...f, programme_id: e.target.value }))
              }
              required={!programmes.canChooseNone}
              value={form.programme_id}
            >
              {programmes.canChooseNone ? (
                <option value="">{tk("noProgramme")}</option>
              ) : (
                <option value="">{tm("choose")}</option>
              )}
              {programmes.options.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <DateTimeField
            label={t("starts")}
            onChange={(starts_at) => setForm((f) => ({ ...f, starts_at }))}
            required
            value={form.starts_at}
          />
          <DateTimeField
            label={t("ends")}
            onChange={(ends_at) => setForm((f) => ({ ...f, ends_at }))}
            value={form.ends_at}
          />
        </div>
        <BilingualField
          label={t("venue")}
          maxLength={200}
          onChange={(venue) => setForm((f) => ({ ...f, venue }))}
          value={form.venue}
        />
        <BilingualField
          label={t("summary")}
          maxLength={500}
          multiline
          onChange={(summary) => setForm((f) => ({ ...f, summary }))}
          rows={2}
          value={form.summary}
        />
        <BilingualField
          label={t("body")}
          multiline
          onChange={(body) => setForm((f) => ({ ...f, body }))}
          rows={8}
          value={form.body}
        />
        <ImageField
          area="events"
          onChange={(image_path) => setForm((f) => ({ ...f, image_path }))}
          value={form.image_path}
        />
        <div className="flex items-start gap-3">
          <Checkbox
            checked={form.members_only}
            id={`${id}-members`}
            onCheckedChange={(v) =>
              setForm((f) => ({ ...f, members_only: v === true }))
            }
          />
          <Label className="leading-normal" htmlFor={`${id}-members`}>
            {t("membersOnly")}
          </Label>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox
            checked={form.rsvp_enabled}
            id={`${id}-rsvp`}
            onCheckedChange={(v) =>
              setForm((f) => ({ ...f, rsvp_enabled: v === true }))
            }
          />
          <Label className="leading-normal" htmlFor={`${id}-rsvp`}>
            {t("rsvpEnabled")}
          </Label>
        </div>
        <Field hint={t("capacityHint")} label={t("capacity")}>
          {(fieldId) => (
            <Input
              className="w-40"
              dir="ltr"
              id={fieldId}
              inputMode="numeric"
              min={1}
              onChange={(e) =>
                setForm((f) => ({ ...f, capacity: e.target.value }))
              }
              type="number"
              value={form.capacity}
            />
          )}
        </Field>

        <fieldset className="grid gap-4">
          <legend className="type-subheading">{t("questions")}</legend>
          <p className="type-caption">{t("questionsHint")}</p>
          {form.questions.map((question, index) => (
            <div
              className="grid gap-3 rounded-card bg-surface-tint p-card-padding"
              key={question.id}
            >
              <BilingualField
                label={t("question", { number: formatNumber(index + 1) })}
                maxLength={200}
                onChange={(label) =>
                  setQuestion(index, { label_ar: label.ar, label_en: label.en })
                }
                value={{ ar: question.label_ar, en: question.label_en }}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={question.required}
                    id={`${id}-q-${question.id}`}
                    onCheckedChange={(v) =>
                      setQuestion(index, { required: v === true })
                    }
                  />
                  <Label htmlFor={`${id}-q-${question.id}`}>
                    {t("questionRequired")}
                  </Label>
                </div>
                <Button
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      questions: f.questions.filter((_, i) => i !== index),
                    }))
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {t("removeQuestion", { number: formatNumber(index + 1) })}
                </Button>
              </div>
            </div>
          ))}
          {form.questions.length < 10 ? (
            <Button
              className="justify-self-start"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  questions: [
                    ...f.questions,
                    {
                      id: newQuestionId(),
                      label_ar: "",
                      label_en: "",
                      required: false,
                    },
                  ],
                }))
              }
              size="sm"
              type="button"
              variant="outline"
            >
              {t("addQuestion")}
            </Button>
          ) : null}
        </fieldset>

        {problem ? (
          <p className="text-sm text-title" role="alert">
            {problem}
          </p>
        ) : null}
        {save.error && save.error.message !== "invalid" ? (
          <ErrorLine error={save.error} />
        ) : null}
        <div className="flex flex-wrap gap-3">
          <SaveButton pending={save.isPending} success={save.isSuccess} />
          {status === "draft" ? (
            <ConfirmAction
              confirmLabel={t("publish")}
              description={t("publishConfirm")}
              disabled={save.isPending}
              onConfirm={() => save.mutate("published")}
              variant="default"
            >
              {t("publish")}
            </ConfirmAction>
          ) : null}
          {status === "published" ? (
            <ConfirmAction
              confirmLabel={t("cancelEvent")}
              description={t("cancelConfirm")}
              disabled={save.isPending}
              onConfirm={() => save.mutate("cancelled")}
            >
              {t("cancelEvent")}
            </ConfirmAction>
          ) : null}
          {eventId && status === "draft" ? (
            <ConfirmAction
              confirmLabel={t("deleteDraft")}
              description={t("deleteConfirm")}
              disabled={remove.isPending}
              onConfirm={() => remove.mutate()}
              variant="ghost"
            >
              {t("deleteDraft")}
            </ConfirmAction>
          ) : null}
        </div>
        <ErrorLine error={remove.error} />
      </form>

      {eventId && existing.data ? (
        <Attendance
          capacity={existing.data.capacity}
          eventId={eventId}
          questions={asQuestions(existing.data.questions)}
          slug={existing.data.slug}
        />
      ) : null}
    </div>
  );
};
