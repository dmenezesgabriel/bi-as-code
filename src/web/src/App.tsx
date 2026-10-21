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
import { usePageChrome } from "./features/chrome/page-chrome";
import { PageLanguageProvider } from "./features/chrome/page-language";
import { SidebarNav } from "./features/chrome/sidebar-nav";
import {
  readDesktopOpen,
  writeDesktopOpen,
} from "./features/chrome/sidebar-storage";
import { ThemeModeProvider } from "./features/chrome/theme-mode";
import { ThemeToggle } from "./features/chrome/theme-toggle";
import type { DeclaredLanguages } from "./features/chrome/types";
import type { PageChromeEntry } from "./features/pages/types";
import type { LoadPageSearchDocuments } from "./features/search/types";
import { useLanguage } from "./features/chrome/use-language";
import { useMediaQuery } from "./features/chrome/use-media-query";
import { useTheme } from "./features/chrome/use-theme";
import { cn } from "./lib/cn";

const MOBILE_QUERY = "(max-width: 1023px)";
const NO_LANGUAGES = fixedLanguages([]);
const NO_PAGES: readonly PageChromeEntry[] = [];
// Above the sidebar (z-40) so the button stays reachable while it is open.
const FLOATING_TOGGLE = "fixed top-2 left-2 z-50 bg-background shadow-sm";

/**
 * The app chrome wrapping every route: a fixed sidebar nav, a slim header
 * carrying the toggle and breadcrumbs, and the routed page. Sidebar
 * visibility is breakpoint-aware — below `lg` the sidebar is an overlay
 * drawer whose open state is ephemeral (a link click, backdrop tap or
 * Escape dismisses it); at `lg` and above it sits beside the content, and
 * only an explicit toggle — persisted to sessionStorage — hides it there.
 * `nav.sidebar: false` in `biac.config.ts` removes the chrome entirely;
 * a page's front-matter `sidebar` and `header` (read off its manifest entry
 * in `pages`) override it piece by piece.
 * `editable` (true only under `biac dev`) adds the header's Edit link;
 * two or more `languages` add the header's language menu;
 * `loadSearchDocuments` adds the sidebar's search box, whose shortcuts
 * reveal a hidden sidebar for the moment — the drawer below `lg`, an
 * unpersisted show at `lg` and above, so a reload keeps the stored choice.
 */
export function AppShell({
  tree,
  site,
  pages = NO_PAGES,
  languages: declaredLanguages = NO_LANGUAGES,
  loadSearchDocuments,
  editable = false,
}: {
  tree: NavTree;
  site: BiacConfig;
  pages?: readonly PageChromeEntry[];
  languages?: DeclaredLanguages;
  loadSearchDocuments?: LoadPageSearchDocuments;
  editable?: boolean;
}) {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const chrome = usePageChrome(pages, site.nav.sidebar);
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

  const toggle = chrome.sidebar && (
    <SidebarToggle
      expanded={visible}
      onToggle={toggleSidebar}
      className={cn(
        !chrome.header && FLOATING_TOGGLE,
        !chrome.header && desktopVisible && "lg:left-74",
      )}
    />
  );

  // The sidebar's search box sits inside the language too, so it searches
  // the text the page shows.
  return (
    <ThemeModeProvider mode={theme.mode}>
      <PageLanguageProvider language={language.language}>
        <div className="min-h-screen bg-background text-foreground">
          {chrome.sidebar && mobileOpen && (
            <div
              data-testid="sidebar-backdrop"
              aria-hidden
              onClick={closeMobile}
              className="fixed inset-0 z-30 bg-overlay lg:hidden"
            />
          )}
          {chrome.sidebar && (
            <aside className={sidebarClass(visible)}>
              <SidebarNav
                tree={tree}
                siteTitle={site.title}
                loadSearchDocuments={loadSearchDocuments}
                onNavigate={closeMobile}
                onRevealSearch={revealSidebar}
              />
            </aside>
          )}
          <div
            className={cn(
              "min-h-screen",
              chrome.sidebar && desktopVisible && "lg:pl-72",
            )}
          >
            {chrome.header ? (
              <header className="sticky top-0 z-20 flex h-12 items-center border-b border-border bg-background px-4">
                {toggle}
                <Breadcrumbs tree={tree} />
                {editable && <EditPageLink />}
                <LanguageMenu
                  languages={languages}
                  language={language.language}
                  onChoose={language.choose}
                />
                <ThemeToggle mode={theme.mode} onToggle={theme.toggle} />
              </header>
            ) : (
              toggle
            )}
            <Outlet />
          </div>
        </div>
      </PageLanguageProvider>
    </ThemeModeProvider>
  );
}

// A transition runs on the destination state's transition-property: opening
// skips `visibility`, so the search shortcut can focus the box at once;
// closing keeps it, so the sidebar stays visible while it slides out.
function sidebarClass(visible: boolean): string {
  return cn(
    "fixed inset-y-0 left-0 z-40 w-72 border-r border-border bg-sidebar",
    visible
      ? "visible translate-x-0 transition-transform"
      : "invisible -translate-x-full transition-[transform,visibility]",
  );
}

/**
 * The button that shows and hides the sidebar. It belongs to the sidebar,
 * not the header: a page without a header keeps it as a floating button,
 * so the drawer below `lg` stays reachable.
 */
function SidebarToggle({
  expanded,
  onToggle,
  className,
}: {
  expanded: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label="Toggle sidebar"
      aria-expanded={expanded}
      onClick={onToggle}
      className={cn(
        "rounded-sm p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        className,
      )}
    >
      <span aria-hidden>☰</span>
    </button>
  );
}
