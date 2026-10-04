"use client";

import { project } from "@repo/config";
import { BrandLogo } from "@repo/design-system/components/brand-logo";
import { Button } from "@repo/design-system/components/ui/button";
import { formatNumber } from "@repo/internationalization/format";
import { useRouter } from "@repo/internationalization/navigation";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { DeleteAccountDialog } from "@/components/account/delete-account";
import { CreateOrganizationForm } from "@/components/organization-form";
import { ProfileForm } from "@/components/profile-form";
import { ErrorState, FullPageSpinner } from "@/components/states";
import { useMemberships, useProfile } from "@/lib/queries";
import { PendingInvitations } from "./pending-invitations";

const TOTAL_STEPS = 2;

/**
 * First run after sign-up: (1) name and language, (2) join an organization
 * the user was invited to, or create one. Users who already belong to an
 * organization go straight to the app.
 */
export const OnboardingFlow = () => {
  const t = useTranslations("app.onboarding");
  const tAccount = useTranslations("app.settings.deleteAccount");
  const locale = useLocale();
  const router = useRouter();
  const step = useSearchParams().get("step") === "organization" ? 2 : 1;
  const memberships = useMemberships();
  const profile = useProfile();

  useEffect(() => {
    if (memberships.data?.length) {
      router.replace("/");
    }
  }, [memberships.data, router]);

  if (memberships.isError || profile.isError) {
    return (
      <ErrorState
        className="min-h-dvh"
        onRetry={() => {
          memberships.refetch();
          profile.refetch();
        }}
      />
    );
  }

  if (!(memberships.data && profile.data) || memberships.data.length > 0) {
    return <FullPageSpinner />;
  }

  const goToApp = () => router.replace("/");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-8 p-6">
      <div className="grid gap-3">
        <BrandLogo />
        <p className="text-muted-foreground text-sm">
          {t("stepOf", {
            current: formatNumber(step, locale),
            total: formatNumber(TOTAL_STEPS, locale),
          })}
        </p>
        <h1 className="font-semibold text-2xl tracking-tight">
          {t("title", { name: project.name })}
        </h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      {step === 1 ? (
        <section className="grid gap-4">
          <div className="grid gap-1">
            <h2 className="font-medium text-lg">{t("profile.title")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("profile.description")}
            </p>
          </div>
          <ProfileForm
            initialName={profile.data.full_name ?? ""}
            onSaved={(language) =>
              // Switching language reloads the page in that language.
              router.replace(
                { pathname: "/onboarding", query: { step: "organization" } },
                { locale: language }
              )
            }
            submitLabel={t("profile.submit")}
          />
        </section>
      ) : (
        <div className="grid gap-6">
          <PendingInvitations onJoined={goToApp} />
          <section className="grid gap-4">
            <div className="grid gap-1">
              <h2 className="font-medium text-lg">{t("organization.title")}</h2>
              <p className="text-muted-foreground text-sm">
                {t("organization.description")}
              </p>
            </div>
            <CreateOrganizationForm onCreated={goToApp} />
          </section>
        </div>
      )}
      {/* Account deletion must be reachable before an organization exists. */}
      <footer className="border-t pt-4 text-center">
        <DeleteAccountDialog
          trigger={
            <Button
              className="text-muted-foreground"
              size="sm"
              type="button"
              variant="link"
            >
              {tAccount("open")}
            </Button>
          }
        />
      </footer>
    </main>
  );
};
