"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import { FormHeader } from "@repo/design-system/components/sal/form-header";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@repo/design-system/components/ui/radio-group";
import { useRouter } from "@repo/internationalization/navigation";
import { content, membership } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useId, useState } from "react";
import { safeNextPath, stripLocale } from "@/lib/navigation";
import { useMemberStatus, useProfile } from "@/lib/queries";
import { ErrorState, FullPageSpinner } from "./states";

type PledgeKind = "human_authorship" | "member";

const usePledgeVersions = () => {
  const { supabase } = useAuth();
  return useQuery({
    queryFn: async () => {
      const [human, member] = await Promise.all([
        content.publicSetting(supabase, "pledges.human_authorship.version"),
        content.publicSetting(supabase, "pledges.member.version"),
      ]);
      return {
        human_authorship: String(human ?? "1"),
        member: String(member ?? "1"),
      } as Record<PledgeKind, string>;
    },
    queryKey: ["pledge-versions"],
  });
};

/**
 * After verification: the two required pledges (stored with their version)
 * and the member's choices. Also shown again when a pledge version changes.
 */
export const SetupForm = () => {
  const t = useTranslations("nexus.setup");
  const te = useTranslations("nexus.errors");
  const { supabase, user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const next = safeNextPath(useSearchParams().get("next"));
  const status = useMemberStatus();
  const profile = useProfile();
  const versions = usePledgeVersions();
  const id = useId();

  const [accepted, setAccepted] = useState<Record<PledgeKind, boolean>>({
    human_authorship: false,
    member: false,
  });
  const [prefs, setPrefs] = useState({
    camera_shy: false,
    locale: "en" as "en" | "ar",
    notify_email: true,
    personal_email: "",
  });

  useEffect(() => {
    if (profile.data) {
      setPrefs({
        camera_shy: profile.data.camera_shy,
        locale: profile.data.locale === "ar" ? "ar" : "en",
        notify_email: profile.data.notify_email,
        personal_email: profile.data.personal_email ?? "",
      });
    }
  }, [profile.data]);

  const pending = status.data?.pending_pledges ?? [];
  const isRenewal =
    Boolean(profile.data?.setup_completed_at) && pending.length > 0;

  const save = useMutation({
    mutationFn: async () => {
      await Promise.all(
        pending.map((kind) =>
          membership.acceptPledge(supabase, kind, versions.data?.[kind] ?? "1")
        )
      );
      const { error } = await supabase
        .schema("core")
        .from("profiles")
        .update({
          ...prefs,
          personal_email: prefs.personal_email.trim() || null,
          setup_completed_at:
            profile.data?.setup_completed_at ?? new Date().toISOString(),
        })
        .eq("id", user?.id ?? "");
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      router.replace(next ? stripLocale(next) : "/", { locale: prefs.locale });
    },
  });

  if (status.isPending || profile.isPending || versions.isPending) {
    return <FullPageSpinner />;
  }
  if (status.isError || profile.isError || versions.isError) {
    return <ErrorState onRetry={() => status.refetch()} />;
  }

  const ready = pending.every((kind) => accepted[kind]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (ready) {
      save.mutate();
    }
  };

  return (
    <>
      <FormHeader code={t("kicker")} title={t("title")}>
        {isRenewal ? t("renewed") : t("description")}
      </FormHeader>
      <form className="grid gap-6" onSubmit={submit}>
        {pending.length > 0 ? (
          <fieldset className="grid gap-4">
            <legend className="type-subheading mb-2">{t("pledges")}</legend>
            {pending.map((kind) => {
              const key =
                kind === "human_authorship" ? "humanAuthorship" : "member";
              return (
                <SalCard key={kind}>
                  <h2 className="type-subheading">{t(`${key}.title`)}</h2>
                  <p className="type-body">{t(`${key}.body`)}</p>
                  <p className="type-caption type-code">
                    v{versions.data?.[kind]}
                  </p>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={accepted[kind]}
                      id={`${id}-${kind}`}
                      onCheckedChange={(value) =>
                        setAccepted((current) => ({
                          ...current,
                          [kind]: value === true,
                        }))
                      }
                    />
                    <Label className="leading-normal" htmlFor={`${id}-${kind}`}>
                      {t(`${key}.accept`)}
                    </Label>
                  </div>
                </SalCard>
              );
            })}
          </fieldset>
        ) : null}

        <fieldset className="grid gap-4">
          <legend className="type-subheading mb-2">{t("preferences")}</legend>
          <div className="grid gap-2">
            <p className="text-sm" id={`${id}-locale`}>
              {t("locale")}
            </p>
            <RadioGroup
              aria-labelledby={`${id}-locale`}
              className="flex gap-6"
              onValueChange={(value) =>
                setPrefs((p) => ({
                  ...p,
                  locale: value === "ar" ? "ar" : "en",
                }))
              }
              value={prefs.locale}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem id={`${id}-en`} value="en" />
                <Label htmlFor={`${id}-en`} lang="en">
                  English
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id={`${id}-ar`} value="ar" />
                <Label htmlFor={`${id}-ar`} lang="ar">
                  العربية
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              checked={prefs.notify_email}
              id={`${id}-notify`}
              onCheckedChange={(value) =>
                setPrefs((p) => ({ ...p, notify_email: value === true }))
              }
            />
            <Label className="leading-normal" htmlFor={`${id}-notify`}>
              {t("notifications")}
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              aria-describedby={`${id}-shy-hint`}
              checked={prefs.camera_shy}
              id={`${id}-shy`}
              onCheckedChange={(value) =>
                setPrefs((p) => ({ ...p, camera_shy: value === true }))
              }
            />
            <div className="grid gap-1">
              <Label className="leading-normal" htmlFor={`${id}-shy`}>
                {t("cameraShy")}
              </Label>
              <p className="type-caption" id={`${id}-shy-hint`}>
                {t("cameraShyHint")}
              </p>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-personal`}>{t("personalEmail")}</Label>
            <Input
              aria-describedby={`${id}-personal-hint`}
              autoComplete="email"
              dir="ltr"
              id={`${id}-personal`}
              onChange={(event) =>
                setPrefs((p) => ({ ...p, personal_email: event.target.value }))
              }
              type="email"
              value={prefs.personal_email}
            />
            <p className="type-caption" id={`${id}-personal-hint`}>
              {t("personalEmailHint")}
            </p>
          </div>
        </fieldset>

        {save.isError ? (
          <p className="text-title" role="alert">
            {te("saveFailed")}
          </p>
        ) : null}
        <Button disabled={!ready || save.isPending} type="submit">
          {t("submit")}
        </Button>
      </form>
    </>
  );
};
