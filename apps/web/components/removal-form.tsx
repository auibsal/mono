"use client";

import { project } from "@repo/config";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import type { Locale } from "@repo/internationalization";
import { formatClock, formatLongDate } from "@repo/internationalization/format";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";

type State =
  | { kind: "idle" | "sending" | "failed" | "rate_limited" }
  | { dueAt: string; kind: "sent" };

/** Posts to apps/api /removal-requests; no sign-in needed. */
export const RemovalForm = () => {
  const t = useTranslations("web.care");
  const locale = useLocale() as Locale;
  const id = useId();
  const [state, setState] = useState<State>({ kind: "idle" });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setState({ kind: "sending" });
    try {
      const response = await fetch(`${project.hosts.api}/removal-requests`, {
        body: JSON.stringify({
          content_url: data.get("content_url") || undefined,
          details: data.get("details"),
          programme: "side-quest",
          requester_email: data.get("requester_email"),
          requester_name: data.get("requester_name"),
          website: data.get("website") || undefined,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as { dueAt?: string };
      if (response.status === 429) {
        setState({ kind: "rate_limited" });
      } else if (response.ok) {
        setState({
          dueAt:
            result.dueAt ?? new Date(Date.now() + 86_400_000).toISOString(),
          kind: "sent",
        });
      } else {
        setState({ kind: "failed" });
      }
    } catch {
      setState({ kind: "failed" });
    }
  };

  if (state.kind === "sent") {
    return (
      <p className="type-body rounded-card bg-surface-tint p-4" role="status">
        {t("sent", {
          date: `${formatLongDate(state.dueAt, locale)}, ${formatClock(state.dueAt, locale)}`,
        })}
      </p>
    );
  }

  return (
    <form className="grid max-w-2xl gap-4" onSubmit={submit}>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-name`}>{t("name")}</Label>
        <Input
          autoComplete="name"
          id={`${id}-name`}
          maxLength={200}
          name="requester_name"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-email`}>{t("email")}</Label>
        <Input
          autoComplete="email"
          dir="ltr"
          id={`${id}-email`}
          name="requester_email"
          required
          type="email"
        />
        <p className="type-caption">{t("emailHint")}</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-url`}>{t("url")}</Label>
        <Input
          dir="ltr"
          id={`${id}-url`}
          maxLength={2048}
          name="content_url"
          type="url"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-details`}>{t("details")}</Label>
        <Textarea
          id={`${id}-details`}
          maxLength={4000}
          name="details"
          required
          rows={4}
        />
        <p className="type-caption">{t("detailsHint")}</p>
      </div>
      {/* Hidden from people; bots fill it in. */}
      <input
        aria-hidden="true"
        autoComplete="off"
        className="hidden"
        name="website"
        tabIndex={-1}
      />
      <Button
        className="justify-self-start"
        disabled={state.kind === "sending"}
        type="submit"
      >
        {state.kind === "sending" ? t("sending") : t("send")}
      </Button>
      {state.kind === "failed" || state.kind === "rate_limited" ? (
        <p className="text-sm text-title" role="alert">
          {state.kind === "failed" ? t("failed") : t("rateLimited")}
        </p>
      ) : null}
    </form>
  );
};
