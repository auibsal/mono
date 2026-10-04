import { Button } from "@repo/design-system/components/ui/button";
import { Link } from "@repo/internationalization/navigation";
import { useTranslations } from "next-intl";

const NotFound = () => {
  const t = useTranslations("common.notFound");

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-6xl flex-col items-start justify-center gap-4 px-4 py-20">
      <h1 className="type-display">{t("title")}</h1>
      <p className="type-lede max-w-md">{t("description")}</p>
      <Button asChild>
        <Link href="/">{t("home")}</Link>
      </Button>
    </div>
  );
};

export default NotFound;
