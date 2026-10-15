import { useMemo } from "react";
import { useThemeMode } from "../../chrome/theme-mode";
import { withTokenProbe } from "./css-token-reader";
import { readChartTokens } from "./theme";
import type { ChartTokens } from "./types";

/**
 * The chart colours for the resolved mode, read from the stylesheet once per
 * mode change — a toggle re-reads them, so an edited token reaches the
 * canvas on the next flip.
 *
 * @example
 * const tokens = useChartTokens();
 * <EChart option={toChartOption(model, "bar", props, tokens)} />
 */
export function useChartTokens(): ChartTokens {
  const mode = useThemeMode();
  return useMemo(() => withTokenProbe(mode, readChartTokens), [mode]);
}
