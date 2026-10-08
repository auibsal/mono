"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { SectionSpinner } from "../states";

/**
 * Two-step sign-in (TOTP). The Council and Elections roles count only on a
 * session verified with a second factor (access.has_permission checks the
 * token's aal), so their holders set up an authenticator app here once and
 * enter a code after each sign-in.
 */
export const useTwoStep = () => {
  const { supabase, user } = useAuth();
  return useQuery({
    enabled: Boolean(user),
    queryFn: async () => {
      const [needs, level, factors] = await Promise.all([
        supabase.schema("access").rpc("needs_two_step"),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);
      const verified = (factors.data?.totp ?? []).find(
        (factor) => factor.status === "verified"
      );
      return {
        done: level.data?.currentLevel === "aal2",
        factorId: verified?.id ?? null,
        needs: Boolean(unwrap(needs)),
      };
    },
    queryKey: ["two-step", user?.id ?? ""],
  });
};

export const TwoStepPanel = () => {
  const t = useTranslations("nexus.twoStep");
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const state = useTwoStep();
  const [enrolling, setEnrolling] = useState<{
    id: string;
    qr: string;
    secret: string;
  } | null>(null);
  const [failed, setFailed] = useState(false);

  const enroll = useMutation({
    mutationFn: async () => {
      // A half-finished setup leaves an unverified factor; clear it first.
      const { data } = await supabase.auth.mfa.listFactors();
      for (const factor of data?.all ?? []) {
        if (factor.status === "unverified") {
          // biome-ignore lint/performance/noAwaitInLoops: at most a couple
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }
      const result = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "SAL Nexus",
      });
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onError: () => setFailed(true),
    onSuccess: (data) =>
      setEnrolling({
        id: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
      }),
  });

  const verify = useMutation({
    mutationFn: async ({ code, id }: { code: string; id: string }) => {
      const result = await supabase.auth.mfa.challengeAndVerify({
        code,
        factorId: id,
      });
      if (result.error) {
        throw result.error;
      }
    },
    onError: () => setFailed(true),
    // The session now carries aal2: every permission check changes.
    onSuccess: () => queryClient.invalidateQueries(),
  });

  if (state.isPending) {
    return <SectionSpinner />;
  }
  if (!state.data?.needs || state.data.done) {
    return null;
  }

  const factorId = enrolling?.id ?? state.data.factorId;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFailed(false);
    const code = String(new FormData(event.currentTarget).get("code") ?? "")
      .replace(/\s/g, "")
      .trim();
    if (factorId) {
      verify.mutate({ code, id: factorId });
    }
  };

  return (
    <section
      aria-labelledby="two-step-title"
      className="frame grid max-w-xl gap-4 bg-surface p-card-padding shadow-offset"
    >
      <h2 className="type-heading" id="two-step-title">
        {factorId ? t("verifyTitle") : t("setupTitle")}
      </h2>
      <p className="type-body">{factorId ? t("verifyBody") : t("setupBody")}</p>

      {factorId ? null : (
        <Button
          className="justify-self-start"
          disabled={enroll.isPending}
          onClick={() => {
            setFailed(false);
            enroll.mutate();
          }}
        >
          {t("start")}
        </Button>
      )}

      {enrolling ? (
        <div className="grid gap-3" data-theme="light">
          <div className="frame justify-self-start bg-surface p-2">
            {/* biome-ignore lint/performance/noImgElement: Supabase returns the QR as an SVG data URL */}
            <img alt={t("qrAlt")} height={176} src={enrolling.qr} width={176} />
          </div>
        </div>
      ) : null}
      {enrolling ? (
        <p className="type-caption">
          {t("manual")}{" "}
          <code className="type-code break-all">{enrolling.secret}</code>
        </p>
      ) : null}

      {factorId ? (
        <form className="grid gap-3" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="two-step-code">{t("codeLabel")}</Label>
            <Input
              autoComplete="one-time-code"
              className="max-w-48 font-mono text-lg tracking-widest"
              id="two-step-code"
              inputMode="numeric"
              maxLength={7}
              name="code"
              pattern="[0-9 ]{6,7}"
              required
            />
          </div>
          <Button
            className="justify-self-start"
            disabled={verify.isPending}
            type="submit"
          >
            {t("verify")}
          </Button>
        </form>
      ) : null}

      {failed ? (
        <p className="type-body font-bold" role="alert">
          {t("failed")}
        </p>
      ) : null}
    </section>
  );
};
