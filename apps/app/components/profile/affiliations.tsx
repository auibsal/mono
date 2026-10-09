"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { localized, partners, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { ErrorLine } from "../admin/kit";

const KEY = ["affiliations"];

/**
 * Profile: the partner organizations a person belongs to. The Society
 * verifies each one; it unlocks only what that partner's memorandum grants
 * (for example, sending work to the Journal). Hidden when no partner
 * currently accepts affiliations.
 */
export const Affiliations = () => {
  const t = useTranslations("nexus.profile.affiliations");
  const locale = useLocale();
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const id = useId();
  const [partnerId, setPartnerId] = useState("");
  const [note, setNote] = useState("");

  const joinable = useQuery({
    queryFn: () => partners.joinablePartners(supabase),
    queryKey: [...KEY, "joinable"],
  });
  const mine = useQuery({
    queryFn: () => partners.myAffiliations(supabase),
    queryKey: [...KEY, "mine"],
  });
  const request = useMutation({
    mutationFn: () => partners.requestAffiliation(supabase, partnerId, note),
    onSuccess: async () => {
      setPartnerId("");
      setNote("");
      await queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
  const withdraw = useMutation({
    mutationFn: async (affiliationId: string) =>
      unwrap(
        await supabase
          .schema("governance")
          .from("partner_affiliations")
          .delete()
          .eq("id", affiliationId)
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });

  const options = joinable.data ?? [];
  const rows = mine.data ?? [];
  if (options.length === 0 && rows.length === 0) {
    return null;
  }
  const nameOf = (partner: string) => {
    const row = options.find((p) => p.id === partner);
    return row ? localized(row, "name", locale) : t("partner");
  };
  const taken = new Set(rows.map((r) => r.partner_id));

  return (
    <SalCard>
      <div className="grid gap-3">
        <h2 className="type-subheading">{t("title")}</h2>
        <p className="type-body">{t("description")}</p>
        {rows.length > 0 ? (
          <ul className="grid gap-2">
            {rows.map((row) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2"
                key={row.id}
              >
                <span>
                  {nameOf(row.partner_id)} ·{" "}
                  <span className="type-caption">
                    {t(
                      `statuses.${row.status as "pending" | "verified" | "declined" | "ended"}`
                    )}
                  </span>
                </span>
                {row.status === "pending" ? (
                  <Button
                    disabled={withdraw.isPending}
                    onClick={() => withdraw.mutate(row.id)}
                    size="sm"
                    variant="outline"
                  >
                    {t("withdraw")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {options.some((p) => !taken.has(p.id)) ? (
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              request.mutate();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor={`${id}-partner`}>{t("partner")}</Label>
              <select
                className="frame h-10 max-w-sm bg-surface px-3"
                id={`${id}-partner`}
                onChange={(e) => setPartnerId(e.target.value)}
                required
                value={partnerId}
              >
                <option value="">{t("choose")}</option>
                {options
                  .filter((p) => !taken.has(p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {localized(p, "name", locale)}
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-note`}>{t("note")}</Label>
              <Input
                className="max-w-sm"
                dir="auto"
                id={`${id}-note`}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
                value={note}
              />
              <p className="type-caption">{t("noteHint")}</p>
            </div>
            <Button
              className="justify-self-start"
              disabled={request.isPending}
              type="submit"
            >
              {t("ask")}
            </Button>
            <ErrorLine error={request.error ?? withdraw.error} />
          </form>
        ) : null}
      </div>
    </SalCard>
  );
};
