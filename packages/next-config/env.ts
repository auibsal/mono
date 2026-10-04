/** Keeps each preset's own type; a plain array literal would merge them. */
export const envPresets = <T extends object[]>(...presets: T) => presets;

/**
 * With SKIP_ENV_VALIDATION=true (CI, Docker builds) `createEnv` returns only
 * the app's own `runtimeEnv` and drops every value inherited through
 * `extends`. This merges the presets back so they stay readable.
 */
export const withPresets = <T extends object>(
  env: T,
  presets: readonly object[]
): T =>
  process.env.SKIP_ENV_VALIDATION === "true"
    ? (Object.assign({}, ...presets, env) as T)
    : env;
