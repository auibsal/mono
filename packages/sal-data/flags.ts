import type { Database } from "@repo/database";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Feature switches, stored as public `features.<key>` rows in core.settings
 * and edited in the Nexus (Settings). The database enforces the switches
 * that guard data (e.g. elections RPCs check `features.elections`); these
 * helpers only decide what to show.
 */
export const flags = {
  elections: {
    default: false,
    description:
      "Online nominations, ballots and results (Elections Committee decides).",
  },
  volunteer_certificates: {
    default: false,
    description:
      "Certificates for volunteer hours, beyond the Bylaws' certificates of service (Council decides).",
  },
} as const;

export type Flag = keyof typeof flags;

export const flagKeys = Object.keys(flags) as Flag[];

export const settingKey = (flag: Flag) => `features.${flag}`;

export type FlagValues = Record<Flag, boolean>;

/** Reads every flag in one query; unknown or missing rows use the default. */
export const readFlags = async (
  supabase: SupabaseClient<Database>
): Promise<FlagValues> => {
  const { data } = await supabase
    .schema("core")
    .from("settings")
    .select("key, value")
    .in("key", flagKeys.map(settingKey));

  return Object.fromEntries(
    flagKeys.map((flag) => {
      const row = data?.find((r) => r.key === settingKey(flag));
      return [
        flag,
        typeof row?.value === "boolean" ? row.value : flags[flag].default,
      ];
    })
  ) as FlagValues;
};
