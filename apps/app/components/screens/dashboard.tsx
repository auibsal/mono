"use client";

import { useAuth } from "@repo/auth/provider";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { Input } from "@repo/design-system/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderIcon, PlusIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { PageHeader } from "@/components/page-header";
import { ProjectList } from "@/components/project-list";
import { ErrorState, SectionSpinner } from "@/components/states";
import { env } from "@/env";
import { queryKeys, useProjects } from "@/lib/queries";

// <module:collaboration>
const Presence = dynamic(() =>
  import("@/components/collaboration/presence").then((mod) => mod.Presence)
);
// </module:collaboration>

export const Dashboard = () => {
  const t = useTranslations("app.dashboard");
  const { supabase, user } = useAuth();
  const { active } = useOrganization();
  const queryClient = useQueryClient();
  const projects = useProjects(active.id);
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").insert({
        created_by: user?.id ?? "",
        name: name.trim(),
        organization_id: active.id,
      });
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      setName("");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.projects(active.id),
      });
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim()) {
      create.mutate();
    }
  };

  return (
    <>
      <PageHeader title={active.name}>
        {/* <module:collaboration> */}
        {env.NEXT_PUBLIC_LIVEBLOCKS_ENABLED === "true" ? (
          <Presence organizationId={active.id} />
        ) : null}
        {/* </module:collaboration> */}
      </PageHeader>
      <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-1">
            <h2 className="font-semibold text-xl tracking-tight">
              {t("title")}
            </h2>
            <p className="text-muted-foreground text-sm">{t("description")}</p>
          </div>
          <form className="flex gap-2" onSubmit={submit}>
            <Input
              aria-label={t("projectName")}
              className="w-48"
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("projectName")}
              value={name}
            />
            <Button disabled={create.isPending || !name.trim()} type="submit">
              <PlusIcon />
              {create.isPending ? t("creating") : t("newProject")}
            </Button>
          </form>
        </div>

        {projects.isPending ? <SectionSpinner /> : null}
        {projects.isError ? (
          <ErrorState onRetry={() => projects.refetch()} />
        ) : null}
        {projects.data?.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderIcon />
              </EmptyMedia>
              <EmptyTitle>{t("empty.title")}</EmptyTitle>
              <EmptyDescription>{t("empty.description")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
        {projects.data?.length ? (
          <ProjectList projects={projects.data} />
        ) : null}
      </div>
    </>
  );
};
