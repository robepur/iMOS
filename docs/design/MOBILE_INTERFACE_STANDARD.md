# Mobile Interface Standard

**iMOS 0.1.0-rc.1 — Build 025**

---

## Principle

Mobile is the primary design target. Desktop scales from the mobile foundation. Every layout decision is made for mobile first, then adapted for wider viewports.

---

## Breakpoints

| Name | Width | Layout |
|------|-------|--------|
| Mobile small | 320px | Single column, bottom nav |
| Mobile | 375px | Single column, bottom nav |
| Mobile large | 430px | Single column, bottom nav |
| Tablet | 768px | Desktop nav rail activates |
| Desktop | 1024px | Wider panels, more information density |
| Wide | 1440px | Centred, controlled max-width |

---

## Navigation

### Mobile (< 768px)
- Bottom navigation bar, 5 tabs
- Compact sticky header with wordmark and lock button
- More drawer: slide-up sheet for secondary destinations
- All primary destinations reachable with one thumb

### Desktop (≥ 768px)
- Left navigation rail, 220px
- Same 5 destinations, vertical layout
- More section inline in rail footer
- Mobile header and bottom nav hidden

---

## Layout Rules

1. **One column on mobile** — no two-column layouts below 768px
2. **No horizontal scrolling** at any required viewport
3. **No overlapping elements** at any required viewport
4. **No clipped primary actions** at any required viewport
5. **Navigation labels never wrap** — max label length 10 chars
6. **Buttons never wrap** — single line text only
7. **Status labels never wrap** — truncate if necessary

---

## Touch Target Rules

- Minimum size: 44 × 44px
- Navigation tabs: full height of nav bar, flex: 1 width
- Icon buttons: 44px min-width and min-height
- List item actions: full-row touch area where possible
- Spacing between touch targets: minimum 4px

---

## Scroll Behaviour

- Primary content scrolls vertically within the content area
- Navigation is fixed and never scrolls
- Sticky headers use `position: sticky` not `position: fixed` where possible
- Bottom nav is `position: fixed` to avoid layout shift

---

## Mobile Keyboard

- Forms remain usable with the mobile keyboard open
- Input fields do not use `position: fixed` wrappers
- Dialogs scroll independently when keyboard is visible
- No critical control is hidden behind the keyboard

---

## Cards vs Tables

- Data tables on desktop transform to cards on mobile
- Cards use: title, key value, status badge, action row
- Actions within cards use full-width touch targets
- No horizontal scrolling within cards

---

## Drawers and Detail Panels

- Secondary content uses drawers or dedicated screens
- Drawers slide from the bottom on mobile
- Drawers have a drag handle visual indicator
- Backdrop closes the drawer on tap
- Maximum height: 80svh to ensure the backdrop is visible

---

## Dialogs

- Dialogs use `width: min(760px, 100%)` with 20px side padding on mobile
- Max height: `calc(100svh - 40px)` with internal scroll
- Must fit entirely within the viewport with the keyboard open
- Focus trap is required
- Close is always reachable

---

## Typography on Mobile

- Body text: minimum 14px
- Labels: minimum 10px (tactical badges only)
- Line height: 1.5 minimum for body text
- No dense uppercase paragraphs
- Long content uses controlled expansion, not truncation

---

## Empty, Loading, and Failure States

### Empty
- Centred within the content area
- Icon or visual indicator
- Descriptive text in `--text-muted`
- Primary action to fill the state

### Loading
- Skeleton or neutral placeholder
- No spinner unless background operation requires user wait
- Reduced motion respected

### Failure
- Error description in plain language
- No technical error codes in user-facing text
- Recovery action available

---

## Accessibility Requirements

1. Keyboard navigation works on all interactive controls
2. Visible focus states using `--color-emphasis` outline
3. Screen reader labels on all icon buttons
4. Dialog focus trapped correctly
5. Reduced motion respected via `prefers-reduced-motion`
6. Text contrast meets WCAG AA (white on navy exceeds requirements)
7. Mobile zoom not disabled (`viewport` meta allows scaling)
8. Colour is never the only status indicator
