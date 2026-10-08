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
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  formatClock,
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { events, localized, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { queryKeys, useMyRsvps, useMyWaitlist } from "@/lib/queries";
import { EmptyLine, ErrorState, SectionSpinner } from "../states";

interface Question {
  id: string;
  label_ar?: string;
  label_en?: string;
  required?: boolean;
}

/**
 * Upcoming events the member can see (RLS adds members-only ones), with
 * places left, booking, the waitlist and canceling. Booking and the
 * waitlist are one RPC (events.rsvp), so a full event can't be overfilled.
 */
const useUpcomingEvents = () => {
  const { supabase } = useAuth();
  return useQuery({
    queryFn: async () => {
      const rows =
        unwrap(
          await supabase
            .schema("events")
            .from("events")
            .select(`${events.eventColumns}, questions`)
            .in("status", ["published", "cancelled"])
            .gte(
              "starts_at",
              new Date(Date.now() - 6 * 3_600_000).toISOString()
            )
            .order("starts_at")
            .limit(50)
        ) ?? [];
      // Places left only matter where there is a capacity.
      const counts = await Promise.all(
        rows.map(async (row) =>
          row.capacity === null
            ? null
            : (unwrap(
                await supabase
                  .schema("events")
                  .rpc("confirmed_count", { event_id: row.id })
              ) as number)
        )
      );
      return rows.map((row, index) => ({
        ...row,
        confirmed: counts[index] ?? null,
        questions: (Array.isArray(row.questions)
          ? row.questions
          : []) as unknown as Question[],
      }));
    },
    queryKey: ["upcoming-events"],
  });
};

type UpcomingEvent = NonNullable<
  ReturnType<typeof useUpcomingEvents>["data"]
>[number];

type NoticeKey =
  | "booked"
  | "waitlisted"
  | "cancelled"
  | "leftWaitlist"
  | "notVerified"
  | "closed"
  | "failed";
type StateKey =
  | "cancelled"
  | "booked"
  | "waiting"
  | "noBooking"
  | "open"
  | "full"
  | "left";

/** A plain message for each refusal the booking RPC can raise. */
const errorKey = (error: unknown): NoticeKey => {
  const code = (error as { code?: string } | null)?.code;
  if (code === "42501") {
    return "notVerified";
  }
  if (code === "22023" || code === "P0002") {
    return "closed";
  }
  return "failed";
};

export const EventsBrowser = () => {
  const t = useTranslations("nexus.events");
  const ta = useTranslations("nexus.next");
  const locale = useLocale() as "en" | "ar";
  const { supabase, user } = useAuth();
  const queryClient = useQueryClient();
  const upcoming = useUpcomingEvents();
  const rsvps = useMyRsvps();
  const waitlist = useMyWaitlist();
  const [asking, setAsking] = useState<UpcomingEvent | null>(null);
  const [notice, setNotice] = useState<{ id: string; key: NoticeKey } | null>(
    null
  );

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["upcoming-events"] }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.rsvps(user?.id ?? ""),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.waitlist(user?.id ?? ""),
      }),
    ]);

  const book = useMutation({
    mutationFn: ({
      answers,
      id,
    }: {
      answers: Record<string, string>;
      id: string;
    }) => events.rsvp(supabase, id, answers),
    onError: (error, { id }) => setNotice({ id, key: errorKey(error) }),
    onSuccess: async (result, { id }) => {
      setAsking(null);
      setNotice({ id, key: result === "waitlisted" ? "waitlisted" : "booked" });
      await refresh();
    },
  });

  const cancel = useMutation({
    mutationFn: ({ id }: { id: string; waiting: boolean }) =>
      events.cancelRsvp(supabase, id),
    onError: (_error, { id }) => setNotice({ id, key: "failed" }),
    onSuccess: async (_result, { id, waiting: wasWaiting }) => {
      setNotice({ id, key: wasWaiting ? "leftWaitlist" : "cancelled" });
      await refresh();
    },
  });

  const booked = new Set(
    (rsvps.data ?? []).map((r) => r.event?.id).filter(Boolean)
  );
  const waiting = new Set(
    (waitlist.data ?? []).map((w) => w.event?.id).filter(Boolean)
  );

  const start = (event: UpcomingEvent) => {
    setNotice(null);
    if (event.questions.length > 0) {
      setAsking(event);
    } else {
      book.mutate({ answers: {}, id: event.id });
    }
  };

  const submitAnswers = (form: FormEvent<HTMLFormElement>) => {
    form.preventDefault();
    if (!asking) {
      return;
    }
    const data = new FormData(form.currentTarget);
    const answers = Object.fromEntries(
      asking.questions.map((q) => [q.id, String(data.get(q.id) ?? "").trim()])
    );
    book.mutate({ answers, id: asking.id });
  };

  if (upcoming.isPending) {
    return <SectionSpinner />;
  }
  if (upcoming.isError) {
    return <ErrorState onRetry={() => upcoming.refetch()} />;
  }

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <h1 className="type-display">{t("title")}</h1>
        <p className="type-lede max-w-2xl">{t("lede")}</p>
      </header>

      {upcoming.data.length === 0 ? (
        <EmptyLine
          action={{ href: "/#calendar", label: ta("subscribeCalendar") }}
        >
          {t("empty")}
        </EmptyLine>
      ) : null}

      <ul className="grid gap-6 md:grid-cols-2">
        {upcoming.data.map((event) => (
          <EventCard
            busy={book.isPending || cancel.isPending}
            event={event}
            isBooked={booked.has(event.id)}
            isWaiting={waiting.has(event.id)}
            key={event.id}
            notice={notice?.id === event.id ? notice.key : null}
            onBook={() => start(event)}
            onCancel={() =>
              cancel.mutate({ id: event.id, waiting: waiting.has(event.id) })
            }
          />
        ))}
      </ul>

      <Dialog
        onOpenChange={(open) => (open ? null : setAsking(null))}
        open={asking !== null}
      >
        <DialogContent>
          <form className="grid gap-4" onSubmit={submitAnswers}>
            <DialogHeader>
              <DialogTitle>
                {asking ? localized(asking, "title", locale) : ""}
              </DialogTitle>
              <DialogDescription>{t("questions")}</DialogDescription>
            </DialogHeader>
            {asking?.questions.map((question) => (
              <div className="grid gap-2" key={question.id}>
                <Label htmlFor={`q-${question.id}`}>
                  {(locale === "ar" ? question.label_ar : question.label_en) ??
                    question.label_en ??
                    question.id}
                </Label>
                <Input
                  id={`q-${question.id}`}
                  name={question.id}
                  required={question.required}
                />
              </div>
            ))}
            <DialogFooter>
              <Button disabled={book.isPending} type="submit">
                {t("book")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const placesLeft = (event: UpcomingEvent) =>
  event.capacity === null || event.confirmed === null
    ? null
    : Math.max(event.capacity - event.confirmed, 0);

const stateOf = (
  event: UpcomingEvent,
  isBooked: boolean,
  isWaiting: boolean
): StateKey => {
  const left = placesLeft(event);
  if (event.status === "cancelled") {
    return "cancelled";
  }
  if (isBooked) {
    return "booked";
  }
  if (isWaiting) {
    return "waiting";
  }
  if (!event.rsvp_enabled) {
    return "noBooking";
  }
  if (left === null) {
    return "open";
  }
  return left === 0 ? "full" : "left";
};

interface EventCardProps {
  readonly busy: boolean;
  readonly event: UpcomingEvent;
  readonly isBooked: boolean;
  readonly isWaiting: boolean;
  readonly notice: NoticeKey | null;
  readonly onBook: () => void;
  readonly onCancel: () => void;
}

const EventCard = ({
  busy,
  event,
  isBooked,
  isWaiting,
  notice,
  onBook,
  onCancel,
}: EventCardProps) => {
  const t = useTranslations("nexus.events");
  const locale = useLocale() as "en" | "ar";
  const state = stateOf(event, isBooked, isWaiting);
  const left = placesLeft(event) ?? 0;
  const venue = localized(event, "venue", locale);
  const summary = localized(event, "summary", locale);
  const canBook = ["open", "left", "full"].includes(state);
  const holding = state === "booked" || state === "waiting";

  return (
    <li className="scroll-mt-28" id={event.slug}>
      <article className="frame grid h-full content-start gap-3 bg-surface p-card-padding shadow-offset">
        <p className="type-kicker">
          {formatLongDate(event.starts_at, locale)} ·{" "}
          {formatClock(event.starts_at, locale)}
        </p>
        <h2 className="type-heading">{localized(event, "title", locale)}</h2>
        {venue ? <p className="type-body">{venue}</p> : null}
        {summary ? (
          <p className="type-body text-text-secondary">{summary}</p>
        ) : null}
        <p className="type-caption">
          {event.members_only ? `${t("membersOnly")} · ` : ""}
          {t(`state.${state}`, { count: left, places: formatNumber(left) })}
        </p>
        <div className="mt-auto flex flex-wrap gap-3 pt-2">
          {canBook ? (
            <Button disabled={busy} onClick={onBook}>
              {state === "full" ? t("joinWaitlist") : t("book")}
            </Button>
          ) : null}
          {state === "booked" ? (
            <Button asChild variant="outline">
              <Link href="/#next-events">{t("ticket")}</Link>
            </Button>
          ) : null}
          {holding ? (
            <Button disabled={busy} onClick={onCancel} variant="ghost">
              {state === "booked" ? t("cancel") : t("leaveWaitlist")}
            </Button>
          ) : null}
        </div>
        {notice ? (
          <p
            className="type-body font-bold"
            role={
              ["failed", "closed", "notVerified"].includes(notice)
                ? "alert"
                : "status"
            }
          >
            {t(`notice.${notice}`)}
          </p>
        ) : null}
      </article>
    </li>
  );
};
