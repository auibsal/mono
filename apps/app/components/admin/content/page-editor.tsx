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
import {
  AdminHeading,
  BilingualField,
  ConfirmAction,
  ErrorLine,
  Field,
  SaveButton,
} from "../kit";
import { BilingualRichText } from "./bilingual-rich-text";

type Status = "draft" | "published";

export const PageEditor = () => {
  const t = useTranslations("nexus.admin.content");
  const tk = useTranslations("nexus.admin.kit");
  const locale = useLocale();
  const router = useRouter();
  const pageId = useQueryParam("id");
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    body: { ar: "", en: "" },
    slug: "",
    title: { ar: "", en: "" },
  });
  const [problem, setProblem] = useState<string | null>(null);

  const existing = useQuery({
    enabled: Boolean(pageId),
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("content")
          .from("pages")
          .select("*")
          .eq("id", pageId ?? "")
          .maybeSingle()
      ),
    queryKey: ["admin", "page", pageId],
  });

  useEffect(() => {
    const p = existing.data;
    if (p) {
      setForm({
        body: { ar: p.body_ar ?? "", en: p.body_en ?? "" },
        slug: p.slug,
        title: { ar: p.title_ar, en: p.title_en },
      });
    }
  }, [existing.data]);

  const status = (existing.data?.status ?? "draft") as Status;

  const save = useMutation({
    mutationFn: async (nextStatus: Status) => {
      const parsed = content.pageSchema.safeParse({
        body_ar: form.body.ar,
        body_en: form.body.en,
        slug: form.slug,
        status: nextStatus,
        title_ar: form.title.ar,
        title_en: form.title.en,
      });
      if (!parsed.success) {
        const [issue] = parsed.error.issues;
        setProblem(
          t(issue?.path[0] === "slug" ? "errors.slug" : "errors.title")
        );
        throw new Error("invalid");
      }
      setProblem(null);
      const row = {
        ...parsed.data,
        body_ar: sanitizeRichText(parsed.data.body_ar) || null,
        body_en: sanitizeRichText(parsed.data.body_en) || null,
        published_at:
          nextStatus === "published"
            ? (existing.data?.published_at ?? new Date().toISOString())
            : null,
      };
      const table = supabase.schema("content").from("pages");
      if (pageId) {
        unwrap(await table.update(row).eq("id", pageId));
        return pageId;
      }
      const created = unwrap(await table.insert(row).select("id").single());
      if (!created) {
        throw new Error("not_created");
      }
      return created.id;
    },
    onSuccess: async (savedId) => {
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
      if (!pageId) {
        router.replace({
          pathname: "/admin/content/page",
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
          .from("pages")
          .delete()
          .eq("id", pageId ?? "")
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
      router.replace("/admin/content");
    },
  });

  if (pageId && existing.isPending) {
    return <SectionSpinner />;
  }
  if (existing.isError) {
    return <ErrorState onRetry={() => existing.refetch()} />;
  }
  if (pageId && !existing.data) {
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
            : t("newPage")
        }
      >
        {`${tk("status")}: ${tk(`statuses.${status}`)}`}
      </AdminHeading>
      <form className="grid max-w-4xl gap-6" onSubmit={submit}>
        <BilingualField
          label={t("titleField")}
          maxLength={200}
          onChange={(title) => setForm((f) => ({ ...f, title }))}
          required
          value={form.title}
        />
        <Field hint={t("pageSlugHint")} label={tk("slug")}>
          {(id) => (
            <Input
              dir="ltr"
              id={id}
              maxLength={120}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              required
              value={form.slug}
            />
          )}
        </Field>
        <BilingualRichText
          id={pageId}
          kind="page"
          onChange={(patch) =>
            setForm((f) => ({ ...f, body: { ...f.body, ...patch } }))
          }
          value={form.body}
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
            <ConfirmAction
              confirmLabel={t("publish")}
              description={t("publishConfirm")}
              disabled={save.isPending}
              onConfirm={() => save.mutate("published")}
              variant="default"
            >
              {t("publish")}
            </ConfirmAction>
          )}
          {pageId ? (
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
