import type { Locale, Messages } from "@repo/internationalization";
import {
  formatCurrency,
  formatNumber,
} from "@repo/internationalization/format";
import { MoveDownLeft, MoveUpRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

type StatItems = Messages["web"]["home"]["stats"]["items"];

const formatMetric = (item: StatItems[number], locale: Locale) => {
  const value = Number.parseFloat(item.metric);
  return item.type === "currency"
    ? formatCurrency(value, locale)
    : formatNumber(value, locale);
};

export const Stats = () => {
  const t = useTranslations("web.home.stats");
  const locale = useLocale();
  const items = t.raw("items") as StatItems;

  return (
    <div className="w-full py-20 lg:py-40">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div className="flex flex-col items-start gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="text-start font-regular text-xl tracking-tighter md:text-5xl lg:max-w-xl">
                {t("title")}
              </h2>
              <p className="text-start text-lg text-muted-foreground leading-relaxed tracking-tight lg:max-w-sm">
                {t("description")}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="grid w-full grid-cols-1 gap-2 text-start sm:grid-cols-2 lg:grid-cols-2">
              {items.map((item) => (
                <div
                  className="flex flex-col justify-between gap-0 rounded-md border p-6"
                  key={item.title}
                >
                  {Number.parseFloat(item.delta) > 0 ? (
                    <MoveUpRight className="mb-10 h-4 w-4 text-primary" />
                  ) : (
                    <MoveDownLeft className="mb-10 h-4 w-4 text-destructive" />
                  )}
                  <h2 className="flex max-w-xl flex-row items-end gap-4 text-start font-regular text-4xl tracking-tighter">
                    {formatMetric(item, locale)}
                    <span className="text-muted-foreground text-sm tracking-normal">
                      {formatNumber(
                        Number.parseFloat(item.delta) / 100,
                        locale,
                        {
                          signDisplay: "exceptZero",
                          style: "percent",
                        }
                      )}
                    </span>
                  </h2>
                  <p className="max-w-xl text-start text-base text-muted-foreground leading-relaxed tracking-tight">
                    {item.title}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
