import type { ComponentType, ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { ThemeModeProvider } from "../chrome/theme-mode";
import { DuckDbLive } from "../data/duckdb-live";
import { DataRuntimeProvider } from "../data/runtime";
import { QueryRegistryProvider } from "../pages/query-registry";
import { BarChart } from "../widgets/charts/bar-chart";
import { TokenProbeParentContext } from "../widgets/charts/css-token-reader";
import type { SeriesChartProps } from "../widgets/charts/types";
import { CardsProvider } from "../widgets/card/card-scope";
import { withCard } from "../widgets/card/with-card";
import spaStyles from "../../styles.css?inline";
import type {
  ExportableWidget,
  MountMode,
  MountOptions,
  MountTeardown,
  WidgetSpec,
} from "./types";

/**
 * The exportable widgets by name, each wrapped in `withCard` exactly as
 * `markdown-page.tsx` mounts them, so an exported widget looks as it does
 * on its page.
 */
const WIDGETS: Record<ExportableWidget, ComponentType<SeriesChartProps>> = {
  BarChart: withCard(BarChart),
};

/**
 * The containers this module has mounted into, and whether the mount is
 * still live. `attachShadow` cannot be undone (a shadow root stays attached
 * once created), so both "is this container busy" and "is this shadow root
 * ours to reuse" are tracked here, not read off the element.
 */
interface MountState {
  teardown: MountTeardown;
  live: boolean;
}

const mounts = new WeakMap<Element, MountState>();

/**
 * Mounts one baked widget into `container` for a host page: the widget
 * renders inside a shadow root carrying the project's stylesheet, so its
 * styles and the host page's stay apart (the shadow boundary; the tokens
 * resolve through the mode-classed wrapper, Tailwind's `@theme` output
 * targets `:root, :host`). The widget's data comes from the publishing
 * origin — the spec's blocks run against the injected `DuckDb` layer, whose
 * URLs the build bakes absolute.
 *
 * Returns a teardown that unmounts the widget and empties the shadow root.
 * A container still hosting a live mount is refused; a torn-down one is
 * remounted in place; one carrying a shadow root this module did not create
 * is refused, so the host's own shadow content is never filled.
 *
 * @example
 * import { mountWidget } from "https://biac.example.com/widgets/revenue-by-region.js";
 * const stop = mountWidget(document.querySelector("#widget"), spec);
 */
export function mountWidget(
  container: Element,
  spec: WidgetSpec,
  options: MountOptions = {},
): MountTeardown {
  const state = mounts.get(container);
  if (state?.live) {
    throw new Error(
      "mountWidget: the container already hosts a mounted widget — call the previous mount's teardown first",
    );
  }
  if (!state && container.shadowRoot) {
    throw new Error(
      "mountWidget: the container already carries a shadow root this module did not create — pass a container of its own",
    );
  }
  const Widget = WIDGETS[spec.widget];
  if (!Widget) {
    throw new Error(
      `unknown exportable widget: ${String(spec.widget)} — expected one of: ${Object.keys(WIDGETS).join(", ")}`,
    );
  }
  const mode: MountMode = options.mode ?? "light";
  const shadowRoot =
    container.shadowRoot ?? container.attachShadow({ mode: "open" });
  shadowRoot.replaceChildren();
  const style = document.createElement("style");
  style.textContent = spaStyles;
  const wrapper = document.createElement("div");
  wrapper.className = mode;
  shadowRoot.append(style, wrapper);
  const root = createRoot(wrapper);
  root.render(
    <MountedWidget
      spec={spec}
      Widget={Widget}
      layer={options.layer ?? DuckDbLive}
      mode={mode}
      probeParent={shadowRoot}
    />,
  );
  const next: MountState = {
    teardown: () => {
      root.unmount();
      style.remove();
      wrapper.remove();
      next.live = false;
    },
    live: true,
  };
  mounts.set(container, next);
  return next.teardown;
}

/**
 * The provider tree a page route mounts, narrowed to one widget:
 * `DataRuntimeProvider` owns the DuckDB-WASM runtime, `ThemeModeProvider`
 * the token mode the chart reads, `TokenProbeParentContext` points the
 * chart's token probe at the shadow root, `CardsProvider` carries the
 * page's `cards` setting, and `QueryRegistryProvider` registers the spec's
 * tables and runs its blocks — the same registry `markdown-page.tsx` mounts.
 */
function MountedWidget({
  spec,
  Widget,
  layer,
  mode,
  probeParent,
}: {
  spec: WidgetSpec;
  Widget: ComponentType<SeriesChartProps>;
  layer: NonNullable<MountOptions["layer"]>;
  mode: MountMode;
  probeParent: Node;
}): ReactElement {
  return (
    <DataRuntimeProvider layer={layer}>
      <ThemeModeProvider mode={mode}>
        <TokenProbeParentContext.Provider value={probeParent}>
          <CardsProvider cards={spec.cards}>
            <QueryRegistryProvider
              sqlBlocks={spec.sqlBlocks}
              sqlTables={spec.sqlTables}
              params={{}}
            >
              <Widget {...spec.props} />
            </QueryRegistryProvider>
          </CardsProvider>
        </TokenProbeParentContext.Provider>
      </ThemeModeProvider>
    </DataRuntimeProvider>
  );
}
