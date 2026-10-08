"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import { Input } from "@repo/design-system/components/ui/input";
import type { Locale } from "@repo/internationalization";
import {
  formatDateTime,
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { hasPermission, type ScopeType, scopeTypes } from "@repo/rbac";
import { access, localized, membership, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useGrants } from "@/lib/queries";
import { useQueryParam } from "@/lib/use-query-param";
import { ErrorState, SectionSpinner } from "../../states";
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
import { memberName, useDirectory } from "./directory";

// ── Scope options (programs, Journal issues, campaigns) ─────────────────────

const useScopeOptions = () => {
  const { supabase } = useAuth();
  const locale = useLocale();
  return useQuery({
    queryFn: async () => {
      const [programmes, issues, campaigns] = await Promise.all([
        supabase
          .schema("core")
          .from("programmes")
          .select("id, name_en, name_ar")
          .order("sort"),
        supabase
          .schema("journal")
          .from("issues")
          .select("id, volume, number, title_en, title_ar")
          .order("volume", { ascending: false })
          .order("number", { ascending: false }),
        supabase
          .schema("charity")
          .from("campaigns")
          .select("id, title_en, title_ar")
          .order("created_at", { ascending: false }),
      ]);
      const options: Record<
        Exclude<ScopeType, "global">,
        { id: string; label: string }[]
      > = {
        campaign: (unwrap(campaigns) ?? []).map((c) => ({
          id: c.id,
          label: localized(c, "title", locale),
        })),
        issue: (unwrap(issues) ?? []).map((i) => ({
          id: i.id,
          label: `${i.volume}.${i.number} · ${localized(i, "title", locale)}`,
        })),
        programme: (unwrap(programmes) ?? []).map((p) => ({
          id: p.id,
          label: localized(p, "name", locale),
        })),
      };
      return options;
    },
    queryKey: ["admin", "scope-options", locale],
  });
};

// ── Tier ────────────────────────────────────────────────────────────────────

const TierForm = ({
  tier,
  userId,
}: {
  tier: membership.Tier;
  userId: string;
}) => {
  const t = useTranslations("nexus.admin.member");
  const tt = useTranslations("nexus.home.tiers");
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(tier);
  const save = useMutation({
    mutationFn: () => membership.setTier(supabase, userId, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={submit}>
      <Field label={t("tier")}>
        {(id) => (
          <SelectInput
            className="w-48"
            id={id}
            onChange={(e) => setValue(e.target.value as membership.Tier)}
            value={value}
          >
            {membership.tiers.map((option) => (
              <option key={option} value={option}>
                {tt(option)}
              </option>
            ))}
          </SelectInput>
        )}
      </Field>
      <SaveButton
        disabled={value === tier}
        pending={save.isPending}
        success={save.isSuccess && value === tier}
      />
      <ErrorLine error={save.error} />
    </form>
  );
};

// ── Activity records ────────────────────────────────────────────────────────

const ActivitySection = ({ userId }: { userId: string }) => {
  const t = useTranslations("nexus.admin.member");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [when, setWhen] = useState<string | null>(new Date().toISOString());

  const records = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("membership")
          .from("activity_records")
          .select("id, kind, occurred_at, note")
          .eq("user_id", userId)
          .order("occurred_at", { ascending: false })
      ) ?? [],
    queryKey: ["admin", "activity-records", userId],
  });

  const add = useMutation({
    mutationFn: () =>
      membership.addManualActivity(supabase, {
        note,
        occurred_at: when ?? new Date().toISOString(),
        target_user: userId,
      }),
    onSuccess: async () => {
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });

  type Record = NonNullable<typeof records.data>[number];
  const columns: Column<Record>[] = [
    {
      cell: (r) => formatDateTime(r.occurred_at, locale),
      className: "whitespace-nowrap",
      header: t("when"),
      key: "when",
    },
    {
      cell: (r) => t(`kinds.${r.kind as "check_in" | "shift" | "manual"}`),
      header: t("activity"),
      key: "kind",
    },
    { cell: (r) => r.note ?? "", header: t("note"), key: "note" },
  ];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (note.trim()) {
      add.mutate();
    }
  };

  return (
    <section className="grid gap-4">
      <h2 className="type-heading">{t("activity")}</h2>
      <p className="type-body text-text-secondary">{t("activityLede")}</p>
      {records.isPending ? <SectionSpinner /> : null}
      {records.data ? (
        <DataTable columns={columns} rowKey={(r) => r.id} rows={records.data} />
      ) : null}
      <form className="grid max-w-2xl gap-3" onSubmit={submit}>
        <h3 className="type-subheading">{t("addActivity")}</h3>
        <Field label={t("note")}>
          {(id) => (
            <Input
              id={id}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              required
              value={note}
            />
          )}
        </Field>
        <DateTimeField
          label={t("when")}
          onChange={setWhen}
          required
          value={when}
        />
        <SaveButton pending={add.isPending} />
        <ErrorLine error={add.error} />
      </form>
    </section>
  );
};

// ── Roles ───────────────────────────────────────────────────────────────────

const RolesSection = ({ name, userId }: { name: string; userId: string }) => {
  const t = useTranslations("nexus.admin.member");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const grants = useGrants();
  const canAssign = hasPermission(grants.data, "roles.assign");
  const roles = useQuery({
    queryFn: () => access.roles(supabase),
    queryKey: ["admin", "roles"],
  });
  const scopes = useScopeOptions();
  const assignments = useQuery({
    queryFn: () => access.assignmentsFor(supabase, userId),
    queryKey: ["admin", "assignments", userId],
  });

  const empty = {
    ends_at: null as string | null,
    note: "",
    role_key: "",
    scope_id: "",
    scope_type: "global" as ScopeType,
    starts_at: new Date().toISOString(),
    title: { ar: "", en: "" },
  };
  const [form, setForm] = useState(empty);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin"] });
  const assign = useMutation({
    mutationFn: () =>
      access.assignRole(supabase, {
        ends_at: form.ends_at,
        note: form.note,
        role_key: form.role_key,
        scope_id: form.scope_type === "global" ? null : form.scope_id || null,
        scope_type: form.scope_type,
        starts_at: form.starts_at,
        target_user: userId,
        title_ar: form.title.ar,
        title_en: form.title.en,
      }),
    onSuccess: async () => {
      setForm(empty);
      await invalidate();
    },
  });
  const end = useMutation({
    mutationFn: (assignmentId: string) =>
      access.endRoleAssignment(supabase, assignmentId),
    onSuccess: invalidate,
  });

  const roleName = (key: string) => {
    const role = roles.data?.find((r) => r.key === key);
    return role ? localized(role, "name", locale) : key;
  };
  const scopeName = (type: string, id: string | null) => {
    if (type === "global" || !id) {
      return t("scopes.global");
    }
    const item = scopes.data?.[type as Exclude<ScopeType, "global">]?.find(
      (o) => o.id === id
    );
    return `${t(`scopes.${type as ScopeType}`)}: ${item?.label ?? "—"}`;
  };

  type Assignment = NonNullable<typeof assignments.data>[number];
  const now = new Date();
  const state = (a: Assignment) => {
    if (access.isActiveAssignment(a, now)) {
      return t("active");
    }
    return new Date(a.starts_at) > now ? t("upcoming") : t("ended");
  };
  const columns: Column<Assignment>[] = [
    {
      cell: (a) => (
        <span>
          {roleName(a.role)}
          {a.title_en || a.title_ar ? (
            <span className="type-caption block">
              {localized(a, "title", locale)}
            </span>
          ) : null}
        </span>
      ),
      header: t("role"),
      key: "role",
    },
    {
      cell: (a) => scopeName(a.scope_type, a.scope_id),
      header: t("scope"),
      key: "scope",
    },
    {
      cell: (a) => formatLongDate(a.starts_at, locale, true),
      className: "whitespace-nowrap",
      header: t("starts"),
      key: "starts",
    },
    {
      cell: (a) => (a.ends_at ? formatLongDate(a.ends_at, locale, true) : "—"),
      className: "whitespace-nowrap",
      header: t("ends"),
      key: "ends",
    },
    { cell: state, header: "", key: "state" },
    {
      cell: (a) =>
        canAssign && access.isActiveAssignment(a, now) ? (
          <ConfirmAction
            confirmLabel={t("endRole")}
            description={t("endRoleConfirm")}
            disabled={end.isPending}
            onConfirm={() => end.mutate(a.id)}
          >
            {t("endRole")}
          </ConfirmAction>
        ) : null,
      header: "",
      key: "actions",
    },
  ];

  const scopeChoices =
    form.scope_type === "global" ? [] : (scopes.data?.[form.scope_type] ?? []);
  const ready =
    form.role_key !== "" &&
    (form.scope_type === "global" || form.scope_id !== "");

  return (
    <section className="grid gap-4">
      <h2 className="type-heading">{t("roles")}</h2>
      <p className="type-body text-text-secondary">{t("rolesLede")}</p>
      {assignments.isPending ? <SectionSpinner /> : null}
      {assignments.data ? (
        <DataTable
          columns={columns}
          empty={t("noRoles")}
          rowKey={(a) => a.id}
          rows={assignments.data}
        />
      ) : null}
      {canAssign ? (
        <form
          className="grid max-w-3xl gap-4"
          onSubmit={(event) => event.preventDefault()}
        >
          <h3 className="type-subheading">{t("assign")}</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("role")}>
              {(id) => (
                <SelectInput
                  id={id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, role_key: e.target.value }))
                  }
                  required
                  value={form.role_key}
                >
                  <option value="">{t("choose")}</option>
                  {roles.data?.map((role) => (
                    <option key={role.key} value={role.key}>
                      {localized(role, "name", locale)}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
            <Field label={t("scope")}>
              {(id) => (
                <SelectInput
                  id={id}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      scope_id: "",
                      scope_type: e.target.value as ScopeType,
                    }))
                  }
                  value={form.scope_type}
                >
                  {scopeTypes.map((type) => (
                    <option key={type} value={type}>
                      {t(`scopes.${type}`)}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
            {form.scope_type === "global" ? null : (
              <Field label={t("scopeItem")}>
                {(id) => (
                  <SelectInput
                    id={id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, scope_id: e.target.value }))
                    }
                    required
                    value={form.scope_id}
                  >
                    <option value="">{t("choose")}</option>
                    {scopeChoices.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </SelectInput>
                )}
              </Field>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DateTimeField
              label={t("starts")}
              onChange={(v) =>
                setForm((f) => ({ ...f, starts_at: v ?? f.starts_at }))
              }
              required
              value={form.starts_at}
            />
            <DateTimeField
              label={t("ends")}
              onChange={(v) => setForm((f) => ({ ...f, ends_at: v }))}
              value={form.ends_at}
            />
          </div>
          <BilingualField
            label={t("titleLabel")}
            maxLength={120}
            onChange={(title) => setForm((f) => ({ ...f, title }))}
            value={form.title}
          />
          <Field label={t("note")}>
            {(id) => (
              <Input
                id={id}
                maxLength={500}
                onChange={(e) =>
                  setForm((f) => ({ ...f, note: e.target.value }))
                }
                value={form.note}
              />
            )}
          </Field>
          <div>
            <ConfirmAction
              confirmLabel={t("assignButton")}
              description={t("assignConfirm", {
                name,
                role: roleName(form.role_key),
              })}
              disabled={!ready || assign.isPending}
              onConfirm={() => assign.mutate()}
              variant="default"
            >
              {t("assignButton")}
            </ConfirmAction>
          </div>
          <ErrorLine error={assign.error ?? end.error} />
        </form>
      ) : null}
    </section>
  );
};

// ── Page ────────────────────────────────────────────────────────────────────

export const MemberDetail = () => {
  const t = useTranslations("nexus.admin.member");
  const tm = useTranslations("nexus.admin.members");
  const tk = useTranslations("nexus.admin.kit");
  const th = useTranslations("nexus.home");
  const locale = useLocale() as Locale;
  const userId = useQueryParam("id");
  const grants = useGrants();
  const directory = useDirectory();

  if (directory.isPending) {
    return <SectionSpinner />;
  }
  if (directory.isError) {
    return <ErrorState onRetry={() => directory.refetch()} />;
  }

  const row = directory.data.find((r) => r.user_id === userId);
  if (!(row && userId)) {
    return <p className="type-body text-text-secondary">{t("notFound")}</p>;
  }
  const name = memberName(row, locale) || tm("unnamed");
  const canManage = hasPermission(grants.data, "members.manage");

  return (
    <div className="grid gap-10">
      <AdminHeading
        actions={
          <Link
            className="text-sm underline underline-offset-4"
            href="/admin/members"
          >
            {tk("back")}
          </Link>
        }
        title={name}
      >
        <span dir="ltr">{row.email}</span>
      </AdminHeading>
      <SalCard>
        <dl className="grid gap-3 sm:grid-cols-4">
          <div>
            <dt className="type-kicker">{tm("columns.since")}</dt>
            <dd>
              {row.member_since
                ? formatLongDate(row.member_since, locale, true)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="type-kicker">{tm("columns.status")}</dt>
            <dd>{row.verified_at ? tm("verified") : tm("unverified")}</dd>
          </div>
          <div>
            <dt className="type-kicker">{tm("columns.activities")}</dt>
            <dd className="tabular-nums">{formatNumber(row.activities)}</dd>
          </div>
          <div>
            <dt className="type-kicker">{tm("columns.voting")}</dt>
            <dd>
              {row.voting_member ? th("card.voting") : th("card.notVoting")}
            </dd>
          </div>
        </dl>
      </SalCard>
      {canManage && row.tier ? (
        <TierForm tier={row.tier} userId={userId} />
      ) : null}
      {canManage ? <ActivitySection userId={userId} /> : null}
      <RolesSection name={name} userId={userId} />
    </div>
  );
};
