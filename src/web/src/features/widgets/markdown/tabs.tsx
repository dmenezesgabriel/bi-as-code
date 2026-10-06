import type { ReactElement, ReactNode } from "react";
import { Children, isValidElement } from "react";
import { Tabs as TabsPrimitive } from "../../../components/tabs";
import { cn } from "../../../lib/cn";
import { WidgetError } from "./states";
import type { TabProps, TabsProps, TabsVariant } from "./types";

// Class maps ported from evidence's `tv()` variants in
// core/src/user-components/tags/tabs/Tabs.svelte; its shadcn tokens
// resolve to our neutral scale (muted → neutral-100/800, border →
// neutral-200/800, muted-foreground → neutral-500/400).
const LIST_VARIANTS: Record<TabsVariant, string> = {
  default:
    "border-b border-neutral-200 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400",
  well: "rounded-lg border border-neutral-200 bg-neutral-100 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400",
};

// Evidence draws the underline (default) or pill (well) indicator through
// one crossfaded div per trigger; base-ui positions a single Indicator
// span through --active-tab-* vars it sets inline. The vars read relative
// to the List, so the List carries `relative` and the Indicator mounts
// first — equal stacking order, earlier in the DOM — keeping it behind
// the trigger labels without z-index.
const INDICATOR_VARIANTS: Record<TabsVariant, string> = {
  default: "border-b border-neutral-900 dark:border-neutral-100",
  well: "rounded-md border border-neutral-200 bg-white shadow-xs dark:border-neutral-700 dark:bg-neutral-900",
};

// Evidence's active/hover text token (foreground for default, primary for
// well) converges on our neutral foreground — evidence's `primary` is
// near-black in its own theme.
const TRIGGER_ACTIVE =
  "data-active:text-neutral-900 hover:text-neutral-900 dark:data-active:text-neutral-100 dark:hover:text-neutral-100";

/** The default variant's list always spans w-full so its border-b draws
 * the row rule; well hugs the tabs unless fullWidth, which also centers. */
function listClasses(variant: TabsVariant, fullWidth: boolean): string {
  return cn(
    "relative inline-flex items-center",
    LIST_VARIANTS[variant],
    variant === "well" && !fullWidth ? "w-fit" : "w-full",
    fullWidth && "justify-center",
  );
}

/** Triggers grow only under fullWidth or inside a fitted well list. */
function triggerClasses(variant: TabsVariant, fullWidth: boolean): string {
  return cn(
    "relative flex cursor-pointer items-center justify-center text-sm transition-colors",
    TRIGGER_ACTIVE,
    fullWidth || variant === "well" ? "flex-1" : "flex-none",
    fullWidth ? "p-1" : "p-0.5",
  );
}

function indicatorClasses(variant: TabsVariant): string {
  return cn(
    "absolute top-[var(--active-tab-top)] left-[var(--active-tab-left)] h-[var(--active-tab-height)] w-[var(--active-tab-width)] transition-[left,width] duration-200",
    INDICATOR_VARIANTS[variant],
  );
}

function isTabElement(child: ReactNode): child is ReactElement<TabProps> {
  return isValidElement<TabProps>(child) && child.type === Tab;
}

/** Reads `<Tab>` elements out of the MDX children; returns an error
 * message for anything that breaks the children contract. */
function collectTabs(children: ReactNode): ReactElement<TabProps>[] | string {
  const elements = Children.toArray(children).filter(
    (child) => typeof child !== "string" || child.trim() !== "",
  );
  if (elements.length === 0) return "requires at least one <Tab> child";
  const tabs: ReactElement<TabProps>[] = [];
  for (const child of elements) {
    if (!isTabElement(child)) return "only accepts <Tab> children";
    if (!child.props.title) return 'every <Tab> requires a "title" prop';
    tabs.push(child);
  }
  if (tabs.filter((tab) => tab.props.default).length > 1) {
    return "only one <Tab> may set default";
  }
  return tabs;
}

/**
 * The `<Tabs>` MDX widget — a tablist switching between panels of prose
 * or widgets. `default` on a `<Tab>` picks the initially selected panel
 * (first tab otherwise); arrow keys move between tabs, and panels stay
 * mounted while hidden so the widgets inside keep their state across
 * switches.
 *
 * @example
 * <Tabs>
 *   <Tab title="Chart"><BarChart data="orders" x="region" y="revenue" /></Tab>
 *   <Tab title="Table"><Table data="orders" /></Tab>
 * </Tabs>
 */
export function Tabs({
  variant = "default",
  fullWidth = false,
  children,
}: TabsProps): ReactElement {
  if (LIST_VARIANTS[variant] === undefined) {
    return (
      <WidgetError
        name="Tabs"
        message={`variant="${String(variant)}" is not one of ${Object.keys(LIST_VARIANTS).join(", ")}`}
      />
    );
  }
  const tabs = collectTabs(children);
  if (typeof tabs === "string") {
    return <WidgetError name="Tabs" message={tabs} />;
  }
  const defaultIndex = tabs.findIndex((tab) => tab.props.default);
  return (
    <TabsPrimitive.Root
      defaultValue={String(defaultIndex === -1 ? 0 : defaultIndex)}
      className="flex w-full flex-col gap-1"
    >
      <div className="overflow-x-auto">
        <TabsPrimitive.List
          activateOnFocus
          className={listClasses(variant, fullWidth)}
        >
          <TabsPrimitive.Indicator className={indicatorClasses(variant)} />
          {tabs.map((tab, i) => (
            <TabsPrimitive.Tab
              key={tab.key}
              value={String(i)}
              className={triggerClasses(variant, fullWidth)}
            >
              <span className="px-2 py-1 whitespace-nowrap">
                {tab.props.title}
              </span>
            </TabsPrimitive.Tab>
          ))}
        </TabsPrimitive.List>
      </div>
      {tabs.map((tab, i) => (
        <TabsPrimitive.Panel
          key={tab.key}
          value={String(i)}
          keepMounted
          className="mt-2"
        >
          {tab.props.children}
        </TabsPrimitive.Panel>
      ))}
    </TabsPrimitive.Root>
  );
}

/**
 * The `<Tab>` MDX widget — a data carrier whose props `<Tabs>` reads
 * through child inspection; rendered anywhere else it reports the misuse
 * inline instead of mounting an orphaned panel.
 *
 * @example
 * <Tabs><Tab title="Orders" default>…</Tab></Tabs>
 */
export function Tab(_props: TabProps): ReactElement {
  return <WidgetError name="Tab" message="must be a direct child of <Tabs>" />;
}
