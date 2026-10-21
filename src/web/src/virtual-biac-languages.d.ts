// Types the languages module served by the engine's vite plugin —
// `virtual:` ids have no real file for tsc to resolve, so the contract is
// declared here. In dev the module hot-updates itself when
// `translations.yaml` changes and tells its subscribers.
declare module "virtual:biac-languages" {
  /** Declared languages in `translations.yaml` order; the first is the default. Empty without the file or while it is broken. */
  export function getLanguages(): readonly string[];
  /** Calls `listener` whenever the declared languages change; returns the unsubscribe. */
  export function subscribeLanguages(listener: () => void): () => void;
}
