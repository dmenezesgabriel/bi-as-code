import type { ReactElement } from "react";
import { Tabs as TabsPrimitive } from "../../../components/tabs";
import { cn } from "../../../lib/cn";
import { requireItemChildren } from "./collect-children";
import { WidgetError } from "./states";
import type { TabProps, TabsProps, TabsVariant } from "./types";

// Class maps ported from evidence's `tv()` variants in
// its Tabs tag, on the same shadcn token
// names; evidence's `muted` well is our `accent` (neutral-100/800).
const LIST_VARIANTS: Record<TabsVariant, string> = {
  default: "border-b border-border text-muted-foreground-faded",
  well: "rounded-lg border border-card-border bg-accent text-muted-foreground-faded",
};

// Evidence draws the underline (default) or pill (well) indicator through
// one crossfaded div per trigger; base-ui positions a single Indicator
// span through --active-tab-* vars it sets inline. The vars read relative
// to the List, so the List carries `relative` and the Indicator mounts
// first — equal stacking order, earlier in the DOM — keeping it behind
// the trigger labels without z-index.
const INDICATOR_VARIANTS: Record<TabsVariant, string> = {
  default: "border-b border-foreground",
  well: "rounded-md border border-card-border bg-card shadow-xs",
};

// Evidence's active/hover text token (foreground for default, primary for
// well) converges on our neutral foreground — evidence's `primary` is
// near-black in its own theme.
const TRIGGER_ACTIVE = "data-active:text-foreground hover:text-foreground";

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
    "relative flex cursor-pointer items-center justify-center text-sm transition-colors focus-visible:-outline-offset-2",
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

/** Reads `<Tab>` elements out of the MDX children; returns an error
 * message for anything that breaks the children contract. */
function collectTabs(
  children: TabsProps["children"],
): ReactElement<TabProps>[] | string {
  const tabs = requireItemChildren<TabProps>(children, Tab, "Tab", "title");
  if (typeof tabs === "string") return tabs;
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
