// Where the formation hover card sits.
//
// It has now been wrong twice in two opposite ways. Following the pointer read a stale
// hovered id and failed to appear on first hover. Parking it in a fixed corner appeared
// reliably, but nowhere near the thing being hovered — the player looks at row 4 and the
// card answers from the top of the screen.
//
// So: anchor it to the element that is actually being hovered, and measure that element
// in the same event that sets the hover, rather than tracking the pointer. The card sits
// beside the row, aligned to it, and stays inside an allowed vertical band so it can
// never ride up over the mission chrome or run off the bottom of the screen.

export const HOVER_CARD_GAP = 10;
// Keeps the notch from sliding past the card's own rounded corners when a row near the
// top or bottom of the list forces the card to clamp.
const NOTCH_INSET = 14;

export const hoverCardPlacementFor = ({ anchor, cardHeight, cardWidth, viewport, bounds } = {}) => {
  if (!anchor || !viewport || !bounds) return null;
  const height = Number.isFinite(cardHeight) && cardHeight > 0 ? cardHeight : 0;
  const width = Number.isFinite(cardWidth) && cardWidth > 0 ? cardWidth : 0;

  // Beside the hovered element, falling back inside the viewport if there is no room to
  // its right (a formation marker near the eastern edge of the battlefield).
  const preferred = anchor.right + HOVER_CARD_GAP;
  const rightmost = viewport.width - width - HOVER_CARD_GAP;
  const flipped = anchor.left - width - HOVER_CARD_GAP;
  const left = preferred <= rightmost
    ? preferred
    : Math.max(HOVER_CARD_GAP, Number.isFinite(flipped) ? flipped : rightmost);

  // Aligned to the row, then clamped into the band. `lowest` is floored at `bounds.top`
  // so a card taller than the band pins to the top and scrolls rather than inverting.
  const lowest = Math.max(bounds.top, bounds.bottom - height);
  const top = Math.max(bounds.top, Math.min(anchor.top, lowest));

  // The notch keeps pointing at the row even once the card has been clamped away from it.
  const centre = (anchor.top + anchor.bottom) / 2;
  const notchTop = height > NOTCH_INSET * 2
    ? Math.max(NOTCH_INSET, Math.min(centre - top, height - NOTCH_INSET))
    : NOTCH_INSET;

  return { left: Math.round(left), top: Math.round(top), notchTop: Math.round(notchTop) };
};

// The band the card may occupy: below the app header, above the footer controls.
export const hoverCardBoundsFor = ({ headerBottom, footerTop, viewportHeight } = {}) => ({
  top: Number.isFinite(headerBottom) ? headerBottom + HOVER_CARD_GAP : HOVER_CARD_GAP,
  bottom: Number.isFinite(footerTop)
    ? footerTop - HOVER_CARD_GAP
    : (Number.isFinite(viewportHeight) ? viewportHeight : 0) - HOVER_CARD_GAP,
});
