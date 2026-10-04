"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { LogOutIcon, UserIcon } from "lucide-react";
import { type AuthMessages, defaultAuthMessages } from "../messages";
import { formatPhone } from "../phone";
import { useAuth } from "../provider";

const WHITESPACE = /\s+/;

const getInitials = (name: string) =>
  name
    .split(WHITESPACE)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

interface UserMenuProps {
  readonly messages?: AuthMessages;
  /** Display name, e.g. from the profile; defaults to the sign-up name. */
  readonly name?: string | null;
  /** Called after signing out, e.g. to navigate to the sign-in page. */
  readonly onSignedOut?: () => void;
}

/** Avatar button with the signed-in user's details and a sign-out action. */
export const UserMenu = ({
  messages = defaultAuthMessages,
  name: displayName,
  onSignedOut,
}: UserMenuProps) => {
  const { supabase, user } = useAuth();

  if (!user) {
    return null;
  }

  const name: string | undefined =
    displayName || user.user_metadata?.full_name || undefined;
  const contact = user.phone ? formatPhone(user.phone) : (user.email ?? "");
  const avatarUrl: string | undefined = user.user_metadata?.avatar_url;

  const signOut = async () => {
    await supabase.auth.signOut();
    onSignedOut?.();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="h-auto gap-2 px-2 py-1.5" variant="ghost">
          <Avatar className="size-7">
            {avatarUrl ? <AvatarImage alt="" src={avatarUrl} /> : null}
            <AvatarFallback>
              {name ? getInitials(name) : <UserIcon className="size-4" />}
            </AvatarFallback>
          </Avatar>
          {name ? (
            <span className="truncate text-start text-sm">{name}</span>
          ) : (
            // Phone numbers read left-to-right in Arabic too.
            <span className="truncate text-sm" dir="ltr">
              {contact}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuLabel className="grid gap-0.5">
          {name ? <span className="truncate">{name}</span> : null}
          <span
            className="truncate font-normal text-muted-foreground"
            dir="ltr"
          >
            {contact}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOutIcon className="rtl:rotate-180" />
          {messages.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
