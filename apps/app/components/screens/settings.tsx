"use client";

import { formatPhone } from "@repo/auth/phone";
import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { usePathname, useRouter } from "@repo/internationalization/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { DeleteAccountCard } from "@/components/account/delete-account";
import { useOrganization } from "@/components/organization-provider";
import { PageHeader } from "@/components/page-header";
import { ProfileForm } from "@/components/profile-form";
import { SectionSpinner } from "@/components/states";
import { type OrganizationError, toOrganizationError } from "@/lib/errors";
import { useProfile } from "@/lib/queries";
import { isValidSlug } from "@/lib/slug";

const OrganizationSettings = () => {
  const t = useTranslations();
  const id = useId();
  const { supabase } = useAuth();
  const { active, canManage } = useOrganization();
  const queryClient = useQueryClient();
  const [name, setName] = useState(active.name);
  const [slug, setSlug] = useState(active.slug);
  const [error, setError] = useState<OrganizationError | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const { error: updateError } = await supabase
        .from("organizations")
        .update({ name: name.trim(), slug })
        .eq("id", active.id);
      if (updateError) {
        throw updateError;
      }
    },
    onError: (mutationError) => setError(toOrganizationError(mutationError)),
    onSuccess: async () => {
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["memberships"] });
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(false);
    if (!isValidSlug(slug)) {
      setError("slugInvalid");
      return;
    }
    setError(null);
    save.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("app.settings.organization.title")}</CardTitle>
        <CardDescription>
          {t("app.settings.organization.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submit}>
          <fieldset className="grid gap-4" disabled={!canManage}>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-name`}>
                {t("app.settings.organization.name")}
              </Label>
              <Input
                id={`${id}-name`}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-slug`}>
                {t("app.settings.organization.slug")}
              </Label>
              <Input
                autoCapitalize="none"
                className="text-start"
                dir="ltr"
                id={`${id}-slug`}
                maxLength={64}
                onChange={(event) => setSlug(event.target.value.toLowerCase())}
                spellCheck={false}
                value={slug}
              />
            </div>
          </fieldset>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {t(`app.onboarding.errors.${error}`)}
            </p>
          ) : null}
          {saved ? (
            <p className="text-muted-foreground text-sm" role="status">
              {t("common.saved")}
            </p>
          ) : null}
          {canManage ? (
            <Button
              className="justify-self-start"
              disabled={save.isPending || !name.trim()}
              type="submit"
            >
              {save.isPending ? t("common.saving") : t("common.save")}
            </Button>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
};

export const Settings = () => {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const profile = useProfile();

  return (
    <>
      <PageHeader title={t("app.settings.title")} />
      <div className="flex max-w-2xl flex-1 flex-col gap-6 p-4 pt-0">
        <Card>
          <CardHeader>
            <CardTitle>{t("app.settings.profile.title")}</CardTitle>
            <CardDescription>
              {t("app.settings.profile.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {user?.phone ? (
              <div className="grid gap-1 text-sm">
                <span className="text-muted-foreground">
                  {t("app.settings.profile.phone")}
                </span>
                <span className="text-start" dir="ltr">
                  {formatPhone(user.phone)}
                </span>
              </div>
            ) : null}
            {profile.data ? (
              <ProfileForm
                initialName={profile.data.full_name ?? ""}
                onSaved={(language) => {
                  if (language !== locale) {
                    router.replace(pathname, { locale: language });
                  }
                }}
                submitLabel={t("common.save")}
              />
            ) : (
              <SectionSpinner />
            )}
          </CardContent>
        </Card>
        <OrganizationSettings />
        <DeleteAccountCard />
      </div>
    </>
  );
};
