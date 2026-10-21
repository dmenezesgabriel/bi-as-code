/**
 * Source lines for a virtual module that keeps `state` in a `store` and
 * exports `subscribeName(listener)`. In dev the module accepts its own
 * updates: the store lives in `import.meta.hot.data`, which every
 * evaluation of the module shares, so a caller still holding the first
 * evaluation's functions reads the newest state, and its listeners hear of
 * it. `import.meta.hot` is undefined in a production build, so the guarded
 * block is dropped there. The caller appends the getters that read `store`.
 *
 * @example
 * [...hotStoreSource({ languages: ["en"] }, "subscribeLanguages"), "export function getLanguages() { return store.languages; }"].join("\n");
 */
export function hotStoreSource(
  state: Readonly<Record<string, unknown>>,
  subscribeName: string,
): string[] {
  return [
    "const store = import.meta.hot?.data.store ?? { listeners: new Set() };",
    `Object.assign(store, ${JSON.stringify(state)});`,
    `export function ${subscribeName}(listener) {`,
    "  store.listeners.add(listener);",
    "  return () => void store.listeners.delete(listener);",
    "}",
    "if (import.meta.hot) {",
    "  import.meta.hot.data.store = store;",
    "  import.meta.hot.accept(() => store.listeners.forEach((listener) => listener()));",
    "}",
  ];
}
