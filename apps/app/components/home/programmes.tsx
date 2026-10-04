"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import { formatClock, formatLongDate } from "@repo/internationalization/format";
import { localized } from "@repo/sal-data";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { queryKeys, useMyShifts } from "@/lib/queries";
import { EmptyLine } from "../states";
import { Section } from "./section";

export const MyProgrammes = () => {
  const t = useTranslations("nexus.home.programmes");
  const locale = useLocale() as "en" | "ar";
  const { supabase, user } = useAuth();
  const queryClient = useQueryClient();
  const shifts = useMyShifts();

  const update = useMutation({
    mutationFn: async ({
      shiftId,
      status,
    }: {
      shiftId: string;
      status: "confirmed" | "swap_requested";
    }) => {
      const { error } = await supabase
        .schema("programmes")
        .from("shift_signups")
        .update({ status })
        .eq("shift_id", shiftId)
        .eq("user_id", user?.id ?? "");
      if (error) {
        throw error;
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.shifts(user?.id ?? ""),
      }),
  });

  return (
    <Section id="programmes" title={t("title")}>
      {shifts.data?.length === 0 ? <EmptyLine>{t("empty")}</EmptyLine> : null}
      <ul className="grid gap-3">
        {shifts.data?.map((signup) =>
          signup.shift ? (
            <li
              className="grid gap-1 border-rule border-b pb-3"
              key={signup.shift_id}
            >
              <p className="type-body font-bold">
                {localized(signup.shift, "role", locale)}
              </p>
              <p className="type-caption">
                {formatLongDate(signup.shift.starts_at, locale)} ·{" "}
                {formatClock(signup.shift.starts_at, locale)}
              </p>
              {signup.status === "signed_up" ? (
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      update.mutate({
                        shiftId: signup.shift_id,
                        status: "confirmed",
                      })
                    }
                    size="sm"
                  >
                    {t("confirm")}
                  </Button>
                  <Button
                    onClick={() =>
                      update.mutate({
                        shiftId: signup.shift_id,
                        status: "swap_requested",
                      })
                    }
                    size="sm"
                    variant="outline"
                  >
                    {t("swap")}
                  </Button>
                </div>
              ) : null}
            </li>
          ) : null
        )}
      </ul>
    </Section>
  );
};
