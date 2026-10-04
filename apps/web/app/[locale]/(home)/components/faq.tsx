import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/design-system/components/ui/accordion";
import { Button } from "@repo/design-system/components/ui/button";
import type { Messages } from "@repo/internationalization";
import { Link } from "@repo/internationalization/navigation";
import { PhoneCall } from "lucide-react";
import { useTranslations } from "next-intl";

type FaqItems = Messages["web"]["home"]["faq"]["items"];

export const FAQ = () => {
  const t = useTranslations("web.home.faq");
  const items = t.raw("items") as FaqItems;

  return (
    <div className="w-full py-20 lg:py-40">
      <div className="container mx-auto">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h4 className="max-w-xl text-start font-regular text-3xl tracking-tighter md:text-5xl">
                  {t("title")}
                </h4>
                <p className="max-w-xl text-start text-lg text-muted-foreground leading-relaxed tracking-tight lg:max-w-lg">
                  {t("description")}
                </p>
              </div>
              <div className="">
                <Button asChild className="gap-4" variant="outline">
                  <Link href="/contact">
                    {t("cta")} <PhoneCall className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
          <Accordion className="w-full" collapsible type="single">
            {items.map((item) => (
              <AccordionItem key={item.question} value={item.question}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
};
