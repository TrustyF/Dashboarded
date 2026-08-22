"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./Popover.module.sass";

export type PopoverPlacement = "above" | "below";

export type PopoverRenderProps = {
  // Which edge of the anchor the popover ended up on - "below" means it
  // renders under the anchor (an arrow should sit on the popover's *top*
  // edge, pointing up at it), "above" the reverse (arrow on the *bottom*
  // edge, pointing down).
  placement: PopoverPlacement;
  // Distance in px from the popover box's own left edge to the anchor's
  // horizontal center, clamped to stay within the box - use this as an
  // arrow/notch's `left` so it keeps pointing at the anchor even when
  // viewport clamping has shifted the box sideways off-center from it.
  arrowOffset: number;
};

type Props = {
  // Anchor to position against, in viewport coordinates (an element's
  // getBoundingClientRect()) - null means "closed", the caller drives that by
  // holding onto the rect only while its own popover should be open.
  anchorRect: DOMRect | null;
  onClose: () => void;
  children: ReactNode | ((info: PopoverRenderProps) => ReactNode);
};

const VIEWPORT_MARGIN = 8;
// Leaves enough of a gap for a caller's arrow/notch (a small triangle poking
// a few px past the box's own edge) to visually bridge the rest of the way
// to the anchor without overlapping it.
const ANCHOR_GAP = 8;
// Keeps an arrow drawn at `arrowOffset` from landing underneath the box's
// own rounded corner, whatever radius the caller happens to use.
const ARROW_MARGIN = 14;

// Bare positioning shell - no background, padding, or border of its own,
// callers own everything about how the content (and an optional arrow/notch)
// looks. What it does own:
//
// - Escaping clipping: portaled to document.body and position: fixed, so an
//   ancestor's overflow:hidden (or a kiosk page with no scroll to spill into)
//   can't cut it off - it was built after exactly that happened to a
//   tooltip anchored inside two nested overflow:hidden cards.
// - Flipping above the anchor when there's no room below, and clamping
//   horizontally so it can't run off either edge of the viewport.
// - Closing itself on an outside click, so callers don't each reimplement
//   the same document listener.
// - Working out where an arrow/notch would need to point to still land on
//   the anchor after that flip/clamp, exposed to a function-as-children
//   caller as `placement` and `arrowOffset` - the shell computes the
//   geometry, the caller still draws and colors the arrow itself.
export default function Popover({ anchorRect, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{
    top: number;
    left: number;
    ready: boolean;
    placement: PopoverPlacement;
    arrowOffset: number;
  }>({ top: 0, left: 0, ready: false, placement: "below", arrowOffset: 0 });

  // Runs before paint: the popover is measured at its natural size (rendered
  // off-screen via `ready: false` below) then repositioned in the same frame,
  // so there's no flash at the wrong spot.
  useLayoutEffect(() => {
    if (!anchorRect || !ref.current) return;

    const { width, height } = ref.current.getBoundingClientRect();

    const fitsBelow = anchorRect.bottom + ANCHOR_GAP + height <= window.innerHeight - VIEWPORT_MARGIN;
    const placement: PopoverPlacement = fitsBelow ? "below" : "above";
    const top = fitsBelow
      ? anchorRect.bottom + ANCHOR_GAP
      : Math.max(VIEWPORT_MARGIN, anchorRect.top - ANCHOR_GAP - height);

    const left = Math.min(
      Math.max(anchorRect.left, VIEWPORT_MARGIN),
      window.innerWidth - width - VIEWPORT_MARGIN,
    );

    const anchorCenter = anchorRect.left + anchorRect.width / 2;
    const arrowOffset = Math.min(Math.max(anchorCenter - left, ARROW_MARGIN), width - ARROW_MARGIN);

    setState({ top, left, ready: true, placement, arrowOffset });
  }, [anchorRect]);

  useEffect(() => {
    if (!anchorRect) return;

    function handlePointerDown(e: MouseEvent) {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [anchorRect, onClose]);

  if (!anchorRect) return null;

  return createPortal(
    <div
      ref={ref}
      className={styles.popover}
      style={{ top: state.top, left: state.left, visibility: state.ready ? "visible" : "hidden" }}
    >
      {typeof children === "function" ? children({ placement: state.placement, arrowOffset: state.arrowOffset }) : children}
    </div>,
    document.body,
  );
}
