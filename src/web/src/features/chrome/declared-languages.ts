import { useSyncExternalStore } from "react";
import type { DeclaredLanguages } from "./types";

/**
 * A list that never changes — what a project without `translations.yaml`
 * declares, and what stories and tests mount the shell with.
 *
 * @example
 * <AppShell tree={tree} site={site} languages={fixedLanguages(["en", "fr"])} />
 */
export function fixedLanguages(
  languages: readonly string[],
): DeclaredLanguages {
  return { get: () => languages, subscribe: () => () => {} };
}

/**
 * The declared languages, re-rendering the caller when the store changes.
 *
 * @example
 * const languages = useDeclaredLanguages(fixedLanguages(["en", "fr"]));
 */
export function useDeclaredLanguages(
  source: DeclaredLanguages,
): readonly string[] {
  return useSyncExternalStore(source.subscribe, source.get);
}
