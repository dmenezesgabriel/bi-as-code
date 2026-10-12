import type { ReactElement } from "react";
import { useState } from "react";
import { Collapsible } from "../../../components/collapsible";
import { ChevronDownIcon } from "../../../components/icons";
import { useMediaQuery } from "../../chrome/use-media-query";
import { WidgetError } from "./states";
import type { DetailsProps } from "./types";

// "Mobile" resolves against the `md` breakpoint: below 768px a reader is on
// a phone-class viewport.
const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

/**
 * The `<Details>` MDX widget — a titled disclosure section: a chevron-led
 * trigger toggles a collapsible panel of prose or widgets. `open` starts it
 * expanded; `openMobile` overrides `open` on mobile viewports. Both feed
 * `defaultOpen`, which the primitive reads only at mount, so crossing the
 * breakpoint later does not override the reader's own toggle. A missing or
 * empty `title` renders an inline alert rather than an unlabeled button.
 *
 * @example
 * <Details title="Metric definitions">…</Details>
 * <Details title="Advanced" openMobile>…</Details>
 */
export function Details({
  title,
  open,
  openMobile,
  children,
}: DetailsProps): ReactElement {
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  // Frozen at the first render: base-ui warns when an uncontrolled
  // Collapsible sees its defaultOpen change after init, and the
  // mount-time resolution semantic means a later breakpoint crossing
  // must not touch it anyway.
  const [defaultOpen] = useState(
    () => (isMobile ? (openMobile ?? open) : open) ?? false,
  );
  if (title === undefined || title === "") {
    return <WidgetError name="Details" message='requires a "title" prop' />;
  }
  return (
    <Collapsible.Root defaultOpen={defaultOpen} className="flex flex-col">
      <Collapsible.Trigger className="group flex min-h-6 max-w-full cursor-pointer items-center gap-0.5 text-left text-sm text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100">
        <ChevronDownIcon className="shrink-0 -rotate-90 transition-transform group-data-panel-open:rotate-0" />
        <span className="min-w-0 truncate">{title}</span>
      </Collapsible.Trigger>
      <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0">
        <div className="pt-1 pl-4.5 text-sm">{children}</div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
