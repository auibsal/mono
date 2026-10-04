"use client";

import { listMemberships } from "@repo/auth/organizations";
import { useAuth } from "@repo/auth/provider";
import { useQuery } from "@tanstack/react-query";

/**
 * Data hooks. Every query runs with the signed-in user's session, so Row
 * Level Security decides what comes back; keys include the user and
 * organization so switching either refetches.
 */

export const queryKeys = {
  invitations: (userId: string) => ["invitations", userId] as const,
  memberships: (userId: string) => ["memberships", userId] as const,
  payments: (organizationId: string) => ["payments", organizationId] as const,
  plans: ["plans"] as const,
  profile: (userId: string) => ["profile", userId] as const,
  projects: (organizationId: string, search?: string) =>
    ["projects", organizationId, search ?? ""] as const,
  subscription: (organizationId: string) =>
    ["subscription", organizationId] as const,
};

const requireUserId = (userId: string | undefined) => {
  if (!userId) {
    throw new Error("Not signed in");
  }
  return userId;
};

export const useMemberships = () => {
  const { supabase, user } = useAuth();
  return useQuery({
    enabled: Boolean(user),
    queryFn: () => listMemberships(supabase, requireUserId(user?.id)),
    queryKey: queryKeys.memberships(user?.id ?? ""),
  });
};

export const useProfile = () => {
  const { supabase, user } = useAuth();
  return useQuery({
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, locale")
        .eq("id", requireUserId(user?.id))
        .single();
      if (error) {
        throw error;
      }
      return data;
    },
    queryKey: queryKeys.profile(user?.id ?? ""),
  });
};

export const usePendingInvitations = () => {
  const { supabase, user } = useAuth();
  return useQuery({
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pending_invitations");
      if (error) {
        throw error;
      }
      return data;
    },
    queryKey: queryKeys.invitations(user?.id ?? ""),
  });
};

const LIKE_WILDCARDS = /[%_\\]/g;

export const useProjects = (organizationId: string, search?: string) => {
  const { supabase } = useAuth();
  return useQuery({
    queryFn: async () => {
      let query = supabase
        .from("projects")
        .select("id, name, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      if (search) {
        // Escape LIKE wildcards so the search matches literally.
        query = query.ilike(
          "name",
          `%${search.replace(LIKE_WILDCARDS, "\\$&")}%`
        );
      }
      const { data, error } = await query;
      if (error) {
        throw error;
      }
      return data;
    },
    queryKey: queryKeys.projects(organizationId, search),
  });
};

export const usePlans = () => {
  const { supabase } = useAuth();
  return useQuery({
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, name, amount, currency, billing_interval")
        .eq("active", true)
        .order("amount");
      if (error) {
        throw error;
      }
      return data;
    },
    queryKey: queryKeys.plans,
  });
};

export const useSubscription = (organizationId: string) => {
  const { supabase } = useAuth();
  return useQuery({
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, plan_id, status, current_period_end, cancel_at_period_end")
        .eq("organization_id", organizationId)
        .in("status", ["active", "past_due", "incomplete"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data;
    },
    queryKey: queryKeys.subscription(organizationId),
  });
};

/** Owners and admins only (RLS returns nothing for members). */
export const usePayments = (organizationId: string, enabled: boolean) => {
  const { supabase } = useAuth();
  return useQuery({
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          "id, amount, currency, status, description, created_at, reference_id"
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) {
        throw error;
      }
      return data;
    },
    queryKey: queryKeys.payments(organizationId),
  });
};
