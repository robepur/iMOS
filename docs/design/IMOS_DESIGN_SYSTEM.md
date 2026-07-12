# iMOS Design System

**Version:** 0.1.0-rc.1  
**Build:** 025  
**Design Direction:** ARGUS Tactical

---

## Design Direction

iMOS uses the ARGUS tactical design direction: a navy foundation with white text hierarchy, red for critical status and primary actions, and gold for controlled executive emphasis. The interface is disciplined, clean, and minimal. Every element has a reason to exist.

---

## Colour Tokens

All colour references in component CSS must use the tokens defined in `src/design/tokens.css`. Do not reference raw hex values.

### Navy Foundation

| Token | Usage |
|-------|-------|
| `--navy-900` | Page background |
| `--navy-800` | Surface background |
| `--navy-750` | Elevated surface |
| `--navy-700` | Card background |
| `--navy-650` | Gradient highlight |

### Red — Critical / Primary Action

| Token | Usage |
|-------|-------|
| `--red-600` | Primary button background |
| `--red-500` | Primary button hover |
| `--red-300` | Critical status indicator |
| `--red-100` | Danger button text |

### Gold — Executive Emphasis

| Token | Usage |
|-------|-------|
| `--gold-500` | Active state, eyebrow, Rosie accent |
| `--gold-400` | Secondary gold text |
| `--gold-700` | Muted emphasis background |

### White Tonal Hierarchy

| Token | Opacity | Usage |
|-------|---------|-------|
| `--white-100` | 1.00 | Primary text |
| `--white-70`  | 0.70 | Secondary text |
| `--white-55`  | 0.55 | Tertiary text |
| `--white-35`  | 0.35 | Muted / nav inactive |
| `--white-20`  | 0.20 | Strong border |
| `--white-12`  | 0.12 | Medium border |
| `--white-08`  | 0.08 | Subtle border |
| `--white-05`  | 0.05 | Surface hover |
| `--white-03`  | 0.035 | Faint surface |

---

## Semantic Tokens

Use semantic tokens in component CSS, not primitive tokens.

```
--text-primary      → --white-100
--text-secondary    → --white-70
--text-tertiary     → --white-55
--text-muted        → --white-35

--border-strong     → --white-20
--border-medium     → --white-12
--border-subtle     → --white-08

--bg-base           → --navy-900
--bg-surface        → --navy-800
--bg-elevated       → --navy-750

--color-critical    → --red-300
--color-action      → --red-600
--color-emphasis    → --gold-500
```

---

## Typography Scale

| Token | Size | Usage |
|-------|------|-------|
| `--text-2xs` | 9px  | Tactical badges, smallest labels |
| `--text-xs`  | 10px | Tactical labels |
| `--text-sm`  | 11px | Secondary labels |
| `--text-base`| 12px | Button text, metadata |
| `--text-md`  | 14px | Body text |
| `--text-lg`  | 16px | Medium body |
| `--text-xl`  | 18px | Lead text |
| `--text-2xl` | 22px | Subheadings |
| `--text-3xl` | clamp(26px, 4vw, 42px) | Section headings |
| `--text-hero`| clamp(34px, 5vw, 68px) | Hero headings |

### Typography Rules

1. All user-facing text is white (use `--text-primary` or a tonal variant)
2. Uppercase labels use `--text-xs` or `--text-sm` with `--tracking-tactical`
3. Body text uses `--text-md` with `--leading-normal`
4. User-facing sentences must not contain hyphens
5. Dense uppercase paragraphs are not permitted
6. Very small text (below 10px) is not permitted in user-facing content

---

## Spacing Scale

Uses 4px base unit. Reference `--space-N` tokens only.

```
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-5:  20px
--space-6:  24px
--space-8:  32px
--space-10: 40px
--space-12: 48px
--space-16: 64px
```

---

## Border and Shadow Treatments

| Treatment | Token |
|-----------|-------|
| Cards | `border: 1px solid var(--border-medium)` |
| Panels | `border: 1px solid var(--border-subtle)` |
| Active state | `border: 1px solid var(--border-strong)` |
| Card shadow | `--shadow-card` |
| Panel shadow | `--shadow-panel` |
| Modal shadow | `--shadow-modal` |

---

## Touch Target Rules

- Minimum touch target: `var(--touch-min)` = 44px in both dimensions
- All interactive controls must meet this minimum
- Navigation items use `min-height: var(--touch-min)`
- Icon buttons use explicit `min-width` and `min-height`

---

## Motion Rules

| Rule | Behaviour |
|------|-----------|
| Fast transitions | `var(--motion-duration-fast)` = 100ms |
| Normal transitions | `var(--motion-duration-normal)` = 200ms |
| Slow transitions | `var(--motion-duration-slow)` = 300ms |
| Easing | `var(--motion-easing)` = cubic-bezier(0.16, 1, 0.3, 1) |
| Reduced motion | All durations set to 0ms when `prefers-reduced-motion: reduce` |

---

## Navigation Patterns

### Mobile — Bottom Navigation
- 5 tabs maximum
- Tabs: Home, Focus, Missions, Rosie, More
- Fixed to bottom of viewport
- Height: `var(--nav-height-mobile)` = 64px + safe area
- Active tab uses gold colour
- Alert badges use red

### Desktop — Left Navigation Rail
- Width: `var(--nav-width-desktop)` = 220px
- Same 5 destinations, displayed vertically
- More items expand inline below primary destinations
- Lock button at footer

### More Drawer (mobile)
- Slide-up sheet
- Secondary destinations: Vault, Secrets, Recovery, Review, Knowledge, Reflections, Timeline, Feedback
- Backdrop dismisses drawer
- Items have 44px touch targets

---

## Button Hierarchy

| Level | Class | Background | Border |
|-------|-------|------------|--------|
| Primary action | default `<button>` | `--color-action` (red) | red border |
| Secondary | `.secondaryButton` | transparent | `--border-medium` |
| Utility | `.utilityButton` | transparent | `--border-medium` |
| Danger | `.dangerButton` | transparent | red border |
| Icon | `.iconButton` | transparent | `--border-medium` |

---

## Status Treatments

| State | Colour |
|-------|--------|
| Critical | `--color-critical` (red) |
| Warning | `--gold-500` (gold) |
| Success / Clear | `--text-muted` (white tonal) |
| Disabled | `--text-disabled` opacity 0.55 |
| Encrypted / Secure | `--text-muted` |

---

## Panel and Card Patterns

- **Panel**: `border: 1px solid var(--border-medium)`, gradient background (`--surface-panel`)
- **Card**: similar but without the gradient, used for list items
- **Empty state**: centred, uses `--text-muted`, dashed border
- **Loading state**: structural skeleton, no animated spinner by default

---

## Form Controls

- Labels: uppercase, `--text-xs`, `--tracking-tactical`, `--color-emphasis`
- Inputs: `background: #061321`, `border: 1px solid var(--border-strong)`
- Focus ring: `border-color: var(--color-emphasis)`
- Errors: `--red-100` text, `font-size: var(--text-md)`

---

## Dialog Patterns

- Backdrop: `position: fixed; inset: 0; background: var(--bg-overlay)`
- Dialog: `width: min(760px, 100%)`, max-height with scroll
- Focus trap required
- Close button accessible by keyboard
- On mobile: dialogs must fit within viewport with keyboard open
