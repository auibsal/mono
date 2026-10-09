"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import type { Locale } from "@repo/internationalization";
import {
  formatDateTime,
  formatNumber,
} from "@repo/internationalization/format";
import { recognition, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useDeferredValue, useState } from "react";
import { SectionSpinner } from "../../states";
import { type Column, DataTable, ErrorLine, ExportButton, Field } from "../kit";
import { memberName } from "../members/directory";

interface Question {
  id: string;
  label_ar: string;
  label_en: string;
}

interface AttendanceProps {
  readonly capacity: number | null;
  readonly eventId: string;
  readonly questions: readonly Question[];
  readonly slug: string;
}

const useNames = (ids: string[]) => {
  const { supabase } = useAuth();
  return useQuery({
    enabled: ids.length > 0,
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("core")
          .from("profiles")
          .select("id, full_name_en, full_name_ar")
          .in("id", ids)
      ) ?? [],
    queryKey: ["admin", "names", ids],
  });
};

/** Search members for this event (events.find_attendee; check-in permission). */
export const useAttendeeSearch = (eventId: string, query: string) => {
  const { supabase } = useAuth();
  const deferred = useDeferredValue(query.trim());
  return useQuery({
    enabled: deferred.length >= 2,
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("events")
          .rpc("find_attendee", { event_id: eventId, query: deferred })
      ) ?? [],
    queryKey: ["admin", "find-attendee", eventId, deferred],
  });
};

const Staff = ({ eventId }: { eventId: string }) => {
  const t = useTranslations("nexus.admin.event");
  const locale = useLocale();
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [duty, setDuty] = useState("");
  const staff = useQuery({
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("events")
          .from("event_staff")
          .select("user_id, duty")
          .eq("event_id", eventId)
      ) ?? [],
    queryKey: ["admin", "event-staff", eventId],
  });
  const names = useNames(staff.data?.map((s) => s.user_id) ?? []);
  const results = useAttendeeSearch(eventId, query);
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["admin", "event-staff", eventId],
    });

  const add = useMutation({
    mutationFn: async (userId: string) =>
      unwrap(
        await supabase
          .schema("events")
          .from("event_staff")
          .insert({
            duty: duty.trim() || null,
            event_id: eventId,
            user_id: userId,
          })
      ),
    onSuccess: async () => {
      setQuery("");
      setDuty("");
      await invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: async (userId: string) =>
      unwrap(
        await supabase
          .schema("events")
          .from("event_staff")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", userId)
      ),
    onSuccess: invalidate,
  });

  const nameOf = (userId: string) => {
    const profile = names.data?.find((p) => p.id === userId);
    return profile ? memberName(profile, locale) : "—";
  };

  // After the event, the hours each staff member gave count as recorded
  // service (Form F-16, Bylaws B4.1).
  const [hours, setHours] = useState<Record<string, string>>({});
  const [recorded, setRecorded] = useState<Record<string, boolean>>({});
  const record = useMutation({
    mutationFn: (userId: string) =>
      recognition.recordEventService(
        supabase,
        eventId,
        userId,
        Number(hours[userId] ?? 0)
      ),
    onSuccess: (_, userId) =>
      setRecorded((current) => ({ ...current, [userId]: true })),
  });

  return (
    <section className="grid gap-4">
      <h3 className="type-subheading">{t("staff")}</h3>
      <p className="type-caption">{t("staffHint")}</p>
      <ul className="grid gap-2">
        {staff.data?.map((member) => (
          <li
            className="flex flex-wrap items-center gap-3"
            key={member.user_id}
          >
            <span className="font-medium">{nameOf(member.user_id)}</span>
            {member.duty ? (
              <span className="type-caption">{member.duty}</span>
            ) : null}
            <Button
              disabled={remove.isPending}
              onClick={() => remove.mutate(member.user_id)}
              size="sm"
              variant="ghost"
            >
              {t("removeStaff")}
            </Button>
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                record.mutate(member.user_id);
              }}
            >
              <Input
                aria-label={t("serviceHours", { name: nameOf(member.user_id) })}
                className="w-20"
                dir="ltr"
                max={24}
                min={0.25}
                onChange={(e) =>
                  setHours((current) => ({
                    ...current,
                    [member.user_id]: e.target.value,
                  }))
                }
                required
                step={0.25}
                type="number"
                value={hours[member.user_id] ?? ""}
              />
              <Button
                disabled={record.isPending}
                size="sm"
                type="submit"
                variant="outline"
              >
                {recorded[member.user_id]
                  ? t("hoursRecorded")
                  : t("recordHours")}
              </Button>
            </form>
          </li>
        ))}
      </ul>
      <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
        <Field hint={t("findHint")} label={t("findPerson")}>
          {(id) => (
            <Input
              id={id}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              value={query}
            />
          )}
        </Field>
        <Field label={t("duty")}>
          {(id) => (
            <Input
              id={id}
              maxLength={120}
              onChange={(e) => setDuty(e.target.value)}
              value={duty}
            />
          )}
        </Field>
      </div>
      {results.data?.length ? (
        <ul className="grid gap-2">
          {results.data.map((person) => (
            <li
              className="flex flex-wrap items-center gap-3"
              key={person.user_id}
            >
              <span>{memberName(person, locale)}</span>
              <span className="type-caption" dir="ltr">
                {person.email}
              </span>
              <Button
                disabled={
                  add.isPending ||
                  staff.data?.some((s) => s.user_id === person.user_id)
                }
                onClick={() => add.mutate(person.user_id)}
                size="sm"
                variant="outline"
              >
                {t("addStaff")}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <ErrorLine error={add.error ?? remove.error ?? record.error} />
    </section>
  );
};

export const Attendance = ({
  capacity,
  eventId,
  questions,
  slug,
}: AttendanceProps) => {
  const t = useTranslations("nexus.admin.event");
  const locale = useLocale() as Locale;
  const { supabase } = useAuth();
  const data = useQuery({
    queryFn: async () => {
      const [rsvps, waitlist, checkIns] = await Promise.all([
        supabase
          .schema("events")
          .from("rsvps")
          .select("id, user_id, answers, from_waitlist, created_at")
          .eq("event_id", eventId)
          .eq("status", "confirmed")
          .order("created_at"),
        supabase
          .schema("events")
          .from("waitlist")
          .select("id, user_id, created_at")
          .eq("event_id", eventId)
          .eq("status", "waiting")
          .order("created_at"),
        supabase
          .schema("events")
          .from("check_ins")
          .select("user_id")
          .eq("event_id", eventId),
      ]);
      return {
        checkIns: new Set((unwrap(checkIns) ?? []).map((c) => c.user_id)),
        rsvps: unwrap(rsvps) ?? [],
        waitlist: unwrap(waitlist) ?? [],
      };
    },
    queryKey: ["admin", "attendance", eventId],
  });
  const names = useNames([
    ...(data.data?.rsvps.map((r) => r.user_id) ?? []),
    ...(data.data?.waitlist.map((w) => w.user_id) ?? []),
  ]);

  if (data.isPending) {
    return <SectionSpinner />;
  }
  if (!data.data) {
    return null;
  }

  const nameOf = (userId: string) => {
    const profile = names.data?.find((p) => p.id === userId);
    return profile ? memberName(profile, locale) : "—";
  };

  type Rsvp = (typeof data.data.rsvps)[number];
  const rsvpColumns: Column<Rsvp>[] = [
    { cell: (r) => nameOf(r.user_id), header: t("person"), key: "name" },
    {
      cell: (r) => (
        <span className="whitespace-nowrap">
          {formatDateTime(r.created_at, locale)}
          {r.from_waitlist ? (
            <span className="type-caption block">{t("fromWaitlist")}</span>
          ) : null}
        </span>
      ),
      header: t("rsvpedAt"),
      key: "when",
    },
    {
      cell: (r) => (data.data?.checkIns.has(r.user_id) ? t("checkedIn") : ""),
      header: t("checkedIn"),
      key: "checked",
    },
    ...(questions.length
      ? [
          {
            cell: (r: Rsvp) => (
              <dl className="grid gap-1">
                {questions.map((q) => {
                  const answer = (r.answers as Record<string, string>)[q.id];
                  return answer ? (
                    <div key={q.id}>
                      <dt className="type-caption">
                        {locale === "ar"
                          ? q.label_ar || q.label_en
                          : q.label_en || q.label_ar}
                      </dt>
                      <dd>{answer}</dd>
                    </div>
                  ) : null;
                })}
              </dl>
            ),
            header: t("answers"),
            key: "answers",
          },
        ]
      : []),
  ];

  return (
    <section className="grid gap-6 border-rule border-t pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="type-heading">{t("attendance")}</h2>
        <ExportButton
          fileName={`sal-attendance-${slug}.csv`}
          name="attendance"
          params={{ event_id: eventId }}
        />
      </div>
      <h3 className="type-subheading">
        {t("rsvps", {
          count: capacity
            ? `${formatNumber(data.data.rsvps.length)} / ${formatNumber(capacity)}`
            : formatNumber(data.data.rsvps.length),
        })}
      </h3>
      <DataTable
        columns={rsvpColumns}
        rowKey={(r) => r.id}
        rows={data.data.rsvps}
      />
      <h3 className="type-subheading">
        {t("waitlist", { count: formatNumber(data.data.waitlist.length) })}
      </h3>
      <ol className="grid list-decimal gap-1 ps-6">
        {data.data.waitlist.map((w) => (
          <li key={w.id}>{nameOf(w.user_id)}</li>
        ))}
      </ol>
      <Staff eventId={eventId} />
    </section>
  );
};
