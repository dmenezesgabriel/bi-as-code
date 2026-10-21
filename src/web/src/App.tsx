import { Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { BiacConfig } from "virtual:biac-config";
import type { NavTree } from "virtual:biac-pages";
import { Breadcrumbs } from "./features/chrome/breadcrumbs";
import { EditPageLink } from "./features/chrome/edit-page-link";
import {
  fixedLanguages,
  useDeclaredLanguages,
} from "./features/chrome/declared-languages";
import { LanguageMenu } from "./features/chrome/language-menu";
import { PageLanguageProvider } from "./features/chrome/page-language";
import { SidebarNav } from "./features/chrome/sidebar-nav";
import {
  readDesktopOpen,
  writeDesktopOpen,
} from "./features/chrome/sidebar-storage";
import { ThemeModeProvider } from "./features/chrome/theme-mode";
import { ThemeToggle } from "./features/chrome/theme-toggle";
import type { DeclaredLanguages } from "./features/chrome/types";
import type { LoadPageSearchDocuments } from "./features/search/types";
import { useLanguage } from "./features/chrome/use-language";
import { useMediaQuery } from "./features/chrome/use-media-query";
import { useTheme } from "./features/chrome/use-theme";
import { cn } from "./lib/cn";

const MOBILE_QUERY = "(max-width: 1023px)";
const NO_LANGUAGES = fixedLanguages([]);

/**
 * The app chrome wrapping every route: a fixed sidebar nav, a slim header
 * carrying the toggle and breadcrumbs, and the routed page. Sidebar
 * visibility is breakpoint-aware — below `lg` the sidebar is an overlay
 * drawer whose open state is ephemeral (a link click, backdrop tap or
 * Escape dismisses it); at `lg` and above it sits beside the content, and
 * only an explicit toggle — persisted to sessionStorage — hides it there.
 * `nav.sidebar: false` in `biac.config.ts` removes the chrome entirely.
 * `editable` (true only under `biac dev`) adds the header's Edit link;
 * two or more `languages` add the header's language menu;
 * `loadSearchDocuments` adds the sidebar's search box, whose shortcuts
 * reveal a hidden sidebar for the moment — the drawer below `lg`, an
 * unpersisted show at `lg` and above, so a reload keeps the stored choice.
 */
export function AppShell({
  tree,
  site,
  languages: declaredLanguages = NO_LANGUAGES,
  loadSearchDocuments,
  editable = false,
}: {
  tree: NavTree;
  site: BiacConfig;
  languages?: DeclaredLanguages;
  loadSearchDocuments?: LoadPageSearchDocuments;
  editable?: boolean;
}) {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  // Applied here, above the `nav.sidebar: false` early return, so a
  // chrome-free project still honours its configured theme and language.
  const theme = useTheme(site.theme);
  const languages = useDeclaredLanguages(declaredLanguages);
  const language = useLanguage(languages);
  const [desktopOpen, setDesktopOpen] = useState<boolean | null>(
    readDesktopOpen,
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  const desktopVisible = desktopOpen !== false;
  const visible = isMobile ? mobileOpen : desktopVisible;
  const closeMobile = () => setMobileOpen(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  if (!site.nav.sidebar) {
    return (
      <ThemeModeProvider mode={theme.mode}>
        <PageLanguageProvider language={language.language}>
          <div className="min-h-screen bg-background text-foreground">
            <Outlet />
          </div>
        </PageLanguageProvider>
      </ThemeModeProvider>
    );
  }

  function revealSidebar() {
    if (isMobile) setMobileOpen(true);
    else setDesktopOpen(true);
  }

  function toggleSidebar() {
    if (isMobile) {
      setMobileOpen((open) => !open);
      return;
    }
    const open = !desktopVisible;
    setDesktopOpen(open);
    writeDesktopOpen(open);
  }

  return (
    <ThemeModeProvider mode={theme.mode}>
      <div className="min-h-screen bg-background text-foreground">
        {mobileOpen && (
          <div
            data-testid="sidebar-backdrop"
            aria-hidden
            onClick={closeMobile}
            className="fixed inset-0 z-30 bg-overlay lg:hidden"
          />
        )}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-72 border-r border-border bg-sidebar",
            // A transition runs on the destination state's
            // transition-property: opening skips `visibility`, so the
            // search shortcut can focus the box at once; closing keeps it,
            // so the sidebar stays visible while it slides out.
            visible
              ? "visible translate-x-0 transition-transform"
              : "invisible -translate-x-full transition-[transform,visibility]",
          )}
        >
          <SidebarNav
            tree={tree}
            siteTitle={site.title}
            loadSearchDocuments={loadSearchDocuments}
            onNavigate={closeMobile}
            onRevealSearch={revealSidebar}
          />
        </aside>
        <div className={cn("min-h-screen", desktopVisible && "lg:pl-72")}>
          <header className="sticky top-0 z-20 flex h-12 items-center border-b border-border bg-background px-4">
            <button
              type="button"
              aria-label="Toggle sidebar"
              aria-expanded={visible}
              onClick={toggleSidebar}
              className="rounded-sm p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <span aria-hidden>☰</span>
            </button>
            <Breadcrumbs tree={tree} />
            {editable && <EditPageLink />}
            <LanguageMenu
              languages={languages}
              language={language.language}
              onChoose={language.choose}
            />
            <ThemeToggle mode={theme.mode} onToggle={theme.toggle} />
          </header>
          <PageLanguageProvider language={language.language}>
            <Outlet />
          </PageLanguageProvider>
        </div>
      </div>
    </ThemeModeProvider>
  );
}
