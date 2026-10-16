import { useId, type ReactElement, type ReactNode } from "react";

/**
 * The text above a chart: a `title` naming what it plots and a muted
 * `subtitle` for context such as the unit. Plain text, never a heading
 * element — every chart already sits under a page section heading, and
 * the table of contents collects h2/h3, so a heading here would duplicate
 * outline entries. The enclosing figure takes its name from `titleId`.
 *
 * @example
 * <ChartHeading titleId={id} title="Revenue by region" subtitle="US dollars" />
 */
export function ChartHeading({
  titleId,
  title,
  subtitle,
}: {
  titleId: string;
  title?: string;
  subtitle?: string;
}): ReactElement {
  return (
    <div className="mb-2 text-sm break-words">
      {title !== undefined && (
        <div id={titleId} className="font-semibold text-foreground">
          {title}
        </div>
      )}
      {subtitle !== undefined && (
        <div data-chart-subtitle className="text-muted-foreground">
          {subtitle}
        </div>
      )}
    </div>
  );
}

/**
 * Wraps a chart in a `<figure>` named by its title, with the heading text
 * above `children` — so the title stays put over every state face. An
 * untitled chart passes `children` through unwrapped.
 *
 * @example
 * <ChartFigure title="Revenue by region" subtitle="US dollars"><EChart … /></ChartFigure>
 */
export function ChartFigure({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}): ReactElement {
  const titleId = useId();
  if (title === undefined && subtitle === undefined) return <>{children}</>;
  return (
    <figure aria-labelledby={title === undefined ? undefined : titleId}>
      <ChartHeading titleId={titleId} title={title} subtitle={subtitle} />
      {children}
    </figure>
  );
}
