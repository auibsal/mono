import { Link } from "@repo/internationalization/navigation";
import type { ReactNode } from "react";

export interface FooterLink {
  href: string;
  title: string;
}

interface FooterColumnProps {
  readonly href?: string;
  readonly items?: FooterLink[];
  readonly title: string;
}

const isExternal = (href: string) => href.startsWith("http");

const FooterLinkItem = ({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}) =>
  isExternal(href) ? (
    <a
      className="flex items-center justify-between"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {children}
    </a>
  ) : (
    <Link className="flex items-center justify-between" href={href}>
      {children}
    </Link>
  );

export const FooterColumn = ({ href, items, title }: FooterColumnProps) => (
  <div className="flex flex-col items-start gap-1 text-base">
    <div className="flex flex-col gap-2">
      {href ? (
        <FooterLinkItem href={href}>
          <span className="text-xl">{title}</span>
        </FooterLinkItem>
      ) : (
        <p className="text-xl">{title}</p>
      )}
      {items?.map((item) => (
        <FooterLinkItem href={item.href} key={item.href}>
          <span className="text-foreground/75">{item.title}</span>
        </FooterLinkItem>
      ))}
    </div>
  </div>
);
