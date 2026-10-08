"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { callApi } from "@/lib/api";
import { disablePush, enablePush, type PushState, pushState } from "@/lib/push";

/** Profile and privacy: Web Push on this device. */
export const PhoneNotifications = () => {
  const t = useTranslations("nexus.profile.push");
  const { supabase } = useAuth();
  const [state, setState] = useState<PushState | null>(null);

  useEffect(() => {
    pushState()
      .then(setState)
      .catch(() => setState("unsupported"));
  }, []);

  const toggle = useMutation({
    mutationFn: async () => {
      if (state === "on") {
        await disablePush(supabase);
        return "off" as const;
      }
      return enablePush(supabase);
    },
    onSuccess: setState,
  });

  const test = useMutation({
    mutationFn: () => callApi<{ sent: number }>(supabase, "/push/test", {}),
  });

  if (state === null) {
    return null;
  }

  let note: string | null = null;
  if (state === "needs-install") {
    note = t("needsInstall");
  } else if (state === "denied") {
    note = t("denied");
  } else if (state === "unsupported") {
    note = t("unsupported");
  }

  let testNote: string | null = null;
  if (test.isSuccess) {
    testNote = test.data.sent > 0 ? t("testSent") : t("testNone");
  } else if (test.isError) {
    testNote = t("failed");
  }

  return (
    <div className="grid gap-3">
      <h2 className="type-subheading">{t("title")}</h2>
      <p className="type-body">{t("description")}</p>
      {note ? (
        <p className="type-body text-text-secondary">{note}</p>
      ) : (
        <>
          <p className="type-caption">{state === "on" ? t("on") : t("off")}</p>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={toggle.isPending}
              onClick={() => toggle.mutate()}
              variant={state === "on" ? "outline" : "default"}
            >
              {(() => {
                if (toggle.isPending && state !== "on") {
                  return t("turningOn");
                }
                return state === "on" ? t("turnOff") : t("turnOn");
              })()}
            </Button>
            {state === "on" ? (
              <Button
                disabled={test.isPending}
                onClick={() => test.mutate()}
                variant="outline"
              >
                {t("test")}
              </Button>
            ) : null}
          </div>
          {toggle.isError ? (
            <p className="text-title" role="alert">
              {t("failed")}
            </p>
          ) : null}
          {testNote ? (
            <p className="type-caption" role="status">
              {testNote}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
};
