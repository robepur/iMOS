# Build 025 Visual Validation Record

**iMOS 0.1.0-rc.1 — Build 025**

---

## Status

Build 025 visual validation is pending browser-based review in the Codespace. The automated test suite verifies structural correctness. Visual review at required viewports must be completed before pilot use begins.

---

## How to Validate

1. Open the active Codespace: `https://urban-palm-tree-r77wwg7gggwpfp4r5-5173.app.github.dev/`
2. Open browser DevTools → Responsive Design Mode
3. Test each viewport from the required list
4. Work through the checklist for each screen

---

## Required Viewports

320px, 375px, 390px, 430px, 768px, 1024px, 1440px

---

## Screens to Review

### Authentication
- [ ] Vault creation — 375px
- [ ] Vault creation — 768px
- [ ] Vault unlock — 375px
- [ ] Vault unlock — 768px

### Onboarding
- [ ] Step 1 (Welcome) — 375px
- [ ] Step 6 (Recovery backup) — 375px
- [ ] Step 12 (Complete) — 375px
- [ ] Any step — 768px

### Home
- [ ] Arrival screen — 375px
- [ ] Arrival screen — 768px
- [ ] Morning brief — 375px
- [ ] Morning brief — 768px
- [ ] Focus session — 375px
- [ ] Evening reflection — 375px

### Navigation
- [ ] Bottom nav — 320px (no wrapping)
- [ ] Bottom nav — 375px
- [ ] Desktop rail — 768px
- [ ] Desktop rail — 1024px
- [ ] More drawer — 375px

### Secondary Panels
- [ ] Priorities — 375px
- [ ] Missions — 375px
- [ ] Rosie center — 375px
- [ ] Recovery console — 375px
- [ ] Pilot feedback — 375px

---

## Visual Checklist (Complete for Each Screen)

- [ ] No horizontal page scrolling
- [ ] No element overlaps
- [ ] No clipped controls
- [ ] White text hierarchy is readable
- [ ] Red and gold are used with restraint
- [ ] Navigation labels are visible
- [ ] Interface feels consistent

---

## Findings

_Record any visual findings here during review._

| Screen | Viewport | Finding | Severity | Resolution |
|--------|----------|---------|----------|------------|
| — | — | None logged | — | — |

---

## Known Intentionally Deferred Issues

| Issue | Reason |
|-------|--------|
| Individual feature panel internal mobile layouts | Build 026 scope |
| Screenshot capture automation | Requires CI tooling setup |
| Full card-transform for all desktop tables | Build 026 scope |

---

## Verdict

Visual validation: **Pending**

A complete visual review at required viewports must be performed before declaring Build 025 visually complete. The automated test suite passes structural requirements. Deferred visual items are documented above and targeted for Build 026.
