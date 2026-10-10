import { Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { BiacConfig } from "virtual:biac-config";
import type { NavTree } from "virtual:biac-pages";
import { Breadcrumbs } from "./features/chrome/breadcrumbs";
import { EditPageLink } from "./features/chrome/edit-page-link";
import { SidebarNav } from "./features/chrome/sidebar-nav";
import {
  readDesktopOpen,
  writeDesktopOpen,
} from "./features/chrome/sidebar-storage";
import { ThemeModeProvider } from "./features/chrome/theme-mode";
import { ThemeToggle } from "./features/chrome/theme-toggle";
import { useMediaQuery } from "./features/chrome/use-media-query";
import { useTheme } from "./features/chrome/use-theme";
import { cn } from "./lib/cn";

const MOBILE_QUERY = "(max-width: 1023px)";

/**
 * The app chrome wrapping every route: a fixed sidebar nav, a slim header
 * carrying the toggle and breadcrumbs, and the routed page. Sidebar
 * visibility is breakpoint-aware — below `lg` the sidebar is an overlay
 * drawer whose open state is ephemeral (a link click, backdrop tap or
 * Escape dismisses it); at `lg` and above it sits beside the content, and
 * only an explicit toggle — persisted to sessionStorage — hides it there.
 * `nav.sidebar: false` in `biac.config.ts` removes the chrome entirely.
 * `editable` (true only under `biac dev`) adds the header's Edit link.
 */
export function AppShell({
  tree,
  site,
  editable = false,
}: {
  tree: NavTree;
  site: BiacConfig;
  editable?: boolean;
}) {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  // Applied here, above the `nav.sidebar: false` early return, so a
  // chrome-free project still honours its configured theme.
  const theme = useTheme(site.theme);
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
        <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
          <Outlet />
        </div>
      </ThemeModeProvider>
    );
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
      <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        {mobileOpen && (
          <div
            data-testid="sidebar-backdrop"
            aria-hidden
            onClick={closeMobile}
            className="fixed inset-0 z-30 bg-black/20 lg:hidden dark:bg-black/50"
          />
        )}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-72 border-r border-neutral-200 bg-neutral-50 transition-[transform,visibility] dark:border-neutral-800 dark:bg-neutral-900",
            visible ? "visible translate-x-0" : "invisible -translate-x-full",
          )}
        >
          <SidebarNav
            tree={tree}
            siteTitle={site.title}
            onNavigate={closeMobile}
          />
        </aside>
        <div className={cn("min-h-screen", desktopVisible && "lg:pl-72")}>
          <header className="sticky top-0 z-20 flex h-12 items-center border-b border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-950">
            <button
              type="button"
              aria-label="Toggle sidebar"
              aria-expanded={visible}
              onClick={toggleSidebar}
              className="rounded p-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            >
              <span aria-hidden>☰</span>
            </button>
            <Breadcrumbs tree={tree} />
            {editable && <EditPageLink />}
            <ThemeToggle mode={theme.mode} onToggle={theme.toggle} />
          </header>
          <Outlet />
        </div>
      </div>
    </ThemeModeProvider>
  );
}
