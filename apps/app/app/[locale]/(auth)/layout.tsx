import { project } from "@repo/config";
import { BrandLogo } from "@repo/design-system/components/brand-logo";
import type { ReactNode } from "react";
import { GuestOnly } from "@/components/gates";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

interface AuthLayoutProps {
  readonly children: ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => (
  <GuestOnly>
    <div className="container relative grid min-h-dvh flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="absolute end-4 top-4 z-30 flex items-center gap-1">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <div className="relative hidden h-full flex-col bg-muted p-10 lg:flex dark:border-e">
        <div className="relative z-20 flex items-center font-medium text-lg text-primary">
          <BrandLogo />
        </div>
        <div className="relative z-20 mt-auto text-primary">
          <p className="text-lg">{project.orgName}</p>
        </div>
      </div>
      <div className="py-16 lg:p-8">
        <div className="mx-auto flex w-full max-w-[400px] flex-col justify-center gap-6">
          <div className="lg:hidden">
            <BrandLogo />
          </div>
          {children}
        </div>
      </div>
    </div>
  </GuestOnly>
);

export default AuthLayout;
