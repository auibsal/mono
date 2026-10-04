"use client";

import { resetIdentity } from "@repo/analytics/client";
import { useAuth } from "@repo/auth/provider";
import type { Database } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@repo/design-system/components/ui/radio-group";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { type ReactElement, useId, useState } from "react";
import { ErrorState, SectionSpinner } from "@/components/states";
import {
  markAccountDeleted,
  matchesConfirmation,
} from "@/lib/account-deletion";
import { forgetActiveOrganization } from "@/lib/active-organization";
import { ApiError, callApi } from "@/lib/api";

type Blocker =
  Database["public"]["Functions"]["account_deletion_blockers"]["Returns"][number];

const blockersKey = ["account-deletion-blockers"] as const;

/** The other members of an organization, to hand ownership to. */
const useOtherMembers = (organizationId: string, enabled: boolean) => {
  const { supabase, user } = useAuth();
  return useQuery({
    enabled: enabled && Boolean(user),
    queryFn: async () => {
      const { data: memberships, error } = await supabase
        .from("memberships")
        .select("user_id")
        .eq("organization_id", organizationId)
        .neq("user_id", user?.id ?? "");
      if (error) {
        throw error;
      }
      const ids = memberships.map((membership) => membership.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      if (profilesError) {
        throw profilesError;
      }
      const names = new Map(
        profiles.map((profile) => [profile.id, profile.full_name])
      );
      return ids.map((id) => ({ id, name: names.get(id) ?? null }));
    },
    queryKey: ["organization-members", organizationId],
  });
};

interface BlockerItemProps {
  readonly blocker: Blocker;
  readonly onResolved: () => void;
}

/** One organization the user alone owns: hand it over or delete it. */
const BlockerItem = ({ blocker, onResolved }: BlockerItemProps) => {
  const t = useTranslations("app.settings.deleteAccount.blockers");
  const id = useId();
  const { supabase } = useAuth();
  const canHandOver = blocker.other_members > 0;
  const members = useOtherMembers(blocker.organization_id, canHandOver);
  const [memberId, setMemberId] = useState<string>();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [typedSlug, setTypedSlug] = useState("");
  const [failed, setFailed] = useState(false);

  const makeOwner = useMutation({
    mutationFn: async () => {
      // RLS: only owners may grant the owner role.
      const { data, error } = await supabase
        .from("memberships")
        .update({ role: "owner" })
        .eq("organization_id", blocker.organization_id)
        .eq("user_id", memberId ?? "")
        .select("user_id");
      if (error || data.length === 0) {
        throw error ?? new Error("Membership not updated");
      }
    },
    onError: () => setFailed(true),
    onSuccess: onResolved,
  });

  const deleteOrganization = useMutation({
    mutationFn: () =>
      callApi(supabase, "/organizations/delete", {
        organizationId: blocker.organization_id,
      }),
    onError: () => setFailed(true),
    onSuccess: onResolved,
  });

  const busy = makeOwner.isPending || deleteOrganization.isPending;

  return (
    <section
      aria-labelledby={`${id}-name`}
      className="grid gap-4 rounded-md border p-4"
    >
      <h3 className="font-medium" id={`${id}-name`}>
        {blocker.name}
      </h3>

      {canHandOver ? (
        <fieldset className="grid gap-3" disabled={busy}>
          <legend className="mb-2 text-sm">{t("handOver")}</legend>
          {members.isPending ? <SectionSpinner /> : null}
          {members.data ? (
            <RadioGroup onValueChange={setMemberId} value={memberId}>
              {members.data.map((member) => (
                <div className="flex items-center gap-2" key={member.id}>
                  <RadioGroupItem id={`${id}-${member.id}`} value={member.id} />
                  <Label htmlFor={`${id}-${member.id}`}>
                    {member.name ?? t("unnamed")}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          ) : null}
          <Button
            className="justify-self-start"
            disabled={!memberId}
            onClick={() => {
              setFailed(false);
              makeOwner.mutate();
            }}
            type="button"
            variant="secondary"
          >
            {t("makeOwner")}
          </Button>
        </fieldset>
      ) : (
        <p className="text-muted-foreground text-sm">{t("onlyMember")}</p>
      )}

      {confirmingDelete ? (
        <div className="grid gap-2">
          <Label htmlFor={`${id}-slug`}>
            {t("deleteConfirmLabel", {
              name: blocker.name,
              slug: blocker.slug,
            })}
          </Label>
          <Input
            autoCapitalize="none"
            autoComplete="off"
            className="text-start"
            dir="ltr"
            id={`${id}-slug`}
            onChange={(event) => setTypedSlug(event.target.value)}
            spellCheck={false}
            value={typedSlug}
          />
          <Button
            className="justify-self-start"
            disabled={busy || !matchesConfirmation(typedSlug, blocker.slug)}
            onClick={() => {
              setFailed(false);
              deleteOrganization.mutate();
            }}
            type="button"
            variant="destructive"
          >
            {t("deleteConfirm", { name: blocker.name })}
          </Button>
        </div>
      ) : (
        <Button
          className="justify-self-start"
          disabled={busy}
          onClick={() => setConfirmingDelete(true)}
          type="button"
          variant="outline"
        >
          {t("deleteOrganization")}
        </Button>
      )}

      {failed ? (
        <p className="text-destructive text-sm" role="alert">
          {t("failed")}
        </p>
      ) : null}
    </section>
  );
};

interface ConfirmDeletionProps {
  readonly onBlocked: () => void;
}

/** The final step: type the phrase, then delete through apps/api. */
const ConfirmDeletion = ({ onBlocked }: ConfirmDeletionProps) => {
  const t = useTranslations("app.settings.deleteAccount");
  const id = useId();
  const { supabase } = useAuth();
  const queryClient = useQueryClient();
  const phrase = t("confirmPhrase");
  const [typed, setTyped] = useState("");
  const [failed, setFailed] = useState(false);

  const deleteAccount = useMutation({
    mutationFn: () => callApi(supabase, "/account/delete", {}),
    onError: (error) => {
      // An organization became solely owned meanwhile: show it.
      if (error instanceof ApiError && error.status === 409) {
        onBlocked();
      } else {
        setFailed(true);
      }
    },
    onSuccess: async () => {
      markAccountDeleted();
      forgetActiveOrganization();
      resetIdentity();
      // The account no longer exists, so only the local session is cleared.
      // The auth gates then send the user to sign-in.
      await supabase.auth.signOut({ scope: "local" });
      queryClient.clear();
    },
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setFailed(false);
        deleteAccount.mutate();
      }}
    >
      <p className="text-sm">{t("consequences")}</p>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-confirm`}>{t("confirmLabel", { phrase })}</Label>
        <Input
          autoComplete="off"
          id={`${id}-confirm`}
          onChange={(event) => setTyped(event.target.value)}
          spellCheck={false}
          value={typed}
        />
      </div>
      {failed ? (
        <p className="text-destructive text-sm" role="alert">
          {t("failed")}
        </p>
      ) : null}
      <Button
        disabled={
          deleteAccount.isPending || !matchesConfirmation(typed, phrase)
        }
        type="submit"
        variant="destructive"
      >
        {deleteAccount.isPending ? t("deleting") : t("confirm")}
      </Button>
    </form>
  );
};

const DeleteAccountFlow = () => {
  const t = useTranslations("app.settings.deleteAccount");
  const { supabase } = useAuth();
  const blockers = useQuery({
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("account_deletion_blockers");
      if (error) {
        throw error;
      }
      return data;
    },
    queryKey: blockersKey,
    staleTime: 0,
  });
  const refresh = () => blockers.refetch();

  if (blockers.isPending) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>{t("checking")}</DialogDescription>
        </DialogHeader>
        <SectionSpinner />
      </>
    );
  }

  if (blockers.isError) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <ErrorState onRetry={refresh} />
      </>
    );
  }

  if (blockers.data.length > 0) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t("blockers.title")}</DialogTitle>
          <DialogDescription>{t("blockers.description")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {blockers.data.map((blocker) => (
            <BlockerItem
              blocker={blocker}
              key={blocker.organization_id}
              onResolved={refresh}
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("dialogTitle")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>
      <ConfirmDeletion onBlocked={refresh} />
    </>
  );
};

interface DeleteAccountDialogProps {
  /** The element that opens the dialog (a button or link). */
  readonly trigger: ReactElement;
}

/**
 * Account deletion (App Store / Google Play requirement). Organizations the
 * user alone owns are resolved first: hand them to another member or
 * delete them. Works without an active organization (from onboarding too).
 */
export const DeleteAccountDialog = ({ trigger }: DeleteAccountDialogProps) => {
  const queryClient = useQueryClient();

  return (
    <Dialog
      onOpenChange={(open) => {
        // Organizations may have changed; refresh the switcher on close.
        if (!open) {
          queryClient.invalidateQueries({ queryKey: ["memberships"] });
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DeleteAccountFlow />
      </DialogContent>
    </Dialog>
  );
};

/** The "Delete account" section of the settings screen. */
export const DeleteAccountCard = () => {
  const t = useTranslations("app.settings.deleteAccount");

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <DeleteAccountDialog
          trigger={
            <Button type="button" variant="destructive">
              {t("open")}
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
};
