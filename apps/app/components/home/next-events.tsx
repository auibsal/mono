"use client";

import { useAuth } from "@repo/auth/provider";
import { SalCard } from "@repo/design-system/components/sal/card";
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
import {
  formatClock,
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { events, localized, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import QRCode from "react-qr-code";
import { env } from "@/env";
import { queryKeys, useMyRsvps, useMyWaitlist } from "@/lib/queries";
import { EmptyLine, ErrorState, SectionSpinner } from "../states";
import { Section } from "./section";

export const NextEvents = () => {
  const t = useTranslations("nexus.home.events");
  const ta = useTranslations("nexus.next");
  const tc = useTranslations("common");
  const locale = useLocale() as "en" | "ar";
  const { supabase, user } = useAuth();
  const queryClient = useQueryClient();
  const rsvps = useMyRsvps();
  const waitlist = useMyWaitlist();

  const cancel = useMutation({
    mutationFn: (eventId: string) => events.cancelRsvp(supabase, eventId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.rsvps(user?.id ?? ""),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.waitlist(user?.id ?? ""),
        }),
      ]),
  });

  const upcoming = (rsvps.data ?? [])
    .filter(
      (r) =>
        r.event && new Date(r.event.ends_at ?? r.event.starts_at) >= new Date()
    )
    .sort((a, b) =>
      (a.event?.starts_at ?? "").localeCompare(b.event?.starts_at ?? "")
    );

  return (
    <Section
      action={
        <Link className="text-sm underline underline-offset-4" href="/events">
          {t("browse")}
        </Link>
      }
      id="next-events"
      title={t("title")}
    >
      {rsvps.isPending ? <SectionSpinner /> : null}
      {rsvps.isError ? <ErrorState onRetry={() => rsvps.refetch()} /> : null}
      {rsvps.data &&
      upcoming.length === 0 &&
      (waitlist.data ?? []).length === 0 ? (
        <EmptyLine action={{ href: "/events", label: ta("browseEvents") }}>
          {t("empty")}
        </EmptyLine>
      ) : null}
      <ul className="grid gap-3">
        {upcoming.map((rsvp) =>
          rsvp.event ? (
            <li key={rsvp.id}>
              <SalCard className="sm:grid-cols-[1fr_auto]">
                <div className="grid content-start gap-1">
                  <h3 className="type-subheading">
                    {localized(rsvp.event, "title", locale)}
                  </h3>
                  <p className="type-body">
                    {formatLongDate(rsvp.event.starts_at, locale)} ·{" "}
                    {formatClock(rsvp.event.starts_at, locale)}
                  </p>
                  {localized(rsvp.event, "venue", locale) ? (
                    <p className="type-caption">
                      {localized(rsvp.event, "venue", locale)}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={`${env.NEXT_PUBLIC_API_URL ?? ""}/calendar/events/${rsvp.event.slug}.ics`}
                      >
                        {t("addToCalendar")}
                      </a>
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="ghost">
                          {t("cancel")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t("cancel")}</DialogTitle>
                          <DialogDescription>
                            {t("cancelConfirm", {
                              event: localized(rsvp.event, "title", locale),
                            })}
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button
                            disabled={cancel.isPending}
                            onClick={() =>
                              rsvp.event && cancel.mutate(rsvp.event.id)
                            }
                          >
                            {tc("confirm")}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <figure className="grid justify-items-center gap-1">
                  <div className="rounded-card bg-surface p-2">
                    <QRCode
                      aria-hidden="true"
                      size={96}
                      value={`sal:ticket:${rsvp.ticket_code}`}
                    />
                  </div>
                  <figcaption className="type-caption">
                    {t("ticket")}
                  </figcaption>
                </figure>
              </SalCard>
            </li>
          ) : null
        )}
        {(waitlist.data ?? []).map((entry) =>
          entry.event ? (
            <li key={entry.id}>
              <WaitlistItem
                eventId={entry.event.id}
                title={localized(entry.event, "title", locale)}
              />
            </li>
          ) : null
        )}
      </ul>
    </Section>
  );
};

/** A waitlist place, with the member's current position. */
const WaitlistItem = ({
  eventId,
  title,
}: {
  eventId: string;
  title: string;
}) => {
  const t = useTranslations("nexus.home.events");
  const { supabase } = useAuth();
  const position = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("events")
          .rpc("waitlist_position", { event_id: eventId })
      ),
    queryKey: ["waitlist-position", eventId],
  });

  return (
    <SalCard>
      <h3 className="type-subheading">{title}</h3>
      {position.data ? (
        <p className="type-body">
          {t("waitlist", { position: formatNumber(position.data) })}
        </p>
      ) : null}
    </SalCard>
  );
};
