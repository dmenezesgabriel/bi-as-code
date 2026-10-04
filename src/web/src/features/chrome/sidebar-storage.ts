/**
 * Sidebar chrome persistence, on `sessionStorage` — the tab keeps the
 * user's arrangement, a fresh tab falls back to defaults (Observable
 * Framework stores its sidebar state the same way). Every reader is
 * guarded: storage can throw in private modes and hand-edited values must
 * never break the shell.
 */

const DESKTOP_OPEN_KEY = "biac.sidebar.open";
const DIR_OPEN_KEY = "biac.sidebar.dirs";

/**
 * The user's explicit desktop show/hide choice, or null for "auto"
 * (visible — the desktop default). Mobile drawer state is intentionally
 * ephemeral and never touches this key.
 */
export function readDesktopOpen(): boolean | null {
  const raw = read(DESKTOP_OPEN_KEY);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

export function writeDesktopOpen(open: boolean): void {
  write(DESKTOP_OPEN_KEY, String(open));
}

/**
 * Per-directory open overrides keyed by `NavDirectory.id` — a stable slug,
 * unlike the reference's summary-text key which breaks on renames.
 * Directories absent from the map fall back to "open iff they contain the
 * active page".
 */
export function readDirOpenMap(): Record<string, boolean> {
  const raw = read(DIR_OPEN_KEY);
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function writeDirOpen(id: string, open: boolean): void {
  write(DIR_OPEN_KEY, JSON.stringify({ ...readDirOpenMap(), [id]: open }));
}

function read(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode, quota) — the sidebar still works,
    // the choice just doesn't persist.
  }
}
