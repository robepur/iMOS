# BUILD 016 — Adaptive Briefing and Planning Presentation

## Purpose

Build 016 adds deterministic, consent-gated presentation adaptation so iMOS can tune briefing/review/planning display without mutating operator records or expanding Rosie authority.

## What is included

- `src/services/AdaptivePresentationEngine.ts`
  - Neutral profile baseline
  - Consent + eligibility gating (fail-closed)
  - Deterministic mapping registry + conflict resolution
  - Operator override precedence and neutral restoration helpers
  - Explainability and adaptation audit event generation
- `src/types/presentation.ts`
  - Build 016 profile, override, mapping, adaptation, and audit contracts
- `src/localData.ts`
  - Additive persistence fields:
    - `presentationPersonalizationEnabled`
    - `presentationProfile`
    - `presentationOverrides`
    - `presentationAdaptationAudit`
    - `presentationMappingRegistryVersion`
  - Safe normalization defaults for absent/malformed fields
- `src/hooks/useVault.ts`
  - Persistence APIs for Build 016 personalization/override/profile updates
- `src/features/cognition/PersonalizationControlCenter.tsx`
  - Operator control surface for enable/disable, override, active adaptation inspection, and neutral restoration
- `src/App.tsx`
  - Profile resolution orchestration from confirmed understandings
  - Persistence of resolved profile + audit
  - Topbar entry and control center wiring
  - Surface profile injection into briefing/review/mission planner
- Presentation-aware UI integrations:
  - `src/features/arrival/OperatingLoop.tsx`
  - `src/features/review/ReviewCenter.tsx`
  - `src/features/missions/MissionPlanner.tsx`

## Safety and authority boundaries

- Consent is required before adaptation can activate.
- Only confirmed, eligible understandings are considered.
- Operator overrides always win.
- Adaptation is presentation-only; no source record mutation occurs.
- No network paths, telemetry, cloud calls, or plaintext persistence added.
- No autonomous execution or authority expansion introduced.

## Migration and compatibility

- Additive schema only.
- Builds 003–015 remain compatible.
- Malformed Build 016 presentation state normalizes to safe defaults.

## Tests

- Added `tests/cognition/presentation.test.ts` for core engine behavior.
- Expanded `tests/migration/compatibility.test.ts` and `tests/fixtures/compatibilityVaults.ts` for Build 016 persistence compatibility.

## Known limitations

- Mapping registry is intentionally narrow in Build 016 and designed for safe extension in later builds.
- Surface adaptations currently prioritize deterministic readability controls over full UI layout personalization.

