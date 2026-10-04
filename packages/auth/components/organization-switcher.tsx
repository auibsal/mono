"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { type AuthMessages, defaultAuthMessages } from "../messages";
import type { OrganizationMembership } from "../organizations";

interface OrganizationSwitcherProps {
  readonly activeId: string | null;
  readonly messages?: AuthMessages;
  /** Opens the "create organization" page; the item is hidden when omitted. */
  readonly onCreate?: () => void;
  /** Called with the chosen organization; the app remembers the choice. */
  readonly onSelect: (organizationId: string) => void;
  readonly organizations: OrganizationMembership[];
}

/** Switches the organization the user is working in. */
export const OrganizationSwitcher = ({
  activeId,
  messages = defaultAuthMessages,
  onCreate,
  onSelect,
  organizations,
}: OrganizationSwitcherProps) => {
  const active = organizations.find(
    (organization) => organization.id === activeId
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="w-full justify-between gap-2" variant="ghost">
          <span className="truncate">
            {active?.name ?? messages.organizations}
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuLabel>{messages.organizations}</DropdownMenuLabel>
        {organizations.map((organization) => (
          <DropdownMenuItem
            key={organization.id}
            onSelect={() => onSelect(organization.id)}
          >
            <span className="truncate">{organization.name}</span>
            {organization.id === activeId ? (
              <CheckIcon className="ms-auto size-4" />
            ) : null}
          </DropdownMenuItem>
        ))}
        {onCreate ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onCreate}>
              <PlusIcon className="size-4" />
              {messages.createOrganization}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
