"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import type { Locale } from "@repo/internationalization";
import { formatLongDate } from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { content, localized, unwrap } from "@repo/sal-data";
import { getMediaUrl, removeFiles, uploadMedia } from "@repo/storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { SectionSpinner } from "../../states";
import {
  AdminHeading,
  BilingualField,
  type Column,
  ConfirmAction,
  DataTable,
  DateTimeField,
  ErrorLine,
  Field,
  SaveButton,
  SelectInput,
} from "../kit";

const linkClass = "font-medium underline underline-offset-4";
const buttonLink =
  "inline-flex h-8 items-center justify-self-start rounded-md bg-primary px-3 text-primary-foreground text-sm";

// ── News and pages ──────────────────────────────────────────────────────────

const NewsList = () => {
  const t = useTranslations("nexus.admin.content");
  const tk = useTranslations("nexus.admin.kit");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const news = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("content")
          .from("news_posts")
          .select(
            "id, title_en, title_ar, status, published_at, publish_at, updated_at"
          )
          .order("updated_at", { ascending: false })
          .limit(200)
      ) ?? [],
    queryKey: ["admin", "news-list"],
  });
  type Row = NonNullable<typeof news.data>[number];
  const columns: Column<Row>[] = [
    {
      cell: (n) => (
        <Link
          className={linkClass}
          href={{ pathname: "/admin/content/news", query: { id: n.id } }}
        >
          {localized(n, "title", locale)}
        </Link>
      ),
      header: t("columns.title"),
      key: "title",
    },
    {
      cell: (n) =>
        tk(`statuses.${n.status as "draft" | "scheduled" | "published"}`),
      header: t("columns.status"),
      key: "status",
    },
    {
      cell: (n) => {
        const date = n.published_at ?? n.publish_at ?? n.updated_at;
        return formatLongDate(date, locale, true);
      },
      className: "whitespace-nowrap",
      header: t("columns.date"),
      key: "date",
    },
  ];
  return (
    <div className="grid gap-4">
      <Link className={buttonLink} href="/admin/content/news">
        {t("newNews")}
      </Link>
      {news.isPending ? <SectionSpinner /> : null}
      {news.data ? (
        <DataTable columns={columns} rowKey={(n) => n.id} rows={news.data} />
      ) : null}
    </div>
  );
};

const PagesList = () => {
  const t = useTranslations("nexus.admin.content");
  const tk = useTranslations("nexus.admin.kit");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const pages = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("content")
          .from("pages")
          .select("id, slug, title_en, title_ar, status")
          .order("slug")
      ) ?? [],
    queryKey: ["admin", "pages-list"],
  });
  type Row = NonNullable<typeof pages.data>[number];
  const columns: Column<Row>[] = [
    {
      cell: (p) => (
        <Link
          className={linkClass}
          href={{ pathname: "/admin/content/page", query: { id: p.id } }}
        >
          {localized(p, "title", locale)}
        </Link>
      ),
      header: t("columns.title"),
      key: "title",
    },
    {
      cell: (p) => (
        <span className="type-code" dir="ltr">
          /{p.slug}
        </span>
      ),
      header: t("columns.slug"),
      key: "slug",
    },
    {
      cell: (p) => tk(`statuses.${p.status as "draft" | "published"}`),
      header: t("columns.status"),
      key: "status",
    },
  ];
  return (
    <div className="grid gap-4">
      <Link className={buttonLink} href="/admin/content/page">
        {t("newPage")}
      </Link>
      {pages.isPending ? <SectionSpinner /> : null}
      {pages.data ? (
        <DataTable columns={columns} rowKey={(p) => p.id} rows={pages.data} />
      ) : null}
    </div>
  );
};

// ── Announcements ───────────────────────────────────────────────────────────

interface AnnouncementForm {
  audience: "public" | "members";
  body: { ar: string; en: string };
  ends_at: string | null;
  id: string | null;
  is_banner: boolean;
  link: string;
  starts_at: string | null;
  title: { ar: string; en: string };
}

const blankAnnouncement = (): AnnouncementForm => ({
  audience: "members",
  body: { ar: "", en: "" },
  ends_at: null,
  id: null,
  is_banner: false,
  link: "",
  starts_at: new Date().toISOString(),
  title: { ar: "", en: "" },
});

const announcementProblem = (field: string, message: string) => {
  if (message === "banner_public") {
    return "errors.banner_public" as const;
  }
  if (message === "ends_before_start") {
    return "errors.ends_before_start" as const;
  }
  if (field === "link") {
    return "errors.link" as const;
  }
  return "errors.title" as const;
};

const Announcements = () => {
  const t = useTranslations("nexus.admin.content");
  const ta = useTranslations("nexus.admin.content.announcement");
  const locale = useLocale() as Locale;
  const id = useId();
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AnnouncementForm>(blankAnnouncement);
  const [problem, setProblem] = useState<string | null>(null);

  const list = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("content")
          .from("announcements")
          .select("*")
          .order("starts_at", { ascending: false })
          .limit(100)
      ) ?? [],
    queryKey: ["admin", "announcements"],
  });

  const save = useMutation({
    mutationFn: async () => {
      const parsed = content.announcementSchema.safeParse({
        audience: form.audience,
        body_ar: form.body.ar || undefined,
        body_en: form.body.en || undefined,
        ends_at: form.ends_at,
        is_banner: form.is_banner,
        link: form.link.trim() || null,
        starts_at: form.starts_at ?? new Date().toISOString(),
        title_ar: form.title.ar,
        title_en: form.title.en,
      });
      if (!parsed.success) {
        const [issue] = parsed.error.issues;
        setProblem(
          t(
            announcementProblem(
              String(issue?.path[0] ?? ""),
              issue?.message ?? ""
            )
          )
        );
        throw new Error("invalid");
      }
      setProblem(null);
      const row = {
        ...parsed.data,
        body_ar: parsed.data.body_ar ?? null,
        body_en: parsed.data.body_en ?? null,
      };
      const table = supabase.schema("content").from("announcements");
      unwrap(
        form.id
          ? await table.update(row).eq("id", form.id)
          : await table.insert(row)
      );
    },
    onSuccess: async () => {
      setForm(blankAnnouncement());
      await queryClient.invalidateQueries({
        queryKey: ["admin", "announcements"],
      });
    },
  });
  const remove = useMutation({
    mutationFn: async (announcementId: string) =>
      unwrap(
        await supabase
          .schema("content")
          .from("announcements")
          .delete()
          .eq("id", announcementId)
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "announcements"] }),
  });

  type Row = NonNullable<typeof list.data>[number];
  const columns: Column<Row>[] = [
    {
      cell: (a) => (
        <button
          className={linkClass}
          onClick={() =>
            setForm({
              audience: a.audience as "public" | "members",
              body: { ar: a.body_ar ?? "", en: a.body_en ?? "" },
              ends_at: a.ends_at,
              id: a.id,
              is_banner: a.is_banner,
              link: a.link ?? "",
              starts_at: a.starts_at,
              title: { ar: a.title_ar, en: a.title_en },
            })
          }
          type="button"
        >
          {localized(a, "title", locale)}
        </button>
      ),
      header: t("columns.title"),
      key: "title",
    },
    {
      cell: (a) =>
        a.is_banner ? ta("banner") : ta(a.audience as "public" | "members"),
      header: t("columns.audience"),
      key: "audience",
    },
    {
      cell: (a) =>
        `${formatLongDate(a.starts_at, locale)} – ${a.ends_at ? formatLongDate(a.ends_at, locale) : ta("always")}`,
      header: t("columns.window"),
      key: "window",
    },
    {
      cell: (a) => (
        <ConfirmAction
          confirmLabel={t("delete")}
          description={t("deleteConfirm")}
          disabled={remove.isPending}
          onConfirm={() => remove.mutate(a.id)}
          variant="ghost"
        >
          {t("delete")}
        </ConfirmAction>
      ),
      header: "",
      key: "actions",
    },
  ];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  return (
    <div className="grid gap-6">
      {list.isPending ? <SectionSpinner /> : null}
      {list.data ? (
        <DataTable columns={columns} rowKey={(a) => a.id} rows={list.data} />
      ) : null}
      <form className="grid max-w-3xl gap-4" onSubmit={submit}>
        <h3 className="type-subheading">{form.id ? ta("edit") : ta("new")}</h3>
        <BilingualField
          label={t("titleField")}
          maxLength={200}
          onChange={(title) => setForm((f) => ({ ...f, title }))}
          required
          value={form.title}
        />
        <BilingualField
          label={ta("body")}
          maxLength={2000}
          multiline
          onChange={(body) => setForm((f) => ({ ...f, body }))}
          rows={3}
          value={form.body}
        />
        <Field label={ta("link")}>
          {(fieldId) => (
            <Input
              dir="ltr"
              id={fieldId}
              onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
              type="url"
              value={form.link}
            />
          )}
        </Field>
        <Field label={ta("audience")}>
          {(fieldId) => (
            <SelectInput
              id={fieldId}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  audience: e.target.value as "public" | "members",
                  is_banner: e.target.value === "public" && f.is_banner,
                }))
              }
              value={form.audience}
            >
              <option value="members">{ta("members")}</option>
              <option value="public">{ta("public")}</option>
            </SelectInput>
          )}
        </Field>
        {form.audience === "public" ? (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={form.is_banner}
              id={`${id}-banner`}
              onCheckedChange={(v) =>
                setForm((f) => ({ ...f, is_banner: v === true }))
              }
            />
            <Label htmlFor={`${id}-banner`}>{ta("banner")}</Label>
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <DateTimeField
            label={ta("starts")}
            onChange={(starts_at) => setForm((f) => ({ ...f, starts_at }))}
            required
            value={form.starts_at}
          />
          <DateTimeField
            label={ta("ends")}
            onChange={(ends_at) => setForm((f) => ({ ...f, ends_at }))}
            value={form.ends_at}
          />
        </div>
        {problem ? (
          <p className="text-sm text-title" role="alert">
            {problem}
          </p>
        ) : null}
        {save.error && save.error.message !== "invalid" ? (
          <ErrorLine error={save.error} />
        ) : null}
        <div className="flex gap-3">
          <SaveButton pending={save.isPending} />
          {form.id ? (
            <Button
              onClick={() => setForm(blankAnnouncement())}
              type="button"
              variant="ghost"
            >
              {ta("new")}
            </Button>
          ) : null}
        </div>
        <ErrorLine error={remove.error} />
      </form>
    </div>
  );
};

// ── Homepage slots ──────────────────────────────────────────────────────────

type SlotKey = (typeof content.homepageSlotKeys)[number];
type RefType = (typeof content.slotRefTypes)[number];

const refTables: Record<
  RefType,
  { schema: string; table: string; title: string }
> = {
  call: { schema: "journal", table: "calls", title: "title" },
  campaign: { schema: "charity", table: "campaigns", title: "title" },
  event: { schema: "events", table: "events", title: "title" },
  issue: { schema: "journal", table: "issues", title: "title" },
  news: { schema: "content", table: "news_posts", title: "title" },
  page: { schema: "content", table: "pages", title: "title" },
  piece: { schema: "journal", table: "pieces", title: "title" },
};

const SlotEditor = ({
  slot,
  slotKey,
}: {
  slot?: {
    body_ar: string | null;
    body_en: string | null;
    link: string | null;
    ref_id: string | null;
    ref_type: string | null;
    title_ar: string | null;
    title_en: string | null;
  };
  slotKey: SlotKey;
}) => {
  const t = useTranslations("nexus.admin.content.slots");
  const tc = useTranslations("nexus.admin.content");
  const tm = useTranslations("nexus.admin.member");
  const locale = useLocale();
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    body: { ar: slot?.body_ar ?? "", en: slot?.body_en ?? "" },
    link: slot?.link ?? "",
    ref_id: slot?.ref_id ?? "",
    ref_type: (slot?.ref_type ?? "") as RefType | "",
    title: { ar: slot?.title_ar ?? "", en: slot?.title_en ?? "" },
  });

  const refs = useQuery({
    enabled: form.ref_type !== "",
    queryFn: async () => {
      const ref = refTables[form.ref_type as RefType];
      // biome-ignore lint/suspicious/noExplicitAny: the table comes from a fixed list
      const db = supabase.schema(ref.schema as any) as any;
      const { data } = await db
        .from(ref.table)
        .select("id, title_en, title_ar")
        .order("created_at", { ascending: false })
        .limit(100);
      return (data ?? []) as {
        id: string;
        title_ar: string;
        title_en: string;
      }[];
    },
    queryKey: ["admin", "slot-refs", form.ref_type],
  });

  const save = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase
          .schema("content")
          .from("homepage_slots")
          .upsert({
            body_ar: form.body.ar || null,
            body_en: form.body.en || null,
            key: slotKey,
            link: form.link.trim() || null,
            ref_id: form.ref_type ? form.ref_id || null : null,
            ref_type: form.ref_type || null,
            sort: content.homepageSlotKeys.indexOf(slotKey),
            title_ar: form.title.ar || null,
            title_en: form.title.en || null,
          })
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "slots"] }),
  });
  const clear = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase
          .schema("content")
          .from("homepage_slots")
          .delete()
          .eq("key", slotKey)
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "slots"] }),
  });

  return (
    <SalCard>
      <h3 className="type-subheading">{t(`keys.${slotKey}`)}</h3>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        {slotKey === "hero_note" ? null : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("refType")}>
              {(fieldId) => (
                <SelectInput
                  id={fieldId}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      ref_id: "",
                      ref_type: e.target.value as RefType | "",
                    }))
                  }
                  value={form.ref_type}
                >
                  <option value="">{t("none")}</option>
                  {content.slotRefTypes.map((type) => (
                    <option key={type} value={type}>
                      {t(`refTypes.${type}`)}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
            {form.ref_type ? (
              <Field label={t("refId")}>
                {(fieldId) => (
                  <SelectInput
                    id={fieldId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, ref_id: e.target.value }))
                    }
                    value={form.ref_id}
                  >
                    <option value="">{tm("choose")}</option>
                    {refs.data?.map((ref) => (
                      <option key={ref.id} value={ref.id}>
                        {localized(ref, "title", locale)}
                      </option>
                    ))}
                  </SelectInput>
                )}
              </Field>
            ) : null}
          </div>
        )}
        <BilingualField
          label={tc("titleField")}
          maxLength={200}
          onChange={(title) => setForm((f) => ({ ...f, title }))}
          value={form.title}
        />
        <BilingualField
          label={t("text")}
          maxLength={500}
          multiline
          onChange={(body) => setForm((f) => ({ ...f, body }))}
          rows={2}
          value={form.body}
        />
        <Field label={t("link")}>
          {(fieldId) => (
            <Input
              dir="ltr"
              id={fieldId}
              onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
              value={form.link}
            />
          )}
        </Field>
        <div className="flex gap-3">
          <SaveButton pending={save.isPending} success={save.isSuccess} />
          {slot ? (
            <ConfirmAction
              confirmLabel={t("clear")}
              description={tc("deleteConfirm")}
              disabled={clear.isPending}
              onConfirm={() => clear.mutate()}
              variant="ghost"
            >
              {t("clear")}
            </ConfirmAction>
          ) : null}
        </div>
        <ErrorLine error={save.error ?? clear.error} />
      </form>
    </SalCard>
  );
};

const HomepageSlots = () => {
  const t = useTranslations("nexus.admin.content.slots");
  const { supabase } = useAuth();
  const slots = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase.schema("content").from("homepage_slots").select("*")
      ) ?? [],
    queryKey: ["admin", "slots"],
  });
  if (slots.isPending) {
    return <SectionSpinner />;
  }
  return (
    <div className="grid gap-gap">
      <p className="type-body text-text-secondary">{t("lede")}</p>
      {content.homepageSlotKeys.map((key) => (
        <SlotEditor
          key={key}
          slot={slots.data?.find((s) => s.key === key)}
          slotKey={key}
        />
      ))}
    </div>
  );
};

// ── Media library ───────────────────────────────────────────────────────────

const MediaLibrary = () => {
  const t = useTranslations("nexus.admin.content.media");
  const tk = useTranslations("nexus.admin.kit");
  const tcommon = useTranslations("common");
  const locale = useLocale();
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState({ ar: "", en: "" });
  const [consent, setConsent] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const assets = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("content")
          .from("media_assets")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200)
      ) ?? [],
    queryKey: ["admin", "media"],
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!file) {
        return;
      }
      const stored = await uploadMedia(supabase, "library", file);
      unwrap(
        await supabase
          .schema("content")
          .from("media_assets")
          .insert({
            alt_ar: alt.ar,
            alt_en: alt.en,
            consent_note: consent.trim() || null,
            mime_type: stored.type,
            storage_path: stored.path,
          })
      );
    },
    onSuccess: async () => {
      setFile(null);
      setAlt({ ar: "", en: "" });
      setConsent("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "media"] });
    },
  });
  const remove = useMutation({
    mutationFn: async (asset: { id: string; storage_path: string }) => {
      await removeFiles(supabase, "media", [asset.storage_path]);
      unwrap(
        await supabase
          .schema("content")
          .from("media_assets")
          .delete()
          .eq("id", asset.id)
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "media"] }),
  });

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(url);
  };

  return (
    <div className="grid gap-6">
      <p className="type-body text-text-secondary">{t("lede")}</p>
      <form
        className="grid max-w-3xl gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <h3 className="type-subheading">{t("upload")}</h3>
        <Field label={tk("image")}>
          {(fieldId) => (
            <Input
              accept="image/jpeg,image/png,image/webp"
              id={fieldId}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
              type="file"
            />
          )}
        </Field>
        <BilingualField
          label={t("alt")}
          maxLength={300}
          onChange={setAlt}
          required
          value={alt}
        />
        <Field label={t("consent")}>
          {(fieldId) => (
            <Textarea
              id={fieldId}
              maxLength={1000}
              onChange={(e) => setConsent(e.target.value)}
              rows={2}
              value={consent}
            />
          )}
        </Field>
        <SaveButton disabled={!file} pending={add.isPending} />
        <ErrorLine error={add.error} />
      </form>
      {assets.isPending ? <SectionSpinner /> : null}
      {assets.data?.length === 0 ? (
        <p className="type-body text-text-secondary">{t("empty")}</p>
      ) : null}
      <ul className="grid gap-gap sm:grid-cols-2 lg:grid-cols-3">
        {assets.data?.map((asset) => {
          const url = getMediaUrl(supabase, asset.storage_path);
          return (
            <li key={asset.id}>
              <SalCard>
                {/* biome-ignore lint/performance/noImgElement: thumbnails from the public media bucket */}
                <img
                  alt={localized(asset, "alt", locale)}
                  className="aspect-[4/3] w-full rounded-card object-cover"
                  height={240}
                  src={url}
                  width={320}
                />
                <p className="type-caption">
                  {localized(asset, "alt", locale)}
                </p>
                {asset.consent_note ? (
                  <p className="type-caption">{asset.consent_note}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => copy(url)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {copied === url ? tcommon("copied") : t("copy")}
                  </Button>
                  <ConfirmAction
                    confirmLabel={t("remove")}
                    description={t("removeConfirm")}
                    disabled={remove.isPending}
                    onConfirm={() => remove.mutate(asset)}
                    variant="ghost"
                  >
                    {t("remove")}
                  </ConfirmAction>
                </div>
              </SalCard>
            </li>
          );
        })}
      </ul>
      <ErrorLine error={remove.error} />
    </div>
  );
};

// ── Page ────────────────────────────────────────────────────────────────────

export const ContentAdmin = () => {
  const t = useTranslations("nexus.admin.content");
  return (
    <div className="grid gap-6">
      <AdminHeading title={t("title")}>{t("lede")}</AdminHeading>
      <Tabs defaultValue="news">
        <TabsList className="flex-wrap">
          <TabsTrigger value="news">{t("tabs.news")}</TabsTrigger>
          <TabsTrigger value="pages">{t("tabs.pages")}</TabsTrigger>
          <TabsTrigger value="announcements">
            {t("tabs.announcements")}
          </TabsTrigger>
          <TabsTrigger value="homepage">{t("tabs.homepage")}</TabsTrigger>
          <TabsTrigger value="media">{t("tabs.media")}</TabsTrigger>
        </TabsList>
        <TabsContent className="pt-4" value="news">
          <NewsList />
        </TabsContent>
        <TabsContent className="pt-4" value="pages">
          <PagesList />
        </TabsContent>
        <TabsContent className="pt-4" value="announcements">
          <Announcements />
        </TabsContent>
        <TabsContent className="pt-4" value="homepage">
          <HomepageSlots />
        </TabsContent>
        <TabsContent className="pt-4" value="media">
          <MediaLibrary />
        </TabsContent>
      </Tabs>
    </div>
  );
};
