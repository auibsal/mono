"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import { FormHeader } from "@repo/design-system/components/sal/form-header";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { formatNumber } from "@repo/internationalization/format";
import { membership } from "@repo/sal-data";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useId, useState } from "react";
import { queryKeys, useProfile } from "@/lib/queries";
import { ErrorState, SectionSpinner } from "../states";
import { Affiliations } from "./affiliations";
import { ConnectedApps } from "./connected-apps";
import { DeleteAccount } from "./delete-account";
import { Passkeys } from "./passkeys";
import { PhoneNotifications } from "./phone-notifications";

export const ProfileScreen = () => {
  const t = useTranslations("nexus");
  const ta = useTranslations("auth.signUp");
  const tc = useTranslations("common");
  const { supabase, user } = useAuth();
  const queryClient = useQueryClient();
  const profile = useProfile();
  const id = useId();
  const [form, setForm] = useState({
    bio: "",
    camera_shy: false,
    full_name_ar: "",
    full_name_en: "",
    notify_email: true,
    personal_email: "",
  });

  useEffect(() => {
    if (profile.data) {
      setForm({
        bio: profile.data.bio ?? "",
        camera_shy: profile.data.camera_shy,
        full_name_ar: profile.data.full_name_ar ?? "",
        full_name_en: profile.data.full_name_en,
        notify_email: profile.data.notify_email,
        personal_email: profile.data.personal_email ?? "",
      });
    }
  }, [profile.data]);

  const words = membership.wordCount(form.bio);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .schema("core")
        .from("profiles")
        .update({
          ...form,
          bio: form.bio.trim() || null,
          full_name_ar: form.full_name_ar.trim() || null,
          personal_email: form.personal_email.trim() || null,
        })
        .eq("id", user?.id ?? "");
      if (error) {
        throw error;
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.profile(user?.id ?? ""),
      }),
  });

  if (profile.isPending) {
    return <SectionSpinner />;
  }
  if (profile.isError) {
    return <ErrorState onRetry={() => profile.refetch()} />;
  }

  let saveLabel = tc("save");
  if (save.isPending) {
    saveLabel = tc("saving");
  } else if (save.isSuccess) {
    saveLabel = tc("saved");
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (words <= membership.BIO_MAX_WORDS && form.full_name_en.trim()) {
      save.mutate();
    }
  };

  return (
    <div className="grid max-w-2xl gap-8">
      <FormHeader title={t("profile.title")} />
      <form className="grid gap-4" onSubmit={submit}>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-en`}>{ta("fullNameEn")}</Label>
          <Input
            dir="ltr"
            id={`${id}-en`}
            maxLength={120}
            onChange={(e) =>
              setForm((f) => ({ ...f, full_name_en: e.target.value }))
            }
            required
            value={form.full_name_en}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-ar`}>{ta("fullNameAr")}</Label>
          <Input
            dir="rtl"
            id={`${id}-ar`}
            lang="ar"
            maxLength={120}
            onChange={(e) =>
              setForm((f) => ({ ...f, full_name_ar: e.target.value }))
            }
            value={form.full_name_ar}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-bio`}>{t("profile.bio")}</Label>
          <Textarea
            aria-describedby={`${id}-bio-count`}
            aria-invalid={words > membership.BIO_MAX_WORDS}
            id={`${id}-bio`}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            rows={4}
            value={form.bio}
          />
          <p
            className={
              words > membership.BIO_MAX_WORDS
                ? "type-caption text-title"
                : "type-caption"
            }
            id={`${id}-bio-count`}
          >
            {t("profile.bioCount", { count: formatNumber(words) })}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox
            checked={form.notify_email}
            id={`${id}-notify`}
            onCheckedChange={(v) =>
              setForm((f) => ({ ...f, notify_email: v === true }))
            }
          />
          <Label className="leading-normal" htmlFor={`${id}-notify`}>
            {t("setup.notifications")}
          </Label>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox
            checked={form.camera_shy}
            id={`${id}-shy`}
            onCheckedChange={(v) =>
              setForm((f) => ({ ...f, camera_shy: v === true }))
            }
          />
          <Label className="leading-normal" htmlFor={`${id}-shy`}>
            {t("setup.cameraShy")}
          </Label>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-personal`}>{t("setup.personalEmail")}</Label>
          <Input
            dir="ltr"
            id={`${id}-personal`}
            onChange={(e) =>
              setForm((f) => ({ ...f, personal_email: e.target.value }))
            }
            type="email"
            value={form.personal_email}
          />
        </div>
        {save.isError ? (
          <p className="text-title" role="alert">
            {t("errors.saveFailed")}
          </p>
        ) : null}
        <Button
          className="justify-self-start"
          disabled={save.isPending}
          type="submit"
        >
          {saveLabel}
        </Button>
      </form>
      <SalCard>
        <PhoneNotifications />
      </SalCard>
      <Affiliations />
      <Passkeys />
      <ConnectedApps />
      <SalCard>
        <DeleteAccount />
      </SalCard>
    </div>
  );
};
