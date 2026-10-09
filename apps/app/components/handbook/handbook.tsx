"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import { FormHeader } from "@repo/design-system/components/sal/form-header";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Link, useRouter } from "@repo/internationalization/navigation";
import { hasPermissionAnywhere } from "@repo/rbac";
import { unwrap } from "@repo/sal-data";
import { sanitizeRichText } from "@repo/sal-data/sanitize";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { useGrants } from "@/lib/queries";
import { useQueryParam } from "@/lib/use-query-param";
import {
  BilingualField,
  ConfirmAction,
  ErrorLine,
  Field,
  SaveButton,
  SelectInput,
} from "../admin/kit";
import { RichTextEditor } from "../editor/rich-text";
import { EmptyLine, ErrorState, SectionSpinner } from "../states";

/**
 * The officer handbook (governance.handbook_pages): what used to be the
 * public docs site, now behind our own sign-in. Officers with library.read
 * read it; governance managers edit it here. RLS decides; these checks only
 * choose what to show.
 */

const SECTIONS = ["start", "running", "making"] as const;
type Section = (typeof SECTIONS)[number];
type Lang = "en" | "ar";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KEY = ["handbook"];

interface PageRow {
  body_ar: string | null;
  body_en: string;
  id: string;
  section: string;
  slug: string;
  sort: number;
  summary_ar: string | null;
  summary_en: string | null;
  title_ar: string | null;
  title_en: string;
}

const pick = (lang: Lang, en: string | null, ar: string | null) =>
  lang === "ar" && ar
    ? { lang: "ar" as const, text: ar }
    : { lang: "en" as const, text: en ?? "" };

const usePages = () => {
  const { supabase } = useAuth();
  return useQuery({
    queryFn: async () =>
      (unwrap(
        await supabase
          .schema("governance")
          .from("handbook_pages")
          .select(
            "id, slug, section, sort, title_en, title_ar, summary_en, summary_ar, body_en, body_ar"
          )
          .order("section")
          .order("sort")
      ) ?? []) as PageRow[],
    queryKey: KEY,
  });
};

const useCanEdit = () => {
  const grants = useGrants();
  return hasPermissionAnywhere(grants.data, "governance.manage");
};

const Editor = ({
  onDone,
  page,
}: {
  onDone: (slug: string) => void;
  page: PageRow | null;
}) => {
  const t = useTranslations("nexus.handbook");
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    body: { ar: page?.body_ar ?? "", en: page?.body_en ?? "" },
    section: (page?.section ?? "running") as Section,
    slug: page?.slug ?? "",
    summary: { ar: page?.summary_ar ?? "", en: page?.summary_en ?? "" },
    title: { ar: page?.title_ar ?? "", en: page?.title_en ?? "" },
  });

  const save = useMutation({
    mutationFn: async () => {
      const row = {
        body_ar: form.body.ar ? sanitizeRichText(form.body.ar) : null,
        body_en: sanitizeRichText(form.body.en),
        section: form.section,
        summary_ar: form.summary.ar.trim() || null,
        summary_en: form.summary.en.trim() || null,
        title_ar: form.title.ar.trim() || null,
        title_en: form.title.en.trim(),
      };
      const table = supabase.schema("governance").from("handbook_pages");
      unwrap(
        page
          ? await table.update(row).eq("id", page.id)
          : await table.insert({ ...row, slug: form.slug.trim() })
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: KEY });
      onDone(page?.slug ?? form.slug.trim());
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const slugOk = page === null ? SLUG.test(form.slug.trim()) : true;
    if (form.title.en.trim() && slugOk) {
      save.mutate();
    }
  };

  return (
    <form className="grid gap-4" onSubmit={submit}>
      {page ? null : (
        <Field hint={t("slugHint")} label={t("slug")}>
          {(id) => (
            <Input
              dir="ltr"
              id={id}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              pattern={SLUG.source}
              required
              value={form.slug}
            />
          )}
        </Field>
      )}
      <Field label={t("section")}>
        {(id) => (
          <SelectInput
            id={id}
            onChange={(e) =>
              setForm((f) => ({ ...f, section: e.target.value as Section }))
            }
            value={form.section}
          >
            {SECTIONS.map((s) => (
              <option key={s} value={s}>
                {t(`sections.${s}`)}
              </option>
            ))}
          </SelectInput>
        )}
      </Field>
      <BilingualField
        label={t("titleLabel")}
        maxLength={200}
        onChange={(title) => setForm((f) => ({ ...f, title }))}
        value={form.title}
      />
      <BilingualField
        label={t("summary")}
        maxLength={400}
        onChange={(summary) => setForm((f) => ({ ...f, summary }))}
        value={form.summary}
      />
      <RichTextEditor
        label={t("bodyEn")}
        lang="en"
        onChange={(en) => setForm((f) => ({ ...f, body: { ...f.body, en } }))}
        value={form.body.en}
      />
      <RichTextEditor
        label={t("bodyAr")}
        lang="ar"
        onChange={(ar) => setForm((f) => ({ ...f, body: { ...f.body, ar } }))}
        value={form.body.ar}
      />
      <ErrorLine error={save.error} />
      <div className="flex flex-wrap gap-3">
        <SaveButton pending={save.isPending} />
        <Button
          onClick={() => onDone(page?.slug ?? "")}
          type="button"
          variant="ghost"
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
};

const PageView = ({ page }: { page: PageRow }) => {
  const t = useTranslations("nexus.handbook");
  const locale = useLocale() as Lang;
  const canEdit = useCanEdit();
  const router = useRouter();
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const title = pick(locale, page.title_en, page.title_ar);
  const body = pick(locale, page.body_en, page.body_ar);

  const remove = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase
          .schema("governance")
          .from("handbook_pages")
          .delete()
          .eq("id", page.id)
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: KEY });
      router.replace("/handbook");
    },
  });

  if (editing) {
    return <Editor onDone={() => setEditing(false)} page={page} />;
  }

  return (
    <article className="grid gap-6">
      <Link className="type-caption underline" href="/handbook">
        {t("back")}
      </Link>
      <FormHeader title={title.text} />
      {locale === "ar" && body.lang === "en" ? (
        <p className="type-caption">{t("englishOnly")}</p>
      ) : null}
      <div
        className="prose max-w-none"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized with the one rich-text policy
        dangerouslySetInnerHTML={{ __html: sanitizeRichText(body.text) }}
        dir={body.lang === "ar" ? "rtl" : "ltr"}
        lang={body.lang}
      />
      {canEdit ? (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setEditing(true)} variant="outline">
            {t("edit")}
          </Button>
          <ConfirmAction
            confirmLabel={t("delete")}
            description={t("deleteConfirm")}
            disabled={remove.isPending}
            onConfirm={() => remove.mutate()}
          >
            {t("delete")}
          </ConfirmAction>
          <ErrorLine error={remove.error} />
        </div>
      ) : null}
    </article>
  );
};

export const Handbook = () => {
  const t = useTranslations("nexus.handbook");
  const locale = useLocale() as Lang;
  const slug = useQueryParam("page");
  const router = useRouter();
  const grants = useGrants();
  const pages = usePages();
  const canEdit = useCanEdit();
  const [adding, setAdding] = useState(false);
  const canRead = hasPermissionAnywhere(grants.data, "library.read") || canEdit;

  useEffect(() => {
    if (slug) {
      setAdding(false);
    }
  }, [slug]);

  if (grants.isPending || pages.isPending) {
    return <SectionSpinner />;
  }
  if (pages.isError) {
    return <ErrorState onRetry={() => pages.refetch()} />;
  }
  if (!canRead) {
    return (
      <div className="grid max-w-2xl gap-6">
        <FormHeader title={t("title")} />
        <EmptyLine action={{ href: "/society", label: t("seeSociety") }}>
          {t("forOfficers")}
        </EmptyLine>
      </div>
    );
  }

  const rows = pages.data ?? [];
  if (slug) {
    const page = rows.find((p) => p.slug === slug);
    return (
      <div className="grid max-w-3xl gap-6">
        {page ? (
          <PageView key={page.id} page={page} />
        ) : (
          <EmptyLine action={{ href: "/handbook", label: t("back") }}>
            {t("notFound")}
          </EmptyLine>
        )}
      </div>
    );
  }

  return (
    <div className="grid max-w-3xl gap-8">
      <FormHeader title={t("title")}>{t("lede")}</FormHeader>
      {adding ? (
        <SalCard>
          <Editor
            onDone={(next) => {
              setAdding(false);
              if (next) {
                router.push({ pathname: "/handbook", query: { page: next } });
              }
            }}
            page={null}
          />
        </SalCard>
      ) : null}
      {rows.length === 0 ? (
        <EmptyLine action={{ href: "/society", label: t("seeSociety") }}>
          {t("empty")}
        </EmptyLine>
      ) : (
        SECTIONS.map((section) => {
          const inSection = rows.filter((p) => p.section === section);
          if (inSection.length === 0) {
            return null;
          }
          return (
            <section className="grid gap-3" key={section}>
              <h2 className="type-subheading">{t(`sections.${section}`)}</h2>
              <ul className="grid gap-3">
                {inSection.map((page) => {
                  const title = pick(locale, page.title_en, page.title_ar);
                  const summary = pick(
                    locale,
                    page.summary_en,
                    page.summary_ar
                  );
                  return (
                    <li key={page.id}>
                      <Link
                        className="font-bold underline"
                        href={{
                          pathname: "/handbook",
                          query: { page: page.slug },
                        }}
                        lang={title.lang}
                      >
                        {title.text}
                      </Link>
                      {summary.text ? (
                        <p className="type-caption" lang={summary.lang}>
                          {summary.text}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
      {canEdit && !adding ? (
        <Button
          className="justify-self-start"
          onClick={() => setAdding(true)}
          variant="outline"
        >
          {t("newPage")}
        </Button>
      ) : null}
    </div>
  );
};
