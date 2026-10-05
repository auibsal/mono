"use client";

import { useAuth } from "@repo/auth/provider";
import { scopesFor } from "@repo/rbac";
import { localized, unwrap } from "@repo/sal-data";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { useGrants } from "@/lib/queries";

/** Programmes, limited to the ones a permission covers (all for a global grant). */
export const useProgrammeOptions = (
  permission: "events.manage" | "programmes.manage" = "events.manage"
) => {
  const { supabase } = useAuth();
  const locale = useLocale();
  const grants = useGrants();
  const programmes = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("core")
          .from("programmes")
          .select("id, slug, name_en, name_ar")
          .order("sort")
      ) ?? [],
    queryKey: ["admin", "programmes"],
  });
  const scopes = scopesFor(grants.data, permission, "programme");
  const options = (programmes.data ?? [])
    .filter((p) => scopes === "all" || scopes.includes(p.id))
    .map((p) => ({ id: p.id, label: localized(p, "name", locale) }));
  return {
    canChooseNone: scopes === "all",
    isPending: programmes.isPending || grants.isPending,
    label: (id: string | null) =>
      (programmes.data ?? []).find((p) => p.id === id)
        ? localized(
            (programmes.data ?? []).find((p) => p.id === id) as Record<
              string,
              unknown
            >,
            "name",
            locale
          )
        : null,
    options,
  };
};

export const adminEventColumns =
  "id, slug, programme_id, title_en, title_ar, starts_at, ends_at, members_only, capacity, rsvp_enabled, status";
