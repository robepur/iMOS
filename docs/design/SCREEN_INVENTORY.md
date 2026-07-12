# Screen Inventory

**iMOS 0.1.0-rc.1 — Build 025**

---

## Primary Destinations (Navigation)

| Destination | Tab | Implementation | Mobile Layout | Status |
|-------------|-----|---------------|---------------|--------|
| Home | HOME | OperatingLoop (Arrival / Brief / Focus / Reflection) | Single column, full width | ✅ Redesigned |
| Focus | FOCUS | PriorityConsole modal | Full-screen overlay | ✅ Accessible via nav |
| Missions | MISSIONS | MissionPlanner modal | Full-screen overlay | ✅ Accessible via nav |
| Rosie | ROSIE | RosieCenter modal | Full-screen overlay | ✅ Accessible via nav |
| More | MORE | Bottom drawer (mobile) / rail section (desktop) | Slide-up sheet | ✅ Redesigned |

---

## Authentication Screens

| Screen | Component | Mobile Layout | Status |
|--------|-----------|---------------|--------|
| Vault creation | `VaultGate` (state=setup) | Centred card, full width | ✅ Mobile compatible |
| Vault unlock | `VaultGate` (state=locked) | Centred card, full width | ✅ Mobile compatible |

---

## Onboarding

| Screen | Component | Mobile Layout | Status |
|--------|-----------|---------------|--------|
| Onboarding flow (12 steps) | `OnboardingFlow` | Single column, step progress | ✅ Build 024 |
| Onboarding review | `OnboardingReview` | Accessible via More drawer | ✅ Build 024 |

---

## Home Screens (OperatingLoop)

| Screen | State | Mobile Layout | Status |
|--------|-------|---------------|--------|
| Arrival | `mode=arrival` | Hero card, greeting, begin button | ✅ Mobile compatible |
| Morning Brief | `mode=brief` | Stacked cards, commitment/decision capture | Mobile improved |
| Focus Session | `mode=focus` | Centred priority, single action | ✅ Mobile compatible |
| Evening Reflection | `mode=reflection` | Form, save action | ✅ Mobile compatible |

---

## Secondary Screens (More Drawer)

| Screen | Component | Mobile Layout | Status |
|--------|-----------|---------------|--------|
| Vault data panel | `DataPanel` | Accessible via More > VAULT | ✅ |
| Secrets manager | `SecretsConsole` | Full-screen overlay | ✅ |
| Recovery console | `RecoveryConsole` | Full-screen overlay | ✅ |
| Review center | `ReviewCenter` | Full-screen overlay | ✅ |
| Knowledge graph | `KnowledgeGraphViewer` | Full-screen overlay | ✅ |
| Reflection history | `ReflectionHistory` | Full-screen overlay | ✅ |
| Timeline | Inline panel (workspace) | Toggle via More > TIMELINE | ✅ |
| Pilot feedback | `PilotFeedbackPanel` | Full-screen overlay | ✅ |

---

## State Screens

| Screen | Usage | Status |
|--------|-------|--------|
| Empty state | Empty priority list, empty decision list, etc. | Existing CSS `.emptyState`, `.secretEmpty` |
| Loading state | Suspense fallback during lazy imports | `fallback={null}` — deferred for Build 026 |
| Failure state | `ErrorBoundary` catches render errors | Existing `ErrorBoundary` component |
| Saving state | Badge in header/nav during vault save | ✅ `SECURING` badge |
| Recovery state | `RecoveryConsole` with restore feedback | ✅ Build 022+ |

---

## Panels Deferred for Build 026+

| Panel | Reason |
|-------|--------|
| MissionPlanner internal mobile layout | Internal grid, card transform needed |
| RosieCenter internal mobile layout | Recommendation cards need mobile treatment |
| ReviewCenter internal mobile layout | Multi-column review grid needs card transform |
| KnowledgeGraphViewer mobile | Graph visualisation needs responsive treatment |
| SecretsConsole grid mobile | 3-column grid already responsive; detail UI deferred |
| Priority editor mobile | Grid form needs single-column treatment review |

---

## Component Inventory

| Component | Location | Build 025 Changes |
|-----------|----------|--------------------|
| `AppShell` | `src/components/AppShell.tsx` | NEW — shell, bottom nav, desktop rail, more drawer |
| `VaultGate` | `src/features/vault/VaultGate.tsx` | No changes required |
| `OperatingLoop` | `src/features/arrival/OperatingLoop.tsx` | No changes in B025 |
| `PriorityConsole` | `src/features/priorities/PriorityConsole.tsx` | No changes |
| `MissionPlanner` | `src/features/missions/MissionPlanner.tsx` | No changes |
| `RosieCenter` | `src/features/rosie/RosieCenter.tsx` | No changes |
| `OnboardingFlow` | `src/features/onboarding/OnboardingFlow.tsx` | No changes |
| `PilotFeedbackPanel` | `src/features/pilot/PilotFeedbackPanel.tsx` | No changes |
| All sync / recovery panels | `src/features/sync/`, `src/features/recovery/` | No changes |
