import {
  createContext,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode,
} from "react";

/**
 * Whether the page cards its widgets, and whether this subtree already sits
 * on a card. Nothing inside a card gets a second one: a card inside a card
 * doubles the border and the padding. Default off for provider-less mounts
 * (stories, tests), so a widget renders bare unless a page opts in.
 */
interface CardScope {
  cards: boolean;
  insideCard: boolean;
}

const CardScopeContext = createContext<CardScope>({
  cards: false,
  insideCard: false,
});

/**
 * Turns cards on or off for a page.
 *
 * @example
 * <CardsProvider cards={page.layout.cards === true}>{content}</CardsProvider>
 */
export function CardsProvider({
  cards,
  children,
}: {
  cards: boolean;
  children: ReactNode;
}): ReactElement {
  const scope = useMemo(() => ({ cards, insideCard: false }), [cards]);
  return (
    <CardScopeContext.Provider value={scope}>
      {children}
    </CardScopeContext.Provider>
  );
}

/**
 * Marks a subtree as already on a card — a widget that draws its own box
 * wraps its content in it so the widgets inside get none.
 *
 * @example
 * <NoCardScope>{panelContent}</NoCardScope>
 */
export function NoCardScope({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const { cards } = useCardScope();
  const scope = useMemo(() => ({ cards, insideCard: true }), [cards]);
  return (
    <CardScopeContext.Provider value={scope}>
      {children}
    </CardScopeContext.Provider>
  );
}

/** The card setting in effect where a widget renders. */
export function useCardScope(): CardScope {
  return useContext(CardScopeContext);
}
