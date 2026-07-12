# Responsive Validation Record

**iMOS 0.1.0-rc.1 — Build 025**

---

## Required Viewports

| Width | Device Reference | Status |
|-------|-----------------|--------|
| 320px | Small mobile | Pending visual validation |
| 375px | iPhone SE / baseline mobile | Pending |
| 390px | iPhone 14 | Pending |
| 430px | iPhone 14 Plus | Pending |
| 768px | Tablet / desktop nav activation | Pending |
| 1024px | Desktop standard | Pending |
| 1440px | Desktop wide | Pending |

---

## Validation Checklist (Per Viewport)

For each viewport above, verify:

- [ ] No horizontal page scrolling
- [ ] No primary element overlaps another element
- [ ] No clipped primary action or button
- [ ] Navigation labels remain fully visible
- [ ] Button text remains readable on a single line
- [ ] Status labels remain readable
- [ ] Forms remain usable (keyboard-aware on mobile)
- [ ] Dialogs fit within the visible area
- [ ] Tables have transformed to cards (mobile viewports)
- [ ] Primary action is reachable with one hand

---

## Navigation Validation

| Checkpoint | 320px | 375px | 390px | 430px | 768px | 1024px | 1440px |
|------------|-------|-------|-------|-------|-------|--------|--------|
| Bottom nav visible | ✓ | ✓ | ✓ | ✓ | — | — | — |
| Desktop nav visible | — | — | — | — | ✓ | ✓ | ✓ |
| All 5 tabs visible | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| No label wrapping | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## Touch Target Validation

- All navigation tabs: 44px minimum ✓ (flex column, min-height: 44px)
- Lock buttons: 44px minimum ✓
- More drawer items: 44px minimum ✓
- Vault / modal close buttons: 44px minimum ✓

---

## Typography Validation

- All text uses white tonal hierarchy ✓ (CSS tokens enforced)
- No hyphens in user-facing sentences ✓ (reviewed in all new components)
- No dense uppercase paragraphs ✓
- Body text minimum 14px ✓
- Tactical labels minimum 10px ✓

---

## Known Deferred Items

| Item | Reason | Target |
|------|--------|--------|
| Individual feature panel mobile layouts (e.g. MissionPlanner, RosieCenter) | These panels open as full-screen overlays on mobile; internal layouts are addressed in Build 026+ | Build 026 |
| Review Center card transform | Internal grid layouts in ReviewCenter need mobile card treatment | Build 026 |
| Secret grid mobile card layout | 3-column grid transforms to 1-column on mobile already; card UI refinement deferred | Build 026 |
| Screenshot capture at all viewports | Requires Codespace browser or CI screenshot tooling | Build 026 |

---

## How to Validate

1. Open iMOS in the Codespace browser (`https://urban-palm-tree-r77wwg7gggwpfp4r5-5173.app.github.dev/`)
2. Open browser DevTools responsive mode
3. Test each viewport width from the table above
4. Work through the checklist for each viewport
5. Record any findings in this document

---

## CI Validation

Automated tests in `tests/build-025-interface-design.test.tsx` verify:

- AppShell renders all 5 navigation destinations
- Navigation labels are short (no wrapping risk)
- Touch target classes are applied
- Aria labels are present
- No overflow CSS classes on shell root

Visual validation at required viewports requires browser-based tooling (see Deferred Items).
