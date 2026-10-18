import type { ComponentType, ReactElement, ReactNode } from "react";
import { NoCardScope, useCardScope } from "./card-scope";

// The card face shared with `<Accordion variant="card">`: the same surface,
// border, radius and shadow, padded 1rem like evidence's `p-card-pad`.
const CARD_FACE = "rounded-lg border border-card-border bg-card p-4 shadow-xs";

function WidgetCard({ children }: { children: ReactNode }): ReactElement {
  const { cards, insideCard } = useCardScope();
  if (!cards || insideCard) return <>{children}</>;
  return (
    <div data-widget-card className={CARD_FACE}>
      <NoCardScope>{children}</NoCardScope>
    </div>
  );
}

/**
 * Wraps a widget so it sits on its own card when the page turns cards on,
 * and renders it bare otherwise or when it is already inside a card. The
 * wrapped component is built once, so turning cards on or off changes only
 * context and the widget never remounts.
 *
 * @example
 * const mdxComponents = { BarChart: withCard(BarChart) };
 */
export function withCard<Props extends object>(
  Widget: ComponentType<Props>,
): ComponentType<Props> {
  function Carded(props: Props): ReactElement {
    return (
      <WidgetCard>
        <Widget {...props} />
      </WidgetCard>
    );
  }
  Carded.displayName = `withCard(${Widget.displayName ?? Widget.name})`;
  return Carded;
}
