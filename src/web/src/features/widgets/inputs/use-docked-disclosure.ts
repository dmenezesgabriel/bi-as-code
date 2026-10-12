import { useState, type FocusEventHandler } from "react";

interface DockedDisclosure {
  /** Whether the docked bar shows its inputs. */
  opened: boolean;
  setOpened: (opened: boolean) => void;
  /** Spread on the inputs panel: they tell the bar whether focus is in it. */
  panelFocusProps: {
    onFocus: FocusEventHandler;
    onBlur: FocusEventHandler;
  };
}

/**
 * Whether the reader sees the docked bar's inputs. A bar docks collapsed,
 * unless focus is in one of its inputs at that moment: collapsing would hide
 * the control the reader is using under them (WCAG 2.2 SC 2.4.11), so it
 * docks opened instead — decided in the render that docks it, because one
 * collapsed frame is enough for the browser to drop the focus. Coming back
 * to rest forgets the opened state. Focus is followed through React's focus
 * events, which bubble through portals, so an input's popup portaled to
 * `<body>` counts as inside the bar.
 *
 * @example
 * const { opened, setOpened, panelFocusProps } = useDockedDisclosure(resting);
 * <Collapsible.Panel {...panelFocusProps}>{children}</Collapsible.Panel>
 */
export function useDockedDisclosure(resting: boolean): DockedDisclosure {
  const [opened, setOpened] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [wasResting, setWasResting] = useState(resting);
  if (resting !== wasResting) {
    setWasResting(resting);
    setOpened(!resting && focusWithin);
  }
  const panelFocusProps = {
    onFocus: () => setFocusWithin(true),
    onBlur: () => setFocusWithin(false),
  };
  return { opened, setOpened, panelFocusProps };
}
