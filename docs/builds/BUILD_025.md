# Build 025 — Mobile First Interface and Design Foundation

**Branch:** `phase-4/build-025-interface-design`  
**Build constant:** `025`  
**App version:** `0.1.0-rc.1` (unchanged)  
**Base:** Build 024 (merged at `d291f2939445b72d3c4cd392707e28d6e2c02ab4`)

---

## Purpose

Transform iMOS MVP into a clean, disciplined, executive-level operator experience using the ARGUS tactical design direction. Mobile is the priority. Desktop scales from the mobile foundation.

This build changes **presentation and navigation only**. No security, data, recovery, synchronisation, cognition, or business logic was changed.

---

## What Changed

### Design System
- `src/design/tokens.css` — canonical CSS custom properties for all colour, typography, spacing, border, shadow, motion, and layout tokens
- `src/styles.css` — imports tokens; rewrites all hardcoded values to use `var()` tokens; adds mobile-first shell/nav styles

### Application Shell
- `src/components/AppShell.tsx` — new shell component replacing the dense topbar
  - Mobile: sticky compact header + fixed bottom nav (5 tabs) + more drawer
  - Desktop (≥768px): left navigation rail (220px) + more section inline
  - All 9 previous topbar buttons mapped to 5 nav destinations + More drawer

### Navigation Model
| Old | New |
|-----|-----|
| 9-button topbar | 5-tab bottom nav + More drawer |
| ROSIE button | ROSIE tab (bottom nav) |
| MISSION button | MISSIONS tab (bottom nav) |
| PRIORITIES button | FOCUS tab (bottom nav) |
| VAULT, SECRETS, RECOVERY, REVIEW, KNOWLEDGE, REFLECTIONS, FEEDBACK | More drawer items |

### App.tsx
- Replaced `<main className="shell">` + topbar with `<AppShell>`
- Added `activeTab` state (`NavTab`)
- Added `handleTabChange` function mapping tabs to panel opens
- Added `moreItems` array for More drawer
- Timeline now togglable via More > TIMELINE (desktop always shown previously)

### Build Constant
- `BUILD` advanced from `'024'` to `'025'`
- All prior test BUILD assertions updated to `'025'`

---

## Architecture Boundaries Preserved

| Boundary | Status |
|----------|--------|
| No vault cryptography changes | ✅ |
| No recovery behaviour changes | ✅ |
| No synchronisation behaviour changes | ✅ |
| No conflict classification changes | ✅ |
| No cognition or Rosie authority changes | ✅ |
| No provider integrations added | ✅ |
| No hosted services added | ✅ |
| No outbound actions added | ✅ |
| No operator controls removed | ✅ |
| No security gates weakened | ✅ |
| Pilot feedback remains in encrypted vault | ✅ |

---

## Test Suite

**File:** `tests/build-025-interface-design.test.tsx`

| Describe block | Count |
|----------------|-------|
| Build metadata | 6 |
| AppShell structure | 7 |
| Bottom navigation | 9 |
| Desktop navigation | 6 |
| More drawer | 7 |
| Accessibility | 5 |
| VaultGate | 5 |
| Existing behavior preserved | 7 |
| **Total** | **52** |

---

## Files Changed

| File | Change |
|------|--------|
| `src/constants.ts` | BUILD → `'025'` |
| `src/styles.css` | Rewritten to use tokens; shell/nav styles added |
| `src/App.tsx` | AppShell integration, new nav model |
| `src/design/tokens.css` | NEW — canonical design tokens |
| `src/components/AppShell.tsx` | NEW — shell, bottom nav, desktop rail, more drawer |
| `tests/build-025-interface-design.test.tsx` | NEW — 52 tests |
| `tests/build-024-mvp-release.test.tsx` | BUILD assertion → `'025'` |
| `tests/sync/build-023-mvp-validation.test.tsx` | BUILD assertion → `'025'` |
| `tests/sync/build-021-sync-convergence.test.ts` | BUILD assertion → `'025'` |
| `docs/design/IMOS_DESIGN_SYSTEM.md` | NEW |
| `docs/design/MOBILE_INTERFACE_STANDARD.md` | NEW |
| `docs/design/RESPONSIVE_VALIDATION.md` | NEW |
| `docs/design/SCREEN_INVENTORY.md` | NEW |
| `docs/builds/BUILD_025.md` | NEW (this file) |
| `docs/releases/BUILD_025_VISUAL_VALIDATION.md` | NEW |

---

## Completion Gate

| # | Check | Required |
|---|-------|----------|
| 1 | TypeScript passes | ✅ Required |
| 2 | Full test suite passes (500+ tests) | ✅ Required |
| 3 | Security boundary scan passes | ✅ Required |
| 4 | Migration suite passes | ✅ Required |
| 5 | Recovery suite passes | ✅ Required |
| 6 | Performance baseline passes | ✅ Required |
| 7 | Production build passes | ✅ Required |
| 8 | All PR checks pass | ✅ Required |
| 9 | Post-merge `main` CI passes | ✅ Required |
| 10 | Zero critical security findings | ✅ Required |
| 11 | Mobile navigation complete | ✅ Done |
| 12 | Desktop navigation complete | ✅ Done |
| 13 | All user-facing text uses approved white treatments | ✅ CSS tokens enforce |
| 14 | User-facing sentences contain no hyphens | ✅ Reviewed |

---

## Deferred to Build 026

- Individual feature panel internal mobile layouts (MissionPlanner, RosieCenter, ReviewCenter)
- Screenshot capture validation at all required viewports
- Loading skeleton states
- Complete card-transform for all desktop tables
- Knowledge graph responsive treatment
