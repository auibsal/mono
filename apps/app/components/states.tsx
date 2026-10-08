"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "@repo/design-system/lib/utils";
import { Link } from "@repo/internationalization/navigation";
import { useTranslations } from "next-intl";

export const FullPageSpinner = () => (
  <div className="flex min-h-dvh items-center justify-center">
    <Spinner className="size-6 text-text-meta" />
  </div>
);

export const SectionSpinner = ({ className }: { className?: string }) => (
  <div className={cn("flex items-center justify-center py-8", className)}>
    <Spinner className="size-5 text-text-meta" />
  </div>
);

interface ErrorStateProps {
  readonly className?: string;
  readonly onRetry?: () => void;
}

export const ErrorState = ({ className, onRetry }: ErrorStateProps) => {
  const t = useTranslations();

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-8 text-center",
        className
      )}
      role="alert"
    >
      <p className="type-body text-text-secondary">
        {t("nexus.errors.loadFailed")}
      </p>
      {onRetry ? (
        <Button onClick={onRetry} size="sm" variant="outline">
          {t("common.retry")}
        </Button>
      ) : null}
    </div>
  );
};

const actionClass = "type-label text-xs underline underline-offset-4";
const EXTERNAL = /^(https?|webcal):/;

const ActionLink = ({ href, label }: { href: string; label: string }) =>
  EXTERNAL.test(href) ? (
    <a className={actionClass} href={href}>
      {label}
    </a>
  ) : (
    <Link className={actionClass} href={href}>
      {label}
    </Link>
  );

/**
 * One muted line for an empty section, with the next thing to do: every
 * empty state in the Nexus offers one (an internal path or a full URL).
 */
export const EmptyLine = ({
  action,
  children,
}: {
  readonly action?: { href: string; label: string };
  readonly children: string;
}) => (
  <div className="grid justify-items-start gap-2">
    <p className="type-body text-text-secondary">{children}</p>
    {action ? <ActionLink {...action} /> : null}
  </div>
);
