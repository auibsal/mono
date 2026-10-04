"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@repo/design-system/components/ui/radio-group";
import {
  getLocaleLabel,
  isLocale,
  type Locale,
  locales,
} from "@repo/internationalization/config";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { rememberLocale } from "@/lib/locale";
import { queryKeys } from "@/lib/queries";

interface ProfileFormProps {
  readonly initialName: string;
  /** Called after saving with the chosen language. */
  readonly onSaved: (locale: Locale) => void;
  readonly submitLabel: string;
}

/** Display name and preferred language (profiles.full_name, .locale). */
export const ProfileForm = ({
  initialName,
  onSaved,
  submitLabel,
}: ProfileFormProps) => {
  const t = useTranslations();
  const id = useId();
  const current = useLocale();
  const { supabase, user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName);
  const [locale, setLocale] = useState<Locale>(current);
  const [error, setError] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ full_name: name.trim(), locale })
        .eq("id", user?.id ?? "");
      if (updateError) {
        throw updateError;
      }
    },
    onError: () => setError(true),
    onSuccess: async () => {
      rememberLocale(locale);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.profile(user?.id ?? ""),
      });
      onSaved(locale);
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(false);
    save.mutate();
  };

  const buttonLabel = save.isPending ? t("common.saving") : submitLabel;

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-name`}>
          {t("app.onboarding.profile.fullName")}
        </Label>
        <Input
          autoComplete="name"
          id={`${id}-name`}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
          required
          value={name}
        />
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-2 font-medium text-sm">
          {t("app.onboarding.profile.language")}
        </legend>
        <RadioGroup
          className="flex gap-6"
          onValueChange={(value) => {
            if (isLocale(value)) {
              setLocale(value);
            }
          }}
          value={locale}
        >
          {locales.map((option) => (
            <div className="flex items-center gap-2" key={option}>
              <RadioGroupItem id={`${id}-${option}`} value={option} />
              <Label htmlFor={`${id}-${option}`} lang={option}>
                {getLocaleLabel(option)}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <p className="text-muted-foreground text-xs">
          {t("app.onboarding.profile.languageHint")}
        </p>
      </fieldset>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {t("app.errors.unknown")}
        </p>
      ) : null}
      <Button disabled={save.isPending || !name.trim()} type="submit">
        {buttonLabel}
      </Button>
    </form>
  );
};
