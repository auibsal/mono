"use client";

import { useRouter } from "@repo/internationalization/navigation";
import { useTranslations } from "next-intl";
import { CreateOrganizationForm } from "@/components/organization-form";
import { useOrganization } from "@/components/organization-provider";
import { PageHeader } from "@/components/page-header";

export const NewOrganization = () => {
  const t = useTranslations("app.organizations.new");
  const router = useRouter();
  const { select } = useOrganization();

  return (
    <>
      <PageHeader title={t("title")} />
      <div className="flex max-w-md flex-1 flex-col gap-6 p-4 pt-0">
        <p className="text-muted-foreground">{t("description")}</p>
        <CreateOrganizationForm
          onCreated={(organizationId) => {
            select(organizationId);
            router.push("/");
          }}
        />
      </div>
    </>
  );
};
