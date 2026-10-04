"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { membership } from "@repo/sal-data";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { env } from "@/env";
import { queryKeys, useCalendarToken } from "@/lib/queries";
import { Section } from "./section";

/** The member's private iCal feed, served by apps/api. */
export const CalendarFeed = () => {
  const t = useTranslations("nexus.home.calendar");
  const tc = useTranslations("common");
  const { supabase, user } = useAuth();
  const queryClient = useQueryClient();
  const token = useCalendarToken();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const url = token.data
    ? `${env.NEXT_PUBLIC_API_URL ?? ""}/calendar/feed/${token.data}.ics`
    : "";

  const reset = useMutation({
    mutationFn: () => membership.resetCalendarToken(supabase),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.calendarToken(user?.id ?? ""),
      }),
  });

  return (
    <Section id="calendar" title={t("title")}>
      <p className="type-body">{t("description")}</p>
      <Input
        aria-label={t("title")}
        className="font-mono text-xs"
        dir="ltr"
        readOnly
        value={url}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!url}
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          }}
          size="sm"
        >
          {copied ? tc("copied") : t("copy")}
        </Button>
        <Dialog onOpenChange={setConfirming} open={confirming}>
          <DialogTrigger asChild>
            <Button disabled={reset.isPending} size="sm" variant="outline">
              {t("reset")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("reset")}</DialogTitle>
              <DialogDescription>{t("resetConfirm")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                onClick={() => {
                  setConfirming(false);
                  reset.mutate();
                }}
              >
                {tc("confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Section>
  );
};
