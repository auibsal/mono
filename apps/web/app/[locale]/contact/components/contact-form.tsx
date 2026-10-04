"use client";

import { track } from "@repo/analytics/client";
import { Button } from "@repo/design-system/components/ui/button";
import { Calendar } from "@repo/design-system/components/ui/calendar";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import { getDirection, type Messages } from "@repo/internationalization";
import {
  formatCalendarDate,
  formatMonthYear,
  formatWeekday,
  WEEK_STARTS_ON,
} from "@repo/internationalization/format";
import { format } from "date-fns";
import { CalendarIcon, Check, MoveRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useId, useState, useTransition } from "react";
import { ar, enGB } from "react-day-picker/locale";
import { type ContactResult, contact } from "../actions/contact";

type Benefits = Messages["web"]["contact"]["hero"]["benefits"];

const calendarLocales = { ar, ckb: ar, en: enGB } as const;

export const ContactForm = () => {
  const t = useTranslations("web.contact");
  const locale = useLocale();
  const id = useId();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [result, setResult] = useState<ContactResult | null>(null);
  const [pending, startTransition] = useTransition();
  const benefits = t.raw("hero.benefits") as Benefits;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const form = event.currentTarget;

    startTransition(async () => {
      const response = await contact({
        date: date ? format(date, "yyyy-MM-dd") : undefined,
        dateLabel: date ? formatCalendarDate(date, locale) : undefined,
        email: String(data.get("email") ?? ""),
        message: String(data.get("message") ?? ""),
        name: String(data.get("name") ?? ""),
      });
      setResult(response);
      if (response.ok) {
        form.reset();
        track("generate_lead", {});
      }
    });
  };

  return (
    <div className="w-full py-20 lg:py-40">
      <div className="container mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h1 className="max-w-xl text-start font-regular text-3xl tracking-tighter md:text-5xl">
                  {t("meta.title")}
                </h1>
                <p className="max-w-sm text-start text-lg text-muted-foreground leading-relaxed tracking-tight">
                  {t("meta.description")}
                </p>
              </div>
            </div>
            {benefits.map((benefit) => (
              <div
                className="flex flex-row items-start gap-6 text-start"
                key={benefit.title}
              >
                <Check className="mt-2 h-4 w-4 text-primary" />
                <div className="flex flex-col gap-1">
                  <p>{benefit.title}</p>
                  <p className="text-muted-foreground text-sm">
                    {benefit.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center">
            <form
              className="flex w-full max-w-sm flex-col gap-4 rounded-md border p-8"
              noValidate
              onSubmit={submit}
            >
              <p>{t("hero.form.title")}</p>
              <div className="grid w-full items-center gap-1">
                <Label htmlFor={`${id}-date`}>{t("hero.form.date")}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      className={cn(
                        "w-full justify-start text-start font-normal",
                        !date && "text-muted-foreground"
                      )}
                      id={`${id}-date`}
                      type="button"
                      variant="outline"
                    >
                      <CalendarIcon className="me-2 h-4 w-4" />
                      {date
                        ? formatCalendarDate(date, locale)
                        : t("hero.form.pickDate")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      autoFocus
                      dir={getDirection(locale)}
                      // Iraqi month names (كانون الثاني …) instead of the
                      // Egyptian/Gulf ones in the date library's Arabic locale.
                      formatters={{
                        formatCaption: (month) =>
                          formatMonthYear(month, locale),
                        // Arabic has no short weekday names; calendars use
                        // the one-letter forms (س ح ن …).
                        formatWeekdayName: (weekday) =>
                          formatWeekday(
                            weekday,
                            locale,
                            getDirection(locale) === "rtl" ? "narrow" : "short"
                          ),
                      }}
                      locale={calendarLocales[locale]}
                      mode="single"
                      numerals="latn"
                      onSelect={setDate}
                      selected={date}
                      weekStartsOn={WEEK_STARTS_ON}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid w-full items-center gap-1">
                <Label htmlFor={`${id}-name`}>{t("hero.form.name")}</Label>
                <Input
                  autoComplete="name"
                  id={`${id}-name`}
                  name="name"
                  required
                  type="text"
                />
              </div>
              <div className="grid w-full items-center gap-1">
                <Label htmlFor={`${id}-email`}>{t("hero.form.email")}</Label>
                <Input
                  autoComplete="email"
                  dir="ltr"
                  id={`${id}-email`}
                  name="email"
                  required
                  type="email"
                />
              </div>
              <div className="grid w-full items-center gap-1">
                <Label htmlFor={`${id}-message`}>
                  {t("hero.form.message")}
                </Label>
                <Textarea id={`${id}-message`} name="message" required />
              </div>

              {result ? (
                <p
                  className={cn(
                    "text-sm",
                    result.ok ? "text-primary" : "text-destructive"
                  )}
                  role={result.ok ? "status" : "alert"}
                >
                  {result.ok
                    ? t("hero.form.success")
                    : t(`hero.form.errors.${result.error}`)}
                </p>
              ) : null}

              <Button className="w-full gap-4" disabled={pending} type="submit">
                {pending ? t("hero.form.sending") : t("hero.form.cta")}{" "}
                <MoveRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
