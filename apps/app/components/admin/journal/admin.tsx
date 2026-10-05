"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import type { Locale } from "@repo/internationalization";
import {
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import { Link, useRouter } from "@repo/internationalization/navigation";
import { localized, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { SectionSpinner } from "../../states";
import { slugify } from "../events/editor";
import {
  AdminHeading,
  BilingualField,
  type Column,
  DataTable,
  ErrorLine,
  Field,
  SaveButton,
  SelectInput,
} from "../kit";

export type Category =
  | "poetry"
  | "fiction"
  | "creative_nonfiction"
  | "short_drama"
  | "art_photography"
  | "translation"
  | "six_words";
export type Language = "en" | "ar" | "bilingual";
type Status = "draft" | "scheduled" | "published";

const key = ["admin", "journal"];
const buttonLink =
  "inline-flex h-8 items-center justify-self-start rounded-md bg-primary px-3 text-primary-foreground text-sm";

export const useIssues = () => {
  const { supabase } = useAuth();
  return useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("journal")
          .from("issues")
          .select(
            "id, volume, number, slug, title_en, title_ar, status, published_at, publish_at"
          )
          .order("volume", { ascending: false })
          .order("number", { ascending: false })
      ) ?? [],
    queryKey: [...key, "issues"],
  });
};

const Issues = () => {
  const t = useTranslations("nexus.admin.journal");
  const tk = useTranslations("nexus.admin.kit");
  const locale = useLocale() as Locale;
  const issues = useIssues();
  type Row = NonNullable<typeof issues.data>[number];
  const columns: Column<Row>[] = [
    {
      cell: (i) => (
        <Link
          className="font-medium underline underline-offset-4"
          href={{ pathname: "/admin/journal/issue", query: { id: i.id } }}
        >
          {t("volumeNumber", {
            number: formatNumber(i.number),
            volume: formatNumber(i.volume),
          })}{" "}
          · {localized(i, "title", locale)}
        </Link>
      ),
      header: t("columns.issue"),
      key: "issue",
    },
    {
      cell: (i) =>
        `${tk(`statuses.${i.status as Status}`)}${
          i.published_at
            ? `, ${formatLongDate(i.published_at, locale, true)}`
            : ""
        }`,
      header: t("columns.status"),
      key: "status",
    },
  ];
  return (
    <div className="grid gap-4">
      <Link className={buttonLink} href="/admin/journal/issue">
        {t("newIssue")}
      </Link>
      {issues.data ? (
        <DataTable columns={columns} rowKey={(i) => i.id} rows={issues.data} />
      ) : (
        <SectionSpinner />
      )}
    </div>
  );
};

export const useAcceptedUnplaced = () => {
  const { supabase } = useAuth();
  return useQuery({
    queryFn: async () =>
      unwrap(await supabase.schema("journal").rpc("accepted_unplaced")) ?? [],
    queryKey: [...key, "accepted"],
  });
};

const Accepted = () => {
  const t = useTranslations("nexus.admin.journal");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const accepted = useAcceptedUnplaced();
  const place = useMutation({
    mutationFn: async (blindEntryId: string) =>
      unwrap(
        await supabase
          .schema("journal")
          .rpc("piece_from_entry", { blind_entry_id: blindEntryId })
      ),
    onSuccess: async (pieceId) => {
      await queryClient.invalidateQueries({ queryKey: key });
      if (pieceId) {
        router.push({
          pathname: "/admin/journal/piece",
          query: { id: pieceId },
        });
      }
    },
  });
  type Row = NonNullable<typeof accepted.data>[number];
  const columns: Column<Row>[] = [
    {
      cell: (a) => <span className="type-code">{a.blind_id}</span>,
      header: "",
      key: "blind",
    },
    { cell: (a) => a.title, header: t("columns.piece"), key: "title" },
    {
      cell: (a) => t(`categories.${a.category}`),
      header: t("columns.category"),
      key: "category",
    },
    {
      cell: (a) => formatLongDate(a.decided_at, locale, true),
      className: "whitespace-nowrap",
      header: t("columns.decided"),
      key: "decided",
    },
    {
      cell: (a) => (a.agreement_signed ? t("signed") : t("notSigned")),
      header: t("columns.agreement"),
      key: "agreement",
    },
    {
      cell: (a) => (
        <Button
          disabled={place.isPending}
          onClick={() => place.mutate(a.blind_entry_id)}
          size="sm"
        >
          {t("place")}
        </Button>
      ),
      header: "",
      key: "place",
    },
  ];
  return (
    <div className="grid gap-4">
      {accepted.data ? (
        <DataTable
          columns={columns}
          empty={t("noneAccepted")}
          rowKey={(a) => a.blind_entry_id}
          rows={accepted.data}
        />
      ) : (
        <SectionSpinner />
      )}
      <ErrorLine error={place.error} />
    </div>
  );
};

const Pieces = () => {
  const t = useTranslations("nexus.admin.journal");
  const tk = useTranslations("nexus.admin.kit");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const issues = useIssues();
  const [issueId, setIssueId] = useState("");
  const pieces = useQuery({
    queryFn: async () => {
      let query = supabase
        .schema("journal")
        .from("pieces")
        .select(
          "id, issue_id, title_en, title_ar, category, status, sort, contributor:contributors(name_en, name_ar)"
        )
        .order("sort");
      if (issueId === "none") {
        query = query.is("issue_id", null);
      } else if (issueId) {
        query = query.eq("issue_id", issueId);
      }
      return unwrap(await query) ?? [];
    },
    queryKey: [...key, "pieces", issueId],
  });
  type Row = NonNullable<typeof pieces.data>[number];
  const columns: Column<Row>[] = [
    {
      cell: (p) => (
        <Link
          className="font-medium underline underline-offset-4"
          href={{ pathname: "/admin/journal/piece", query: { id: p.id } }}
        >
          {localized(p, "title", locale)}
        </Link>
      ),
      header: t("columns.piece"),
      key: "title",
    },
    {
      cell: (p) =>
        p.contributor ? localized(p.contributor, "name", locale) : "—",
      header: t("columns.contributor"),
      key: "contributor",
    },
    {
      cell: (p) => t(`categories.${p.category as Category}`),
      header: t("columns.category"),
      key: "category",
    },
    {
      cell: (p) => tk(`statuses.${p.status as Status}`),
      header: t("columns.status"),
      key: "status",
    },
  ];
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <Field label={t("columns.issue")}>
          {(id) => (
            <SelectInput
              className="w-72"
              id={id}
              onChange={(e) => setIssueId(e.target.value)}
              value={issueId}
            >
              <option value="">{t("allIssues")}</option>
              <option value="none">{t("noIssue")}</option>
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
        <Link className={buttonLink} href="/admin/journal/piece">
          {t("newPiece")}
        </Link>
      </div>
      {pieces.data ? (
        <DataTable columns={columns} rowKey={(p) => p.id} rows={pieces.data} />
      ) : (
        <SectionSpinner />
      )}
    </div>
  );
};

const Contributors = () => {
  const t = useTranslations("nexus.admin.journal.contributor");
  const tk = useTranslations("nexus.admin.kit");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const blank = {
    bio: { ar: "", en: "" },
    id: null as string | null,
    name: { ar: "", en: "" },
    slug: "",
  };
  const [form, setForm] = useState(blank);
  const contributors = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("journal")
          .from("contributors")
          .select("*")
          .order("name_en")
      ) ?? [],
    queryKey: [...key, "contributors"],
  });
  const save = useMutation({
    mutationFn: async () => {
      const row = {
        bio_ar: form.bio.ar || null,
        bio_en: form.bio.en || null,
        name_ar: form.name.ar || null,
        name_en: form.name.en,
        slug: form.slug || slugify(form.name.en),
      };
      const table = supabase.schema("journal").from("contributors");
      unwrap(
        form.id
          ? await table.update(row).eq("id", form.id)
          : await table.insert(row)
      );
    },
    onSuccess: async () => {
      setForm(blank);
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
  return (
    <div className="grid gap-6">
      <ul className="grid gap-2">
        {contributors.data?.map((c) => (
          <li className="flex flex-wrap items-center gap-3" key={c.id}>
            <span className="font-medium">{localized(c, "name", locale)}</span>
            <Button
              onClick={() =>
                setForm({
                  bio: { ar: c.bio_ar ?? "", en: c.bio_en ?? "" },
                  id: c.id,
                  name: { ar: c.name_ar ?? "", en: c.name_en },
                  slug: c.slug,
                })
              }
              size="sm"
              variant="ghost"
            >
              {tk("edit")}
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="grid max-w-3xl gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <h3 className="type-subheading">{form.id ? t("edit") : t("new")}</h3>
        <BilingualField
          label={t("name")}
          maxLength={200}
          onChange={(name) => setForm((f) => ({ ...f, name }))}
          value={form.name}
        />
        <Field hint={tk("slugHint")} label={tk("slug")}>
          {(id) => (
            <Input
              dir="ltr"
              id={id}
              maxLength={80}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder={slugify(form.name.en)}
              value={form.slug}
            />
          )}
        </Field>
        <BilingualField
          label={t("bio")}
          maxLength={1000}
          multiline
          onChange={(bio) => setForm((f) => ({ ...f, bio }))}
          rows={3}
          value={form.bio}
        />
        <SaveButton disabled={!form.name.en.trim()} pending={save.isPending} />
        <ErrorLine error={save.error} />
      </form>
    </div>
  );
};

export const JournalAdmin = () => {
  const t = useTranslations("nexus.admin.journal");
  const accepted = useAcceptedUnplaced();
  return (
    <div className="grid gap-6">
      <AdminHeading title={t("title")}>{t("lede")}</AdminHeading>
      <Tabs defaultValue="issues">
        <TabsList className="flex-wrap">
          <TabsTrigger value="issues">{t("tabs.issues")}</TabsTrigger>
          <TabsTrigger value="accepted">
            {t("tabs.accepted", {
              count: formatNumber(accepted.data?.length ?? 0),
            })}
          </TabsTrigger>
          <TabsTrigger value="pieces">{t("tabs.pieces")}</TabsTrigger>
          <TabsTrigger value="contributors">
            {t("tabs.contributors")}
          </TabsTrigger>
        </TabsList>
        <TabsContent className="pt-4" value="issues">
          <Issues />
        </TabsContent>
        <TabsContent className="pt-4" value="accepted">
          <Accepted />
        </TabsContent>
        <TabsContent className="pt-4" value="pieces">
          <Pieces />
        </TabsContent>
        <TabsContent className="pt-4" value="contributors">
          <Contributors />
        </TabsContent>
      </Tabs>
    </div>
  );
};
