"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { rememberActiveOrganization } from "@/lib/active-organization";
import { type OrganizationError, toOrganizationError } from "@/lib/errors";
import { isValidSlug, suggestSlug } from "@/lib/slug";

type FormError = OrganizationError | "nameRequired";

interface CreateOrganizationFormProps {
  /** Called once the organization exists (and is remembered as active). */
  readonly onCreated: (organizationId: string) => void;
}

const randomSuffix = () => Math.random().toString(36).slice(2, 8);

/** Creates an organization with the user as owner (create_organization RPC). */
export const CreateOrganizationForm = ({
  onCreated,
}: CreateOrganizationFormProps) => {
  const t = useTranslations("app.onboarding");
  const id = useId();
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  // One suffix per form, so the suggestion doesn't change on every key.
  const [suffix] = useState(randomSuffix);

  const create = useMutation({
    mutationFn: async () => {
      const { data, error: rpcError } = await supabase.rpc(
        "create_organization",
        { org_name: name.trim(), org_slug: slug }
      );
      if (rpcError) {
        throw rpcError;
      }
      return data;
    },
    onError: (mutationError) => setError(toOrganizationError(mutationError)),
    onSuccess: async (organization) => {
      rememberActiveOrganization(organization.id);
      await queryClient.invalidateQueries({ queryKey: ["memberships"] });
      onCreated(organization.id);
    },
  });

  const changeName = (value: string) => {
    setName(value);
    if (!slugEdited) {
      setSlug(value.trim() ? suggestSlug(value, () => suffix) : "");
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("nameRequired");
      return;
    }
    if (!isValidSlug(slug)) {
      setError("slugInvalid");
      return;
    }
    setError(null);
    create.mutate();
  };

  return (
    <form className="grid gap-4" noValidate onSubmit={submit}>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-name`}>{t("organization.name")}</Label>
        <Input
          aria-invalid={error === "nameRequired"}
          autoComplete="organization"
          id={`${id}-name`}
          maxLength={120}
          onChange={(event) => changeName(event.target.value)}
          placeholder={t("organization.namePlaceholder")}
          required
          value={name}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-slug`}>{t("organization.slug")}</Label>
        <Input
          aria-describedby={`${id}-slug-hint`}
          aria-invalid={error === "slugInvalid" || error === "slugTaken"}
          autoCapitalize="none"
          autoCorrect="off"
          className="text-start"
          dir="ltr"
          id={`${id}-slug`}
          maxLength={64}
          onChange={(event) => {
            setSlugEdited(true);
            setSlug(event.target.value.toLowerCase());
          }}
          spellCheck={false}
          value={slug}
        />
        <p className="text-muted-foreground text-xs" id={`${id}-slug-hint`}>
          {t("organization.slugHint")}
        </p>
      </div>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {t(`errors.${error}`)}
        </p>
      ) : null}
      <Button disabled={create.isPending} type="submit">
        {create.isPending
          ? t("organization.submitting")
          : t("organization.submit")}
      </Button>
    </form>
  );
};
