# ADR-0015 — A labelled bar chart drops the value axis its labels repeat

Status: accepted
Date: 2026-10-16

## Context

A chart widget's `labels` prop prints each point's value on its mark (`labelOption` in `src/web/src/features/widgets/charts/to-option.ts`). Until now the value axis drew as well: tick labels plus a horizontal gridline per tick from the chart theme (`src/web/src/features/widgets/charts/theme.ts`). Labels and ticks were formatted against one shared range so they read in one unit, which rounded labels to the axis' step: a `3,700` bar read `4k` next to a `4k` tick, and the reader got the same number twice at the wrong precision.

NN/g, "Clutter in charts" (https://www.nngroup.com/articles/clutter-charts/): "We can simply remove the y-axis and grid lines, since the data labels render them redundant." The same article keeps the axis when the chart draws something the labels don't state, such as confidence intervals.

Of the BI-as-code tools we compared, none couples gridlines to data labels: the common shape is a per-axis gridline toggle the author sets, or a grid that is off unless asked for. Auto-hiding is therefore our own rule, not a port.

Bar shapes in this system: a non-stacked `BarChart` labels the top of each bar with its value; a stacked bar labels each segment inside its band, so no label gives the stack total the axis reads; a `Histogram` always stacks its series. Line and area labels sit on points and `labelLayout.hideOverlap` drops the ones that collide, so a dense line shows only some of its values.

## Decision drivers

- Read each value once, at a precision that doesn't contradict the data.
- No extra prop for the author to remember on every labelled chart.
- Never hide an axis whose values are not all printed elsewhere.

## Options considered

| Option                                                                                 | Pro                                                                                   | Con                                                                                    |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Auto-hide the value axis' tick labels and gridlines on a non-stacked bar with `labels` | `labels` is exactly the signal NN/g names; every labelled bar is decluttered for free | A behaviour no compared tool has; an author who wants both must drop `labels`          |
| A `gridlines` prop (author toggles gridlines per chart)                                | Matches the common reference shape; explicit                                          | Every labelled chart must remember it; the tick labels still repeat the values         |
| Keep both                                                                              | No change                                                                             | Values read twice, labels rounded to the axis step                                     |
| Auto-hide on line/area too                                                             | One rule for every series chart                                                       | `hideOverlap` thins line labels, so the axis is the only readout for the hidden points |

## Decision

A non-stacked bar chart with `labels` hides its value axis' tick labels and gridlines and keeps the baseline; stacked bars, histograms, lines and areas keep their axis.

With no tick beside them, the labels still format against the series range, so they share one unit, but the thousands unit keeps one decimal (`FormatRange.standalone` in `src/web/src/features/widgets/value/types.ts`): `6.1k 4.8k 3.7k`, not `6k 5k 4k`. Below the thousands threshold nothing changes, and the million-and-up units already carry a decimal.

## Consequences

- `labels` on a bar chart now means "the labels are the value readout". The predicate is `labelsReplaceValueAxis` in `src/web/src/features/widgets/charts/to-option.ts`.
- A future reader may want to "restore" the y axis on a labelled bar for consistency with other charts. It is gone on purpose: the labels carry the same numbers more precisely.
- There is no `gridlines` prop. If an author needs a labelled bar with an axis (for example, to compare against a reference line), that prop is the extension point, and this ADR is superseded by it.
- A labelled stacked bar still shows segment labels and the full axis; a total label on top of each stack would be the change that lets it drop the axis too.
