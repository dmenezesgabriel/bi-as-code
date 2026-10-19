# SL-064 — A page names an icon that shows beside it in the sidebar

Milestone: Phase 4 — Project and page settings, themes, layouts · State: open · Depends on: — · Closes: GAP-069

> Delete this file when the slice ships. Every path below was verified on disk on 2026-10-19 (`test -e`); every icon name was checked against lucide-react 1.49.0's `iconNames` the same day.

## Outcome

An author writes `icon: chart-line` in a page's front-matter and the sidebar shows that icon beside the page's link; a name outside the catalog stops `biac dev` with an error naming the file, the key, the accepted names and the closest one, and fails `biac build`.

## Demo

1. Cold start: `bin/biac dev`, open the `Local:` URL it prints. The sidebar shows an icon beside every example page that sets one (`pages/index.md`, `pages/orders-dashboard.md`, `pages/weekly-review.md`, …); a page without `icon` shows its name alone, aligned with the others.
2. Before figures (measured 2026-10-19 on `de0c81b`, see Baseline below): 0 `svg` inside sidebar links. After: one `svg` per page that sets `icon`, each `aria-hidden="true"`; every link's accessible name is unchanged; link row height unchanged or the change is named.
3. In `pages/weekly-review.md` change `icon:` to `calender`. The dev overlay names `front-matter in pages/weekly-review.md`, `icon`, the accepted names, `got "calender"`, and suggests `calendar`. The rest of the app keeps running.
4. Fix it to `calendar` — the page comes back and the sidebar icon updates with no manual reload.
5. Delete the `icon:` line — the icon disappears, the link stays.
6. Put `calender` back and run `bin/biac build` — the build fails with the same message. Fix it; `bin/biac build && bin/biac preview` shows the icons in the built site.
7. Resize to 375 px wide, open the drawer — the icons show there too.

### Baseline

Measured with `playwright-cli` on `bin/biac dev` at `de0c81b`, before any code change, on `/weekly-review`:

| Reading                                    | 1280 px       | 375 px, drawer open |
| ------------------------------------------ | ------------- | ------------------- |
| Sidebar links (6 root + 2 in "Breakdowns") | 8             | 8                   |
| `svg` inside sidebar links                 | 0             | 0                   |
| Link row height                            | 32 px         | 32 px               |
| `aria-current="page"`                      | Weekly review | Weekly review       |
| Console errors / warnings                  | 0 / 0         | 0 / 0               |

## Who else implements this

| Repo      | Has it | Entry points                                                                                                                                                                                                                                                                                      | Approach in one line                                                                                                                                                                           |
| --------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| evidence  | FULL   | `research_repos/evidence/core/src/config/page-frontmatter-schema.ts`, `research_repos/evidence/core/src/user-components/common/icon-names.ts`, `research_repos/evidence/core/src/user-components/common/dynamic-icon.ts`, `research_repos/evidence/core/src/viewer-components/PageNavTree.svelte` | Front-matter `icon` is a zod enum over 164 curated Lucide names, normalized (lower-case, `_`/space → `-`); an unknown name is dropped (`.catch(undefined)`) and only an editor warning says so |
| framework | ABSENT | `research_repos/framework/src/config.ts` (`Page { name, path, pager }`), `research_repos/framework/docs/config.md` (no `icon`)                                                                                                                                                                    | Pages in the sidebar carry a name and a path only                                                                                                                                              |
| mosaic    | ABSENT | `research_repos/mosaic/packages/` — no sidebar or page navigation (`grep -rli "sidebar\|navigation" --include='*.js' --include='*.ts'` finds nothing)                                                                                                                                             | A cross-filter library with no multi-page shell                                                                                                                                                |
| streamlit | FULL   | `research_repos/streamlit/lib/streamlit/navigation/page.py`, `research_repos/streamlit/lib/streamlit/string_util.py`, `research_repos/streamlit/frontend/app/src/components/Navigation/SidebarNavLink.tsx`                                                                                        | `st.Page(icon=…)` takes an emoji or `:material/name:` from the full Material Symbols set; an unknown name raises `StreamlitAPIException` (`invalid-material-icon`)                             |

**Count:** 2 of 4 implement this — the two that ship a multi-page app shell with a sidebar both have it (R7 `docs/research/settings-and-themes.md` D7 decided to build it).

## Implementation inventory

### evidence

| Concern                        | Files                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data model / schema            | `research_repos/evidence/core/src/config/page-frontmatter-schema.ts` (`icon:` — `z.preprocess` normalizing, `z.enum(availableIconNames)`, `.nullable().optional().catch(undefined)`); `research_repos/evidence/core/src/user-components/common/icon-names.ts` (`availableIconNames`, 164 names, kept free of component imports so validation stays cheap) |
| Pipeline / execution           | `research_repos/evidence/core/src/utils/nav-tree.ts` (`FlatNavItem.icon` carried into the `NavTree`); `research_repos/evidence/core/src/utils/nav-tree.test.ts` ("carries icons")                                                                                                                                                                         |
| Client / state                 | `research_repos/evidence/core/src/user-components/common/dynamic-icon.ts` (`iconMap` of static Lucide imports, `loadLucideIcon` normalizes and returns `null` + `logger.warn` when missing)                                                                                                                                                               |
| UI entry point                 | `research_repos/evidence/core/src/viewer-components/PageNavTree.svelte` (`pageIcon` snippet before the label, root and folder pages alike)                                                                                                                                                                                                                |
| Persistence of state           | — (static front-matter)                                                                                                                                                                                                                                                                                                                                   |
| Empty / error / loading states | `research_repos/evidence/core/src/user-components/validators/validateInvalidIconName.ts` (non-blocking `frontmatter-invalid-icon` warning located at the `icon:` line; empty/`null`/`~` mean no icon); `research_repos/evidence/core/src/user-components/validators/validateInvalidIconName.test.ts`                                                      |
| Accessibility specifics        | `research_repos/evidence/core/src/viewer-components/PageNavTree.svelte` — icon is decorative, the link text names the page; tone `text-primary` when active, `text-muted-foreground/80` otherwise                                                                                                                                                         |
| Edge cases it handles          | Case/underscore normalization (`Calendar`, `my_icon`); only a top-level `icon:` is validated; `research_repos/evidence/docs/features/page-settings.mdx` — `icon` is page-only, no project default                                                                                                                                                         |

### streamlit

| Concern                        | Files                                                                                                                                                                                                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data model / schema            | `research_repos/streamlit/lib/streamlit/navigation/page.py` (`icon` parameter and docstring: emoji, `:material/name:`, `"spinner"`, `""` for none); `research_repos/streamlit/lib/streamlit/material_icon_names.py` (generated `ALL_MATERIAL_ICONS`, lazy-loaded) |
| Pipeline / execution           | `research_repos/streamlit/lib/streamlit/string_util.py` (`validate_icon_or_emoji`, `validate_material_icon`, `is_material_icon`)                                                                                                                                  |
| Client / state                 | `research_repos/streamlit/frontend/lib/src/components/shared/Icon/DynamicIcon.tsx` (emoji vs Material font glyph)                                                                                                                                                 |
| UI entry point                 | `research_repos/streamlit/frontend/app/src/components/Navigation/SidebarNavLink.tsx` (icon before the label when `icon?.length`)                                                                                                                                  |
| Persistence of state           | —                                                                                                                                                                                                                                                                 |
| Empty / error / loading states | `research_repos/streamlit/lib/streamlit/string_util.py` — `None`/whitespace mean no icon; an unknown name raises with `error_id="invalid-material-icon"` and an example of a valid shortcode                                                                      |
| Accessibility specifics        | `research_repos/streamlit/frontend/app/src/components/Navigation/styled-components.ts` (`StyledSidebarNavIcon` — bolder when active); inactive Material icons faded (`fadedText60`) in `SidebarNavLink.tsx`                                                       |
| Edge cases it handles          | `research_repos/streamlit/frontend/app/src/components/Navigation/SidebarNavLink.test.tsx`; external links never show active                                                                                                                                       |

**Where they disagree:** unknown name (evidence drops + warns, streamlit raises); spelling (evidence normalizes, streamlit exact); set size (evidence 164 curated, streamlit the full font). Each is a row below.

## Trade-offs and what we adopt

| Axis                  | Options seen (repo → approach)                                                                | Trade-off                                                                                                                                                                                                                  | Our choice, and why                                                                                                                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unknown name          | evidence → drop, editor warning; streamlit → raise                                            | Dropping renders nothing with no explanation outside evidence's editor; raising stops the author until fixed                                                                                                               | Raise: a located error, like `page_width` (`src/engine/page-layout-frontmatter.ts`), via `invalidSetting` (`src/engine/invalid-setting.ts`) plus a "did you mean" from `closestKey` (`src/engine/closest-key.ts`). The backlog row asks for it            |
| Spelling              | evidence → lower-case, `_`/space → `-`; streamlit → exact                                     | Normalizing accepts two spellings of one name; exact needs the suggestion to be kind                                                                                                                                       | Exact Lucide kebab-case. `closestKey` already wins a case-only difference outright, so `Calendar` suggests `calendar`                                                                                                                                     |
| Set size              | evidence → 164 curated, static imports; streamlit → full Material font (thousands)            | A full set means ~2000 lazy chunks (`lucide-react/dynamic`) and icons popping in after paint, and the engine would need Lucide's list, crossing the wrap rule; a curated set is a fixed, small bundle cost                 | Curated, 56 names (decided by the owner 2026-10-19), statically imported at the wrap site                                                                                                                                                                 |
| Where validation runs | evidence → schema at load; streamlit → at the `st.Page` call                                  | A throw in `discoverPages` (`src/engine/discover-pages.ts`) fails `virtual:biac-pages` and leaves dev with a blank app — `manifestChanged` in `src/engine/pages-plugin.ts` keeps the stale manifest on a discovery failure | Validate in `compilePage` (`src/engine/compile-page.ts`, beside `pageLayout`): the page module carries the error into the overlay, the build fails on it. `navFields` reads `icon` leniently, like `sidebar_position`: only a catalog name enters the nav |
| No icon               | both → empty / `null` mean none                                                               | —                                                                                                                                                                                                                          | Same: absent, `null` or `""` mean none. A non-string (`icon: 3`) is an error                                                                                                                                                                              |
| Active tone           | evidence → `text-primary` active, muted otherwise; streamlit → bolder active, faded otherwise | —                                                                                                                                                                                                                          | Follow evidence with our tokens: icon inherits the link's colour (`text-foreground` active, `text-muted-foreground` otherwise, `src/web/src/features/chrome/sidebar-nav.tsx` `NavLink`). Brand colours are SL-048's tokens, already contrast-checked      |
| Accessibility         | both → icon decorative                                                                        | —                                                                                                                                                                                                                          | `aria-hidden`, as every icon in `src/web/src/components/icons.tsx`; the link's accessible name stays the page name                                                                                                                                        |

### The catalog — 56 names, all present in lucide-react 1.49.0 `iconNames`

`house` `layout-dashboard` `layers` `chart-column` `chart-bar` `chart-line` `chart-area` `chart-pie` `gauge` `trending-up` `trending-down` `activity` `table` `sheet` `database` `server` `cloud` `calendar` `clock` `users` `user` `building` `briefcase` `store` `factory` `warehouse` `truck` `package` `shopping-cart` `receipt` `credit-card` `wallet` `dollar-sign` `coins` `banknote` `percent` `target` `flag` `map` `map-pin` `globe` `mail` `file` `file-text` `folder` `book-open` `info` `circle-help` `settings` `shield` `lock` `key` `wrench` `filter` `search` `list-checks`

Check command (run in `src/web`): `node -e "import('lucide-react/dynamic.js').then(({iconNames})=>{const s=new Set(iconNames);console.log(LIST.filter(n=>!s.has(n)))})"`. Lucide 1.x renamed some evidence names (`home` → `house`, `help-circle` → `circle-help`); only canonical names go in.

## Gap analysis — what we already have vs the references

| Concern                    | Ours today (file)                                                                                                                                                                 | Best reference (file)                                                               | Gap               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------- |
| Name catalog               | none                                                                                                                                                                              | `research_repos/evidence/core/src/user-components/common/icon-names.ts`             | absent            |
| Front-matter validation    | `src/engine/compile-page.ts` validates `sql`, layout and `brand`; no `icon`                                                                                                       | `research_repos/streamlit/lib/streamlit/string_util.py` `validate_material_icon`    | absent            |
| Manifest entry             | `src/engine/types.ts` `PageManifestEntry` — `title`, `sidebarPosition`; `src/engine/discover-pages.ts` `navFields`                                                                | `research_repos/evidence/core/src/utils/nav-tree.ts` `FlatNavItem.icon`             | absent            |
| Nav tree                   | `src/engine/types.ts` `NavPage { name, href }`; `src/engine/nav-tree.ts` `buildNavTree`/`toFlatItem`                                                                              | `research_repos/evidence/core/src/utils/nav-tree.ts`                                | absent            |
| Manifest module            | `src/engine/manifest-module.ts` `entryRow`, `navTree` JSON — an icon in `NavPage` reaches the client and changes the served manifest, so dev HMR follows an edit with no new code | —                                                                                   | absent            |
| Web contract               | `src/web/src/virtual-biac-pages.d.ts` `NavPage`; `src/web/src/features/pages/types.ts` `ManifestPageEntry`                                                                        | —                                                                                   | absent            |
| Icon wrap site             | `src/web/src/components/icons.tsx` — 15 named chrome glyphs, no lookup by name; `src/web/src/components/icons.stories.tsx`                                                        | `research_repos/evidence/core/src/user-components/common/dynamic-icon.ts` `iconMap` | absent            |
| Sidebar link               | `src/web/src/features/chrome/sidebar-nav.tsx` `NavLink` — text only; `sidebar-nav.stories.tsx`, `sidebar-nav.unit.test.tsx`                                                       | `research_repos/evidence/core/src/viewer-components/PageNavTree.svelte` `pageIcon`  | absent            |
| Located error in dev/build | `test/e2e-browser/page-chrome.spec.ts` "front-matter page_width: full widens the page in place, and a bad value shows its error" — the pattern to copy                            | —                                                                                   | absent for `icon` |

Our implementation is **absent**. Nothing in the ledger claims any part of it shipped.

### Catalog parity across engine and SPA

The SPA never imports the engine — shared constants are restated (`src/web/src/features/pages/data-updates.ts` restates `DATA_UPDATE_EVENT` from `src/engine/data-update.ts`). So the engine owns `PAGE_ICON_NAMES` (`src/engine/page-icon-frontmatter.ts`, beside `assertPageIcon`; exported in T2); the wrap site (new `src/web/src/components/page-icon.tsx`) restates it as a `name → Lucide component` map; a test under `test/integration/` imports both and pins the two name sets equal, so neither side can gain a name the other lacks.

## Deviations

- Unknown names fail rather than drop (streamlit's behaviour, not evidence's) — stated in a code comment beside the check, as `pageLayout` does for `page_width`.
- No name normalization — the comment beside the check says the suggestion covers case.

## Open decisions

None. O1 (which icons) settled by the owner 2026-10-19: the 56-name curated catalog above.

## Surface

| Layer  | Files                                                                                                                                                                                                                                                                             |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| engine | `src/engine/page-icon-frontmatter.ts` (new), `src/engine/closest-key.ts` (`didYouMean`), `src/engine/invalid-setting.ts` (`hint`), `src/engine/compile-page.ts`, `src/engine/types.ts`, `src/engine/discover-pages.ts`, `src/engine/nav-tree.ts`, `src/engine/manifest-module.ts` |
| client | `src/web/src/virtual-biac-pages.d.ts`, `src/web/src/features/pages/types.ts`                                                                                                                                                                                                      |
| ui     | `src/web/src/components/page-icon.tsx` (new) + `page-icon.stories.tsx`, `src/web/src/features/chrome/sidebar-nav.tsx` + `sidebar-nav.stories.tsx`, example pages under `pages/`                                                                                                   |
| tests  | colocated `*.unit.test.ts(x)`, `test/integration/` (parity, build failure), `test/e2e-browser/page-chrome.spec.ts`, `test/integration/features/` cucumber if a page-chrome scenario covers nav                                                                                    |

## Tasks

- [x] T1 — An unknown `icon` is a located error: `PAGE_ICON_NAMES` and its check in `compilePage` (non-string, unknown name with "did you mean", `null`/`""` accepted); unit tests, `biac build` fails in an integration test, e2e-browser overlay + recovery on `/weekly-review`. playwright-cli: overlay text, recovery, console.
- [ ] T2 — The icon shows in the sidebar: `navFields` → `PageManifestEntry.icon` → `NavPage.icon` → manifest → web types → `PageIcon` (with stories) → `NavLink` (stories: icon, no icon, active); parity test; icons on the example pages; e2e-browser: icon count, `aria-hidden`, accessible names, live update on edit. playwright-cli: compare against the Baseline — svg count, row height, 375 px drawer, console.

## Out of scope

- Emoji icons (streamlit only).
- Icons on sidebar folders (evidence and streamlit put icons on pages only).
- The full Lucide set and any project-wide default icon (evidence: `icon` is page-only).
- A page icon in the browser tab (favicon) — the `/favicon.ico` 404 is tracked Known debt, not this slice.
