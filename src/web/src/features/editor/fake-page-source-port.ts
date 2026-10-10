import type { PageSourcePort } from "./types";

/** How the fake answers: a canned source, or a failure / hang per call. */
export type FakePageSourceScript = {
  source?: string;
  readError?: string;
  saveError?: string;
  /** Never settle the call — freezes the editor in `loading` / `saving`. */
  hangRead?: boolean;
  hangSave?: boolean;
};

/**
 * Recording `PageSourcePort` double for web-unit tests and stories — the
 * editor never reaches a dev server. `saves` captures every write so a
 * caller asserts exactly what `Mod-s` sent.
 */
export class FakePageSourcePort implements PageSourcePort {
  readonly saves: { file: string; source: string }[] = [];

  constructor(private readonly script: FakePageSourceScript = {}) {}

  read(): Promise<string> {
    const { source = "", readError, hangRead } = this.script;
    if (hangRead) return new Promise(() => {});
    if (readError) return Promise.reject(new Error(readError));
    return Promise.resolve(source);
  }

  save(file: string, source: string): Promise<void> {
    this.saves.push({ file, source });
    const { saveError, hangSave } = this.script;
    if (hangSave) return new Promise(() => {});
    if (saveError) return Promise.reject(new Error(saveError));
    return Promise.resolve();
  }
}
