import type { ReactElement } from "react";
import { Accordion as AccordionPrimitive } from "../../../components/accordion";
import { ChevronDownIcon } from "../../../components/icons";
import { cn } from "../../../lib/cn";
import { collectItemChildren } from "./collect-children";
import { WidgetError } from "./states";
import type {
  AccordionItemProps,
  AccordionProps,
  AccordionVariant,
} from "./types";

// Class maps ported from evidence's `tv()` variants in
// core/src/user-components/tags/accordion/Accordion.svelte; its shadcn
// tokens resolve to our neutral scale (accent → neutral-100/800, card →
// white/neutral-900, border → neutral-200/700 — the same resolutions
// the Tabs variants use).
const VARIANTS: Record<AccordionVariant, string> = {
  default: "",
  well: "rounded-lg border border-neutral-200 bg-neutral-100 px-4 py-2 dark:border-neutral-700 dark:bg-neutral-800",
  card: "rounded-lg border border-neutral-200 bg-white px-4 py-2 shadow-xs dark:border-neutral-700 dark:bg-neutral-900",
};

/**
 * The `<Accordion>` MDX widget — a stack of titled disclosure items.
 * Items open independently by default; `single` limits expansion to one
 * at a time (closing the open item when another opens). `open` on an
 * `<AccordionItem>` starts it expanded — under `single` only the first
 * `open` item wins. Closed panels stay mounted with `hidden=until-found`
 * so browser find-in-page still reaches them. Children must be
 * `<AccordionItem>` elements — anything else renders an inline alert.
 *
 * @example
 * <Accordion single>
 *   <AccordionItem title="Methodology">…</AccordionItem>
 *   <AccordionItem title="Data quality" open>…</AccordionItem>
 * </Accordion>
 */
export function Accordion({
  variant = "default",
  single = false,
  children,
}: AccordionProps): ReactElement {
  if (VARIANTS[variant] === undefined) {
    return (
      <WidgetError
        name="Accordion"
        message={`variant="${String(variant)}" is not one of ${Object.keys(VARIANTS).join(", ")}`}
      />
    );
  }
  const items = collectItemChildren<AccordionItemProps>(
    children,
    AccordionItem,
    "AccordionItem",
  );
  if (typeof items === "string") {
    return <WidgetError name="Accordion" message={items} />;
  }
  // Evidence seeds single mode with only the first `open` item; base-ui
  // would start every defaultValue entry expanded until the next toggle.
  const openValues = items.flatMap((item, i) =>
    item.props.open ? [String(i)] : [],
  );
  return (
    <AccordionPrimitive.Root
      data-slot="accordion-root"
      className={cn("w-full", VARIANTS[variant])}
      multiple={!single}
      hiddenUntilFound
      defaultValue={single ? openValues.slice(0, 1) : openValues}
    >
      {items.map((item, i) => (
        <AccordionPrimitive.Item
          key={item.key}
          value={String(i)}
          className="border-b border-neutral-200 last:border-b-0 dark:border-neutral-800"
        >
          {/* data-slot marks the h3 as widget chrome so collectTocHeadings
              skips it — accordion titles are disclosure labels, not
              document sections. */}
          <AccordionPrimitive.Header
            data-slot="accordion-header"
            className="flex"
          >
            <AccordionPrimitive.Trigger className="group flex flex-1 cursor-pointer items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-colors hover:underline">
              <span>{item.props.title}</span>
              <ChevronDownIcon className="shrink-0 translate-y-0.5 text-neutral-500 transition-transform duration-200 group-data-panel-open:rotate-180 dark:text-neutral-400" />
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>
          <AccordionPrimitive.Panel
            className={cn(
              "h-[var(--accordion-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0",
              variant !== "default" && "pb-3",
            )}
          >
            <div className="pb-4 text-sm">{item.props.children}</div>
          </AccordionPrimitive.Panel>
        </AccordionPrimitive.Item>
      ))}
    </AccordionPrimitive.Root>
  );
}

/**
 * The `<AccordionItem>` MDX widget — a data carrier whose props
 * `<Accordion>` reads through child inspection; rendered anywhere else it
 * reports the misuse inline instead of mounting an orphaned panel.
 *
 * @example
 * <Accordion><AccordionItem title="Methodology">…</AccordionItem></Accordion>
 */
export function AccordionItem(_props: AccordionItemProps): ReactElement {
  return (
    <WidgetError
      name="AccordionItem"
      message="must be a direct child of <Accordion>"
    />
  );
}
