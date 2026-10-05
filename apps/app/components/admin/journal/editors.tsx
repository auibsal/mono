"use client";

import { useAuth } from "@repo/auth/provider";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import type { Locale } from "@repo/internationalization";
import { formatNumber } from "@repo/internationalization/format";
import { Link, useRouter } from "@repo/internationalization/navigation";
import { localized, sanitizeRichText, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useState,
} from "react";
import { useQueryParam } from "@/lib/use-query-param";
import { Collaboration } from "../../editor/collaboration";
import {
  CollaborativeRichTextEditor,
  RichTextEditor,
} from "../../editor/rich-text";
import { ErrorState, SectionSpinner } from "../../states";
import { slugify } from "../events/editor";
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
import type { Category, Language } from "./admin";
import { useIssues } from "./admin";

type Status = "draft" | "scheduled" | "published";

const CATEGORIES: Category[] = [
  "poetry",
  "fiction",
  "creative_nonfiction",
  "short_drama",
  "art_photography",
  "translation",
  "six_words",
];
const LANGUAGES: Language[] = ["en", "ar", "bilingual"];

const back = (label: string) => (
  <Link className="text-sm underline underline-offset-4" href="/admin/journal">
    {label}
  </Link>
);

/** Save, schedule (with a publish time), publish and back-to-draft buttons. */
const PublishControls = ({
  confirm,
  onSave,
  pending,
  publishAt,
  saved,
  status,
}: {
  confirm: string;
  onSave: (status: Status) => void;
  pending: boolean;
  publishAt: string | null;
  saved: boolean;
  status: Status;
}): ReactNode => {
  const t = useTranslations("nexus.admin.content");
  const tk = useTranslations("nexus.admin.kit");
  return (
    <div className="flex flex-wrap gap-3">
      <SaveButton pending={pending} success={saved} />
      {status === "draft" ? (
        <>
          <ConfirmAction
            confirmLabel={t("publish")}
            description={confirm}
            disabled={pending}
            onConfirm={() => onSave("published")}
            variant="default"
          >
            {t("publish")}
          </ConfirmAction>
          {publishAt ? (
            <ConfirmAction
              confirmLabel={tk("statuses.scheduled")}
              description={t("scheduleConfirm")}
              disabled={pending}
              onConfirm={() => onSave("scheduled")}
            >
              {tk("statuses.scheduled")}
            </ConfirmAction>
          ) : null}
        </>
      ) : (
        <ConfirmAction
          confirmLabel={t("unpublish")}
          description={t("unpublishConfirm")}
          disabled={pending}
          onConfirm={() => onSave("draft")}
        >
          {t("unpublish")}
        </ConfirmAction>
      )}
    </div>
  );
};

// ── Issue ───────────────────────────────────────────────────────────────────

export const IssueEditor = () => {
  const t = useTranslations("nexus.admin.journal");
  const tk = useTranslations("nexus.admin.kit");
  const tc = useTranslations("nexus.admin.content");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const issueId = useQueryParam("id");
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    cover_path: null as string | null,
    note: { ar: "", en: "" },
    number: "",
    pdf_path: null as string | null,
    publish_at: null as string | null,
    slug: "",
    theme: { ar: "", en: "" },
    title: { ar: "", en: "" },
    volume: "1",
  });
  const existing = useQuery({
    enabled: Boolean(issueId),
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("journal")
          .from("issues")
          .select("*")
          .eq("id", issueId ?? "")
          .maybeSingle()
      ),
    queryKey: ["admin", "journal", "issue", issueId],
  });
  useEffect(() => {
    const i = existing.data;
    if (i) {
      setForm({
        cover_path: i.cover_path,
        note: { ar: i.editors_note_ar ?? "", en: i.editors_note_en ?? "" },
        number: String(i.number),
        pdf_path: i.pdf_path,
        publish_at: i.publish_at,
        slug: i.slug,
        theme: { ar: i.theme_ar ?? "", en: i.theme_en ?? "" },
        title: { ar: i.title_ar, en: i.title_en },
        volume: String(i.volume),
      });
    }
  }, [existing.data]);
  const status = (existing.data?.status ?? "draft") as Status;

  const save = useMutation({
    mutationFn: async (next: Status) => {
      const row = {
        cover_path: form.cover_path,
        editors_note_ar: form.note.ar || null,
        editors_note_en: form.note.en || null,
        number: Number(form.number),
        pdf_path: form.pdf_path,
        publish_at: form.publish_at,
        published_at:
          next === "published"
            ? (existing.data?.published_at ?? new Date().toISOString())
            : null,
        slug: form.slug || `issue-${form.volume}-${form.number}`,
        status: next,
        theme_ar: form.theme.ar || null,
        theme_en: form.theme.en || null,
        title_ar: form.title.ar,
        title_en: form.title.en,
        volume: Number(form.volume),
      };
      const table = supabase.schema("journal").from("issues");
      if (issueId) {
        unwrap(await table.update(row).eq("id", issueId));
        return issueId;
      }
      const created = unwrap(await table.insert(row).select("id").single());
      if (!created) {
        throw new Error("not_created");
      }
      return created.id;
    },
    onSuccess: async (savedId) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "journal"] });
      if (!issueId) {
        router.replace({
          pathname: "/admin/journal/issue",
          query: { id: savedId },
        });
      }
    },
  });

  if (issueId && existing.isPending) {
    return <SectionSpinner />;
  }
  if (existing.isError) {
    return <ErrorState onRetry={() => existing.refetch()} />;
  }
  if (issueId && !existing.data) {
    return (
      <p className="type-body text-text-secondary">{t("issue.notFound")}</p>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(status);
  };

  return (
    <div className="grid gap-8">
      <AdminHeading
        actions={back(tk("back"))}
        title={
          existing.data
            ? localized(existing.data, "title", locale)
            : t("newIssue")
        }
      >
        {`${tk("status")}: ${tk(`statuses.${status}`)}`}
      </AdminHeading>
      <form className="grid max-w-4xl gap-6" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("issue.volume")}>
            {(id) => (
              <Input
                dir="ltr"
                id={id}
                min={1}
                onChange={(e) =>
                  setForm((f) => ({ ...f, volume: e.target.value }))
                }
                required
                type="number"
                value={form.volume}
              />
            )}
          </Field>
          <Field label={t("issue.number")}>
            {(id) => (
              <Input
                dir="ltr"
                id={id}
                min={1}
                onChange={(e) =>
                  setForm((f) => ({ ...f, number: e.target.value }))
                }
                required
                type="number"
                value={form.number}
              />
            )}
          </Field>
          <Field hint={tk("slugHint")} label={tk("slug")}>
            {(id) => (
              <Input
                dir="ltr"
                id={id}
                maxLength={80}
                onChange={(e) =>
                  setForm((f) => ({ ...f, slug: e.target.value }))
                }
                placeholder={`issue-${form.volume}-${form.number || "1"}`}
                value={form.slug}
              />
            )}
          </Field>
        </div>
        <BilingualField
          label={t("issue.titleField")}
          maxLength={200}
          onChange={(title) => setForm((f) => ({ ...f, title }))}
          required
          value={form.title}
        />
        <BilingualField
          label={t("issue.theme")}
          maxLength={200}
          onChange={(theme) => setForm((f) => ({ ...f, theme }))}
          value={form.theme}
        />
        <BilingualField
          label={t("issue.editorsNote")}
          multiline
          onChange={(note) => setForm((f) => ({ ...f, note }))}
          rows={6}
          value={form.note}
        />
        <ImageField
          area="issues"
          label={t("issue.cover")}
          onChange={(cover_path) => setForm((f) => ({ ...f, cover_path }))}
          value={form.cover_path}
        />
        <ImageField
          area="issues"
          kind="pdf"
          label={t("issue.pdf")}
          onChange={(pdf_path) => setForm((f) => ({ ...f, pdf_path }))}
          value={form.pdf_path}
        />
        <DateTimeField
          label={tc("publishAt")}
          onChange={(publish_at) => setForm((f) => ({ ...f, publish_at }))}
          value={form.publish_at}
        />
        <PublishControls
          confirm={t("issue.publishConfirm")}
          onSave={(s) => save.mutate(s)}
          pending={save.isPending}
          publishAt={form.publish_at}
          saved={save.isSuccess}
          status={status}
        />
        <ErrorLine error={save.error} />
      </form>
    </div>
  );
};

// ── Piece ───────────────────────────────────────────────────────────────────

const blankPiece = {
  body: { ar: "", en: "" },
  category: "poetry" as Category,
  contributor_id: "",
  credit: { ar: "", en: "" },
  image_path: null as string | null,
  issue_id: "",
  language: "en" as Language,
  members_only: false,
  publish_at: null as string | null,
  slug: "",
  sort: "0",
  title: { ar: "", en: "" },
};
type PieceForm = typeof blankPiece;

const pieceRow = (
  form: PieceForm,
  next: Status,
  publishedAt: string | null
) => ({
  category: form.category,
  contributor_id: form.contributor_id,
  credit_ar: form.credit.ar || null,
  credit_en: form.credit.en || null,
  image_path: form.image_path,
  issue_id: form.issue_id || null,
  language: form.language,
  members_only: form.members_only,
  publish_at: form.publish_at,
  published_at:
    next === "published" ? (publishedAt ?? new Date().toISOString()) : null,
  slug:
    form.slug ||
    slugify(form.title.en || form.title.ar) ||
    `piece-${Date.now()}`,
  sort: Number(form.sort) || 0,
  status: next,
  title_ar: form.title.ar || null,
  title_en: form.title.en || null,
});

export const PieceEditor = () => {
  const t = useTranslations("nexus.admin.journal");
  const tk = useTranslations("nexus.admin.kit");
  const tc = useTranslations("nexus.admin.content");
  const tm = useTranslations("nexus.admin.member");
  const locale = useLocale() as Locale;
  const id = useId();
  const router = useRouter();
  const pieceId = useQueryParam("id");
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const issues = useIssues();
  const [form, setForm] = useState(blankPiece);

  const existing = useQuery({
    enabled: Boolean(pieceId),
    queryFn: async () => {
      const [piece, body] = await Promise.all([
        supabase
          .schema("journal")
          .from("pieces")
          .select("*")
          .eq("id", pieceId ?? "")
          .maybeSingle(),
        supabase
          .schema("journal")
          .from("piece_bodies")
          .select("*")
          .eq("piece_id", pieceId ?? "")
          .maybeSingle(),
      ]);
      return { body: unwrap(body), piece: unwrap(piece) };
    },
    queryKey: ["admin", "journal", "piece", pieceId],
  });
  const contributors = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("journal")
          .from("contributors")
          .select("id, name_en, name_ar")
          .order("name_en")
      ) ?? [],
    queryKey: ["admin", "journal", "contributors"],
  });

  useEffect(() => {
    const p = existing.data?.piece;
    if (p) {
      setForm({
        body: {
          ar: existing.data?.body?.body_ar ?? "",
          en: existing.data?.body?.body_en ?? "",
        },
        category: p.category as Category,
        contributor_id: p.contributor_id,
        credit: { ar: p.credit_ar ?? "", en: p.credit_en ?? "" },
        image_path: p.image_path,
        issue_id: p.issue_id ?? "",
        language: p.language as Language,
        members_only: p.members_only,
        publish_at: p.publish_at,
        slug: p.slug,
        sort: String(p.sort),
        title: { ar: p.title_ar ?? "", en: p.title_en ?? "" },
      });
    }
  }, [existing.data]);

  const piece = existing.data?.piece;
  const status = (piece?.status ?? "draft") as Status;

  const save = useMutation({
    mutationFn: async (next: Status) => {
      const row = pieceRow(form, next, piece?.published_at ?? null);
      const pieces = supabase.schema("journal").from("pieces");
      let savedId = pieceId;
      if (pieceId) {
        unwrap(await pieces.update(row).eq("id", pieceId));
      } else {
        const created = unwrap(await pieces.insert(row).select("id").single());
        if (!created) {
          throw new Error("not_created");
        }
        savedId = created.id;
      }
      unwrap(
        await supabase
          .schema("journal")
          .from("piece_bodies")
          .upsert({
            body_ar: sanitizeRichText(form.body.ar) || null,
            body_en: sanitizeRichText(form.body.en) || null,
            piece_id: savedId ?? "",
          })
      );
      return savedId ?? "";
    },
    onSuccess: async (savedId) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "journal"] });
      if (!pieceId) {
        router.replace({
          pathname: "/admin/journal/piece",
          query: { id: savedId },
        });
      }
    },
  });

  if (pieceId && existing.isPending) {
    return <SectionSpinner />;
  }
  if (existing.isError) {
    return <ErrorState onRetry={() => existing.refetch()} />;
  }
  if (pieceId && !piece) {
    return (
      <p className="type-body text-text-secondary">{t("piece.notFound")}</p>
    );
  }

  const setBody = (patch: { ar?: string; en?: string }) =>
    setForm((f) => ({ ...f, body: { ...f.body, ...patch } }));
  const soloBody = (
    <div className="grid gap-4">
      <RichTextEditor
        label={tc("bodyEn")}
        lang="en"
        onChange={(en) => setBody({ en })}
        value={form.body.en}
      />
      <RichTextEditor
        label={tc("bodyAr")}
        lang="ar"
        onChange={(ar) => setBody({ ar })}
        value={form.body.ar}
      />
    </div>
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(status);
  };

  return (
    <div className="grid gap-8">
      <AdminHeading
        actions={back(tk("back"))}
        title={piece ? localized(piece, "title", locale) : t("newPiece")}
      >
        {`${tk("status")}: ${tk(`statuses.${status}`)}`}
      </AdminHeading>
      {piece?.submission_id ? (
        <p className="type-caption">{t("piece.agreementNeeded")}</p>
      ) : null}
      <form className="grid max-w-4xl gap-6" onSubmit={submit}>
        <BilingualField
          label={t("piece.titleField")}
          maxLength={300}
          onChange={(title) => setForm((f) => ({ ...f, title }))}
          value={form.title}
        />
        <p className="type-caption">{t("piece.titleHint")}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("piece.issue")}>
            {(fieldId) => (
              <SelectInput
                id={fieldId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, issue_id: e.target.value }))
                }
                value={form.issue_id}
              >
                <option value="">{t("noIssue")}</option>
                {issues.data?.map((i) => (
                  <option key={i.id} value={i.id}>
                    {t("volumeNumber", {
                      number: formatNumber(i.number),
                      volume: formatNumber(i.volume),
                    })}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
          <Field label={t("piece.category")}>
            {(fieldId) => (
              <SelectInput
                id={fieldId}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    category: e.target.value as Category,
                  }))
                }
                value={form.category}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`categories.${c}`)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
          <Field label={t("piece.language")}>
            {(fieldId) => (
              <SelectInput
                id={fieldId}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    language: e.target.value as Language,
                  }))
                }
                value={form.language}
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {t(`languages.${l}`)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
          <Field label={t("piece.contributor")}>
            {(fieldId) => (
              <SelectInput
                id={fieldId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contributor_id: e.target.value }))
                }
                required
                value={form.contributor_id}
              >
                <option value="">{tm("choose")}</option>
                {contributors.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {localized(c, "name", locale)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
          <Field label={t("piece.sort")}>
            {(fieldId) => (
              <Input
                dir="ltr"
                id={fieldId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sort: e.target.value }))
                }
                type="number"
                value={form.sort}
              />
            )}
          </Field>
          <Field hint={tk("slugHint")} label={tk("slug")}>
            {(fieldId) => (
              <Input
                dir="ltr"
                id={fieldId}
                maxLength={80}
                onChange={(e) =>
                  setForm((f) => ({ ...f, slug: e.target.value }))
                }
                placeholder={slugify(form.title.en)}
                value={form.slug}
              />
            )}
          </Field>
        </div>
        <BilingualField
          label={t("piece.credit")}
          maxLength={300}
          onChange={(credit) => setForm((f) => ({ ...f, credit }))}
          value={form.credit}
        />
        <fieldset className="grid gap-3">
          <legend className="mb-2 font-medium text-sm">{tc("body")}</legend>
          {pieceId ? (
            <Collaboration id={pieceId} kind="piece" solo={soloBody}>
              <div className="grid gap-4">
                <CollaborativeRichTextEditor
                  field="body_en"
                  label={tc("bodyEn")}
                  lang="en"
                  onChange={(en) => setBody({ en })}
                  value={form.body.en}
                />
                <CollaborativeRichTextEditor
                  field="body_ar"
                  label={tc("bodyAr")}
                  lang="ar"
                  onChange={(ar) => setBody({ ar })}
                  value={form.body.ar}
                />
              </div>
            </Collaboration>
          ) : (
            soloBody
          )}
        </fieldset>
        <ImageField
          area="pieces"
          label={t("piece.image")}
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
            {t("piece.membersOnly")}
          </Label>
        </div>
        <DateTimeField
          label={tc("publishAt")}
          onChange={(publish_at) => setForm((f) => ({ ...f, publish_at }))}
          value={form.publish_at}
        />
        <PublishControls
          confirm={t("piece.publishConfirm")}
          onSave={(s) => save.mutate(s)}
          pending={save.isPending}
          publishAt={form.publish_at}
          saved={save.isSuccess}
          status={status}
        />
        <ErrorLine error={save.error} />
      </form>
    </div>
  );
};
