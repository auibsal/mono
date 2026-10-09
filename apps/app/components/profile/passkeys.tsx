"use client";

import {
  addPasskey,
  listPasskeys,
  PASSKEY_NAME_MAX,
  type PasskeyErrorCode,
  passkeysSupported,
  removePasskey,
} from "@repo/auth/passkeys";
import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { formatLongDate } from "@repo/internationalization/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useEffect, useId, useState } from "react";
import { usePasskeyError } from "@/lib/auth-messages";

const KEY = ["passkeys"];

class PasskeyFailure extends Error {
  readonly code: PasskeyErrorCode;
  constructor(code: PasskeyErrorCode) {
    super(code);
    this.code = code;
  }
}

/**
 * Profile and privacy: passkeys let a member sign in with the device's
 * fingerprint, face or screen lock instead of an email link or password.
 */
export const Passkeys = () => {
  const t = useTranslations("nexus.profile.passkeys");
  const errorText = usePasskeyError();
  const locale = useLocale();
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const id = useId();
  const [name, setName] = useState("");
  // Checked after mount: the page is prerendered without a browser.
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => setSupported(passkeysSupported()), []);

  const passkeys = useQuery({
    queryFn: async () => {
      const result = await listPasskeys(supabase);
      if (!result.ok) {
        throw new PasskeyFailure(result.code);
      }
      return result.value;
    },
    queryKey: KEY,
  });

  const add = useMutation({
    mutationFn: async (deviceName: string) => {
      const result = await addPasskey(supabase, deviceName);
      if (!result.ok) {
        throw new PasskeyFailure(result.code);
      }
    },
    onSuccess: async () => {
      setName("");
      await queryClient.invalidateQueries({ queryKey: KEY });
    },
  });

  const remove = useMutation({
    mutationFn: async (passkeyId: string) => {
      const result = await removePasskey(supabase, passkeyId);
      if (!result.ok) {
        throw new PasskeyFailure(result.code);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    remove.reset();
    add.mutate(name);
  };

  const failure = add.error ?? remove.error;
  const list = passkeys.data ?? [];

  return (
    <SalCard>
      <div className="grid gap-3">
        <h2 className="type-subheading">{t("title")}</h2>
        <p className="type-body">{t("description")}</p>

        {list.length > 0 ? (
          <ul className="grid gap-3">
            {list.map((passkey) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3"
                key={passkey.id}
              >
                <div className="grid">
                  <span className="type-body" dir="auto">
                    {passkey.name ?? t("unnamed")}
                  </span>
                  <span className="type-caption">
                    {passkey.lastUsedAt
                      ? t("lastUsed", {
                          date: formatLongDate(passkey.lastUsedAt, locale),
                        })
                      : t("added", {
                          date: formatLongDate(passkey.createdAt, locale),
                        })}
                  </span>
                </div>
                <Button
                  aria-label={t("removeNamed", {
                    name: passkey.name ?? t("unnamed"),
                  })}
                  disabled={remove.isPending}
                  onClick={() => {
                    add.reset();
                    remove.mutate(passkey.id);
                  }}
                  variant="outline"
                >
                  {t("remove")}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        {passkeys.isSuccess && list.length === 0 ? (
          <p className="type-body">{t("none")}</p>
        ) : null}
        {passkeys.isError ? (
          <p className="type-body">{t("loadFailed")}</p>
        ) : null}

        {supported === false ? (
          <p className="type-body">{t("unsupported")}</p>
        ) : null}
        {supported ? (
          <form className="grid gap-3" onSubmit={submit}>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-name`}>{t("nameLabel")}</Label>
              <Input
                aria-describedby={`${id}-name-hint`}
                autoComplete="off"
                className="max-w-sm"
                dir="auto"
                id={`${id}-name`}
                maxLength={PASSKEY_NAME_MAX}
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
              <p className="type-caption" id={`${id}-name-hint`}>
                {t("nameHint")}
              </p>
            </div>
            <Button
              className="justify-self-start"
              disabled={add.isPending}
              type="submit"
            >
              {add.isPending ? t("adding") : t("add")}
            </Button>
          </form>
        ) : null}
        {add.isSuccess ? <p role="status">{t("addedNow")}</p> : null}
        {failure instanceof PasskeyFailure ? (
          <p className="text-title" role="alert">
            {errorText(failure.code)}
          </p>
        ) : null}
      </div>
    </SalCard>
  );
};
