import { Separator } from "@repo/design-system/components/ui/separator";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar";
import type { ReactNode } from "react";
import { SearchForm } from "./search-form";

interface PageHeaderProps {
  readonly children?: ReactNode;
  readonly title: string;
}

export const PageHeader = ({ children, title }: PageHeaderProps) => (
  <header className="flex h-16 shrink-0 items-center gap-2 px-4">
    <SidebarTrigger className="-ms-1" />
    <Separator className="me-2 h-4" orientation="vertical" />
    <h1 className="truncate font-medium text-base">{title}</h1>
    <div className="ms-auto flex items-center gap-2">
      {children}
      <SearchForm />
    </div>
  </header>
);
