"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { unwrap } from "@repo/sal-data";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useDeferredValue, useState } from "react";
import { Field } from "./kit";
import { memberName } from "./members/directory";

interface Person {
  full_name_ar: string | null;
  full_name_en: string;
  id: string;
}

/** Names of verified members (readable by any verified member under RLS). */
export const useMemberNames = (ids: readonly (string | null | undefined)[]) => {
  const { supabase } = useAuth();
  const wanted = [
    ...new Set(ids.filter((id): id is string => Boolean(id))),
  ].sort();
  return useQuery({
    enabled: wanted.length > 0,
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("core")
          .from("profiles")
          .select("id, full_name_en, full_name_ar")
          .in("id", wanted)
      ) ?? [],
    queryKey: ["admin", "member-names", wanted],
  });
};

const FILTER_SYNTAX = /[%,()"\\*.:]/g;

/** Drops characters that mean something in a PostgREST filter. */
export const safe = (value: string) => value.replace(FILTER_SYNTAX, " ").trim();

interface MemberPickerProps {
  readonly excludeId?: string;
  readonly label: string;
  readonly onChange: (person: Person | null) => void;
  readonly value: Person | null;
}

/** Find a verified member by name (no emails: plain member access). */
export const MemberPicker = ({
  excludeId,
  label,
  onChange,
  value,
}: MemberPickerProps) => {
  const t = useTranslations("nexus.admin.picker");
  const locale = useLocale();
  const { supabase } = useAuth();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim());
  const results = useQuery({
    enabled: deferred.length >= 2,
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("core")
          .from("profiles")
          .select("id, full_name_en, full_name_ar")
          .not("verified_at", "is", null)
          .or(
            `full_name_en.ilike.%${safe(deferred)}%,full_name_ar.ilike.%${safe(deferred)}%`
          )
          .order("full_name_en")
          .limit(10)
      ) ?? [],
    queryKey: ["admin", "picker", deferred],
  });

  if (value) {
    return (
      <div className="grid gap-2">
        <span className="font-medium text-sm">{label}</span>
        <div className="flex items-center gap-3">
          <span>{memberName(value, locale)}</span>
          <Button
            onClick={() => onChange(null)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t("change")}
          </Button>
        </div>
      </div>
    );
  }

  const people = (results.data ?? []).filter((p) => p.id !== excludeId);
  return (
    <div className="grid gap-2">
      <Field hint={t("hint")} label={label}>
        {(id) => (
          <Input
            id={id}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            type="search"
            value={query}
          />
        )}
      </Field>
      {deferred.length >= 2 && results.data && people.length === 0 ? (
        <p className="type-caption">{t("none")}</p>
      ) : null}
      <ul className="grid gap-1">
        {people.map((person) => (
          <li className="flex items-center gap-3" key={person.id}>
            <span>{memberName(person, locale)}</span>
            <Button
              onClick={() => onChange(person)}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("choose")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
};
