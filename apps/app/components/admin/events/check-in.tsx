"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import type { Locale } from "@repo/internationalization";
import {
  formatClock,
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { DataError, localized, unwrap } from "@repo/sal-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import jsQR from "jsqr";
import { useLocale, useTranslations } from "next-intl";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useQueryParam } from "@/lib/use-query-param";
import { SectionSpinner } from "../../states";
import { AdminHeading, Field } from "../kit";
import { memberName } from "../members/directory";
import { useAttendeeSearch } from "./attendance";

const TICKET = /^sal:ticket:([0-9a-f]{24})$/;
const MEMBER = /^sal:member:([0-9a-f-]{36})$/;

/** What a scanned code asks for: a ticket, a membership card, or nothing. */
export const parseScan = (value: string) => {
  const ticket = TICKET.exec(value.trim());
  if (ticket?.[1]) {
    return { ticket_code: ticket[1] } as const;
  }
  const member = MEMBER.exec(value.trim());
  if (member?.[1]) {
    return { target_user: member[1] } as const;
  }
  return null;
};

type Outcome =
  | { kind: "checked"; name: string }
  | { kind: "already"; name: string }
  | { kind: "invalid" }
  | { kind: "unknown" }
  | { kind: "error" };

const SCAN_INTERVAL_MS = 250;

/** Reads a DOM ref (null until mounted). */
const current = <T,>(ref: RefObject<T | null>): T | null => ref.current;
const SAME_CODE_PAUSE_MS = 3000;

export const CheckInScreen = () => {
  const t = useTranslations("nexus.admin.checkIn");
  const tk = useTranslations("nexus.admin.kit");
  const locale = useLocale() as Locale;
  const eventId = useQueryParam("id") ?? "";
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastCode = useRef<{ at: number; value: string } | null>(null);
  const [camera, setCamera] = useState<"off" | "on" | "unavailable">("off");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [query, setQuery] = useState("");

  const event = useQuery({
    enabled: Boolean(eventId),
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("events")
          .from("events")
          .select("id, title_en, title_ar, starts_at")
          .eq("id", eventId)
          .maybeSingle()
      ),
    queryKey: ["admin", "check-in-event", eventId],
  });
  const count = useQuery({
    enabled: Boolean(eventId),
    queryFn: async () =>
      (
        await supabase
          .schema("events")
          .from("check_ins")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId)
      ).count ?? 0,
    queryKey: ["admin", "check-in-count", eventId],
  });
  const results = useAttendeeSearch(eventId, query);

  const checkIn = useMutation({
    mutationFn: async (
      target: { ticket_code: string } | { target_user: string }
    ) =>
      unwrap(
        await supabase
          .schema("events")
          .rpc("check_in", { event_id: eventId, ...target })
      ),
    onError: (error) =>
      setOutcome(
        error instanceof DataError && error.code === "P0002"
          ? { kind: "invalid" }
          : { kind: "error" }
      ),
    onSuccess: async (rows) => {
      const person = rows?.[0];
      const name = person ? memberName(person, locale) : "";
      setOutcome({ kind: person?.already ? "already" : "checked", name });
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });

  const handleCode = useCallback(
    (value: string) => {
      const now = Date.now();
      if (
        lastCode.current?.value === value &&
        now - lastCode.current.at < SAME_CODE_PAUSE_MS
      ) {
        return;
      }
      lastCode.current = { at: now, value };
      const target = parseScan(value);
      if (target) {
        checkIn.mutate(target);
      } else {
        setOutcome({ kind: "unknown" });
      }
    },
    [checkIn]
  );

  const stop = useCallback(() => {
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;
    setCamera((c) => (c === "on" ? "off" : c));
  }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      const video = current(videoRef);
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setCamera("on");
    } catch {
      setCamera("unavailable");
    }
  };

  useEffect(() => {
    if (camera !== "on") {
      return;
    }
    const timer = window.setInterval(() => {
      const video = current(videoRef);
      const canvas = current(canvasRef);
      if (!(video && canvas) || video.readyState < video.HAVE_ENOUGH_DATA) {
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        return;
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(image.data, image.width, image.height, {
        inversionAttempts: "dontInvert",
      });
      if (code?.data) {
        handleCode(code.data);
      }
    }, SCAN_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [camera, handleCode]);

  useEffect(() => stop, [stop]);

  if (event.isPending) {
    return <SectionSpinner />;
  }
  if (!event.data) {
    return <p className="type-body text-text-secondary">{t("unknownCode")}</p>;
  }

  let message: string | null = null;
  if (outcome?.kind === "checked") {
    message = t("checkedIn", { name: outcome.name });
  } else if (outcome?.kind === "already") {
    message = t("already", { name: outcome.name });
  } else if (outcome?.kind === "invalid") {
    message = t("invalidTicket");
  } else if (outcome?.kind === "unknown") {
    message = t("unknownCode");
  } else if (outcome?.kind === "error") {
    message = tk("reasons.unknown");
  }

  return (
    <div className="grid max-w-2xl gap-6">
      <AdminHeading
        actions={
          <Link
            className="text-sm underline underline-offset-4"
            href={{ pathname: "/admin/events/edit", query: { id: eventId } }}
          >
            {tk("back")}
          </Link>
        }
        title={`${t("title")}: ${localized(event.data, "title", locale)}`}
      >
        {formatLongDate(event.data.starts_at, locale)},{" "}
        {formatClock(event.data.starts_at, locale)}
      </AdminHeading>
      <p className="type-body text-text-secondary">{t("lede")}</p>
      <p className="font-bold text-title" role="status">
        {t("count", { count: formatNumber(count.data ?? 0) })}
      </p>

      <div className="grid gap-3">
        <video
          aria-label={t("video")}
          className={
            camera === "on" ? "w-full rounded-card bg-surface-tint" : "hidden"
          }
          muted
          playsInline
          ref={videoRef}
        />
        <canvas className="hidden" ref={canvasRef} />
        {camera === "on" ? (
          <Button
            className="justify-self-start"
            onClick={stop}
            variant="outline"
          >
            {t("stopCamera")}
          </Button>
        ) : (
          <Button className="justify-self-start" onClick={start}>
            {t("startCamera")}
          </Button>
        )}
        {camera === "unavailable" ? (
          <p className="type-body text-text-secondary">
            {t("cameraUnavailable")}
          </p>
        ) : null}
      </div>

      <p
        aria-live="assertive"
        className={
          message
            ? "rounded-card bg-surface-tint p-card-padding font-bold text-lg text-text"
            : "sr-only"
        }
      >
        {message}
      </p>

      <section className="grid gap-3">
        <Field label={t("lookup")}>
          {(id) => (
            <Input
              id={id}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              value={query}
            />
          )}
        </Field>
        {results.data &&
        query.trim().length >= 2 &&
        results.data.length === 0 ? (
          <p className="type-body text-text-secondary">{t("noResults")}</p>
        ) : null}
        <ul className="grid gap-2">
          {results.data?.map((person) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 border-rule border-b py-2"
              key={person.user_id}
            >
              <span>
                <span className="font-medium">
                  {memberName(person, locale)}
                </span>
                <span className="type-caption block">
                  {person.has_rsvp ? t("hasRsvp") : t("noRsvp")}
                </span>
              </span>
              <Button
                disabled={checkIn.isPending}
                onClick={() => checkIn.mutate({ target_user: person.user_id })}
                size="sm"
              >
                {t("checkInPerson")}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};
