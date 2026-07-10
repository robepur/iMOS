# Build 012: Rosie Mission Planning Engine

## Architecture

Build 012 introduces deterministic mission planning as a local encrypted planning layer. Rosie can generate plans from operator records but never executes work. Operator actions control approval, activation, pause, completion, and cancellation.

### Core Modules

| File | Purpose |
|---|---|
| `src/services/MissionPlanningEngine.ts` | Mission generation, step generation, ordering, validation, explanation, progress |
| `src/services/DependencyEngine.ts` | Dependency analysis, blocker detection, circular dependency checks, deterministic sort |
| `src/features/missions/MissionPlanner.tsx` | Main planner UI and operator control surface |
| `src/features/missions/MissionDashboard.tsx` | Active mission progress |
| `src/features/missions/MissionHistory.tsx` | Mission lifecycle history |
| `src/features/missions/MissionStatistics.tsx` | Read-only mission statistics |
| `src/features/missions/MissionTimeline.tsx` | Mission lifecycle timeline view |
| `src/features/missions/DependencyViewer.tsx` | Dependency and blocker visualization |

---

## Mission Planning Engine

`MissionPlanningEngine` provides deterministic behavior:

- selects source priorities from primary and related active priorities
- generates pre-execution blocker steps (open decisions, open commitments)
- generates execution steps for selected priorities
- adds reflection closeout step
- orders steps with dependency-first deterministic sort
- validates dependency integrity
- computes progress and active-step state
- produces plain-language explanation for plan rationale

---

## Mission Model

Persisted model additions in `PersonalData`:

- `missionPlans?: MissionPlan[]`
- `missionSteps?: MissionStep[]`

`MissionPlan` stores mission metadata, status, source priorities, step IDs, and explanation.

`MissionStep` stores deterministic order, dependency links, evidence, effort estimate, and completion state.

---

## Dependency Engine

`DependencyEngine` detects:

- blocking decisions
- blocking commitments
- missing prerequisites
- completed dependency count
- circular dependencies
- blocked steps

Sort logic is deterministic and never random.

---

## Knowledge Graph Integration

Build 012 extends graph model:

- node types: `mission`, `mission_step`
- edge types: `generated_from`, `depends_on`, `blocked_by`, `completes` (plus existing shared types)

Graph relationships include:

- mission generated from priorities
- mission steps generated from mission
- step-to-step dependencies
- active/paused mission blocked by open decision/commitment
- mission supports/completes source priorities

All edges include evidence, timestamp, and confidence derived from evidence count.

---

## Executive Brief Integration

Morning Brief now includes mission planning context when available:

- active mission
- current mission step
- blocked work
- mission progress
- mission risks

Evening Summary now includes:

- completed mission steps
- mission progress percentage
- outstanding blocks
- deterministic recommended next step

---

## Security

- no AI/LLM/ML
- no external APIs
- no network requests
- no cloud/backend synchronization
- mission data stored only in encrypted local vault
- no secret/password values exposed in mission explanations or graph evidence
- operator approval required for all mission lifecycle actions

Rosie cannot auto-activate plans or autonomously execute operator work.

---

## Migration

`normalizePersonalData` adds safe defaults for:

- `missionPlans`
- `missionSteps`

Legacy vaults continue to load without explicit migration steps or export/import.

---

## Acceptance Criteria

- deterministic mission generation implemented
- deterministic dependency analysis and ordering implemented
- operator approval lifecycle implemented (approve/activate/pause/complete/cancel/delete/edit)
- mission progress and statistics implemented
- mission history and mission timeline implemented
- graph integration implemented for mission nodes/edges
- brief integration implemented for morning/evening mission context
- build and tests passing

---

## Known Limitations

- current mission generation template is deterministic but intentionally conservative
- mission blocker linking uses open decision/commitment state and evidence heuristics
- timeline dedupe remains title/detail/type based

---

## Future Roadmap

- richer mission templates by operational domain
- stronger deterministic matching between mission steps and record-level blockers
- expanded mission analytics (trend windows, mission class baselines)
- optional mission archival views with period filters
