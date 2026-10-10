"use client";

import { useAuth } from "@repo/auth/provider";
import { Input } from "@repo/design-system/components/ui/input";
import { Link, useRouter } from "@repo/internationalization/navigation";
import { content, localized, sanitizeRichText, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { useQueryParam } from "@/lib/use-query-param";
import { ErrorState, SectionSpinner } from "../../states";
import { useProgrammeOptions } from "../events/data";
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
import { NotionManaged } from "../notion-managed";
import { BilingualRichText } from "./bilingual-rich-text";

type Status = "draft" | "scheduled" | "published";

const blank = {
  body: { ar: "", en: "" },
  cover_path: null as string | null,
  excerpt: { ar: "", en: "" },
  programme_id: "",
  publish_at: null as string | null,
  slug: "",
  title: { ar: "", en: "" },
};

type ProblemKey = "errors.title" | "errors.slug" | "errors.publish_at";

const problemKey = (field: string): ProblemKey => {
  if (field === "slug") {
    return "errors.slug";
  }
  if (field === "publish_at") {
    return "errors.publish_at";
  }
  return "errors.title";
};

export const NewsEditor = () => {
  const t = useTranslations("nexus.admin.content");
  const tk = useTranslations("nexus.admin.kit");
  const locale = useLocale();
  const router = useRouter();
  const newsId = useQueryParam("id");
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const programmes = useProgrammeOptions(null);
  const [form, setForm] = useState(blank);
  const [slugTouched, setSlugTouched] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const existing = useQuery({
    enabled: Boolean(newsId),
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("content")
          .from("news_posts")
          .select("*")
          .eq("id", newsId ?? "")
          .maybeSingle()
      ),
    queryKey: ["admin", "news", newsId],
  });

  useEffect(() => {
    const n = existing.data;
    if (n) {
      setSlugTouched(true);
      setForm({
        body: { ar: n.body_ar ?? "", en: n.body_en ?? "" },
        cover_path: n.cover_path,
        excerpt: { ar: n.excerpt_ar ?? "", en: n.excerpt_en ?? "" },
        programme_id: n.programme_id ?? "",
        publish_at: n.publish_at,
        slug: n.slug,
        title: { ar: n.title_ar, en: n.title_en },
      });
    }
  }, [existing.data]);

  const status = (existing.data?.status ?? "draft") as Status;

  const save = useMutation({
    mutationFn: async (nextStatus: Status) => {
      const parsed = content.newsSchema.safeParse({
        body_ar: form.body.ar,
        body_en: form.body.en,
        cover_path: form.cover_path,
        excerpt_ar: form.excerpt.ar || undefined,
        excerpt_en: form.excerpt.en || undefined,
        programme_id: form.programme_id || null,
        publish_at: form.publish_at,
        slug: form.slug,
        status: nextStatus,
        title_ar: form.title.ar,
        title_en: form.title.en,
      });
      if (!parsed.success) {
        const [issue] = parsed.error.issues;
        setProblem(t(problemKey(String(issue?.path[0] ?? ""))));
        throw new Error("invalid");
      }
      setProblem(null);
      const row = {
        ...parsed.data,
        body_ar: sanitizeRichText(parsed.data.body_ar) || null,
        body_en: sanitizeRichText(parsed.data.body_en) || null,
        excerpt_ar: parsed.data.excerpt_ar ?? null,
        excerpt_en: parsed.data.excerpt_en ?? null,
        published_at:
          nextStatus === "published"
            ? (existing.data?.published_at ?? new Date().toISOString())
            : null,
      };
      const table = supabase.schema("content").from("news_posts");
      if (newsId) {
        unwrap(await table.update(row).eq("id", newsId));
        return newsId;
      }
      const created = unwrap(await table.insert(row).select("id").single());
      if (!created) {
        throw new Error("not_created");
      }
      return created.id;
    },
    onSuccess: async (savedId) => {
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
      if (!newsId) {
        router.replace({
          pathname: "/admin/content/news",
          query: { id: savedId },
        });
      }
    },
  });

  const remove = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase
          .schema("content")
          .from("news_posts")
          .delete()
          .eq("id", newsId ?? "")
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
      router.replace("/admin/content");
    },
  });

  if (newsId && existing.isPending) {
    return <SectionSpinner />;
  }
  if (existing.isError) {
    return <ErrorState onRetry={() => existing.refetch()} />;
  }
  if (newsId && !existing.data) {
    return <p className="type-body text-text-secondary">{t("notFound")}</p>;
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(status);
  };

  return (
    <div className="grid gap-8">
      <AdminHeading
        actions={
          <Link
            className="text-sm underline underline-offset-4"
            href="/admin/content"
          >
            {tk("back")}
          </Link>
        }
        title={
          existing.data
            ? localized(existing.data, "title", locale)
            : t("newNews")
        }
      >
        {`${tk("status")}: ${tk(`statuses.${status}`)}`}
      </AdminHeading>
      <NotionManaged kind="news" recordId={newsId} />
      <form className="grid max-w-4xl gap-6" onSubmit={submit}>
        <BilingualField
          label={t("titleField")}
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
          {(id) => (
            <Input
              dir="ltr"
              id={id}
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
          {(id) => (
            <SelectInput
              id={id}
              onChange={(e) =>
                setForm((f) => ({ ...f, programme_id: e.target.value }))
              }
              value={form.programme_id}
            >
              <option value="">{tk("noProgramme")}</option>
              {programmes.options.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <BilingualField
          label={t("excerpt")}
          maxLength={400}
          multiline
          onChange={(excerpt) => setForm((f) => ({ ...f, excerpt }))}
          rows={2}
          value={form.excerpt}
        />
        <BilingualRichText
          id={newsId}
          kind="news"
          onChange={(patch) =>
            setForm((f) => ({ ...f, body: { ...f.body, ...patch } }))
          }
          value={form.body}
        />
        <ImageField
          area="news"
          label={t("cover")}
          onChange={(cover_path) => setForm((f) => ({ ...f, cover_path }))}
          value={form.cover_path}
        />
        <DateTimeField
          label={t("publishAt")}
          onChange={(publish_at) => setForm((f) => ({ ...f, publish_at }))}
          value={form.publish_at}
        />
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
          {status === "published" ? (
            <ConfirmAction
              confirmLabel={t("unpublish")}
              description={t("unpublishConfirm")}
              disabled={save.isPending}
              onConfirm={() => save.mutate("draft")}
            >
              {t("unpublish")}
            </ConfirmAction>
          ) : (
            <>
              <ConfirmAction
                confirmLabel={t("publish")}
                description={t("publishConfirm")}
                disabled={save.isPending}
                onConfirm={() => save.mutate("published")}
                variant="default"
              >
                {t("publish")}
              </ConfirmAction>
              {form.publish_at ? (
                <ConfirmAction
                  confirmLabel={tk("statuses.scheduled")}
                  description={t("scheduleConfirm")}
                  disabled={save.isPending}
                  onConfirm={() => save.mutate("scheduled")}
                >
                  {tk("statuses.scheduled")}
                </ConfirmAction>
              ) : null}
            </>
          )}
          {newsId ? (
            <ConfirmAction
              confirmLabel={t("delete")}
              description={t("deleteConfirm")}
              disabled={remove.isPending}
              onConfirm={() => remove.mutate()}
              variant="ghost"
            >
              {t("delete")}
            </ConfirmAction>
          ) : null}
        </div>
        <ErrorLine error={remove.error} />
      </form>
    </div>
  );
};
