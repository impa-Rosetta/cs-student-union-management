import type { Plugin } from "vite";

/**
 * Stable, repository-owned compatibility point for the hosted Sites build.
 *
 * The original scaffold imported a generated module from `build/`, but that
 * directory is intentionally ignored and therefore disappears from clones and
 * source archives. Hosting-specific behavior can be added here when required;
 * the current application only needs a named Vite plugin so local, CI and
 * Cloudflare builds share the same checked-in configuration.
 */
export function sites(): Plugin {
  return {
    name: "student-union-sites-compat",
  };
}
