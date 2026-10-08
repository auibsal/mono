"use client";

import { cn } from "@repo/design-system/lib/utils";
import { Link, usePathname } from "@repo/internationalization/navigation";
import {
  type AdminModule,
  adminModules,
  hasPermissionAnywhere,
} from "@repo/rbac";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useGrants } from "@/lib/queries";
import { TwoStepPanel, useTwoStep } from "../auth/two-step";
import { SectionSpinner } from "../states";

const hrefFor = (module: AdminModule) =>
  module === "overview" ? "/admin" : `/admin/${module}`;

/** The admin modules the member's grants show (RLS still decides the rows). */
export const useVisibleModules = () => {
  const grants = useGrants();
  const visible = adminModules.filter((module) =>
    module.permissions.some((permission) =>
      hasPermissionAnywhere(grants.data, permission)
    )
  );
  return { grants, visible };
};

/** Section navigation for the administration area. */
export const AdminShell = ({ children }: { children: ReactNode }) => {
  const t = useTranslations("nexus.admin");
  const pathname = usePathname();
  const { grants, visible } = useVisibleModules();
  const twoStep = useTwoStep();

  if (grants.isPending || twoStep.isPending) {
    return <SectionSpinner />;
  }
  // Council and Elections permissions wait for the second factor.
  if (twoStep.data?.needs && !twoStep.data.done) {
    return <TwoStepPanel />;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[14rem_1fr]">
      <nav aria-label={t("nav.label")}>
        <p className="type-kicker mb-2">{t("title")}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 lg:flex-col">
          {visible.map((module) => {
            const href = hrefFor(module.key);
            const active =
              module.key === "overview"
                ? pathname === "/admin"
                : pathname.startsWith(href);
            return (
              <li key={module.key}>
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block py-1 text-sm underline-offset-4 hover:underline",
                    active && "font-bold text-title"
                  )}
                  href={href}
                >
                  {t(`nav.${module.key}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
};

/**
 * Shows a module only to members whose grants include it. A convenience:
 * every row and write is still decided by Row Level Security.
 */
export const RequireModule = ({
  children,
  module,
}: {
  children: ReactNode;
  module: AdminModule;
}) => {
  const t = useTranslations("nexus.admin");
  const { grants, visible } = useVisibleModules();

  if (grants.isPending) {
    return <SectionSpinner />;
  }
  if (!visible.some((m) => m.key === module)) {
    return <p className="type-body text-text-secondary">{t("noAccess")}</p>;
  }
  return children;
};
