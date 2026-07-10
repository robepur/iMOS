# Build 008: Core Architecture and Rosie Foundation

## Purpose

Build 008 transforms iMOS from a growing application into a clean modular operating system architecture. No new operator-facing features are added. The objective is engineering quality: dedicated services, custom hooks, a shared component library, schema migration engine, testing infrastructure, and CI — all while preserving every capability from Builds 003–007.

---

## Architecture

### Directory Structure

```
src/
  types/               Re-export hub for all shared types
  constants.ts         All magic values: storage keys, crypto params, limits
  utils/
    date.ts            formatDate, isOverdue, isInPeriod, getPeriodStart
    index.ts           Re-export barrel
  SchemaVersion.ts     Migration pipeline (migrateToLatest)
  services/
    StorageService.ts  localStorage abstraction
    VaultService.ts    Cryptographic facade
    RosieEngine.ts     Deterministic operator intelligence
  hooks/
    useVault.ts        Vault lifecycle + all data mutations
    usePriorities.ts   Derived priority stats
    useSecrets.ts      Secrets accessor
    useReview.ts       Review period/tab state
    useTimeline.ts     Timeline filter/sort state
    useRosie.ts        Rosie greeting, memory, summary
  components/
    shared.tsx         StatusBadge, SearchBox, MetricCard, Buttons, etc.
    ErrorBoundary.tsx  Fail-closed error protection
  features/
    arrival/           OperatingLoop (Arrival, Brief, FocusView, Reflection)
    priorities/        PriorityConsole
    review/            ReviewCenter, CommitmentHistory, DecisionHistory, OperatorStatistics
    reflection/        ReflectionHistory
    timeline/          TimelineExplorer
    vault/             VaultGate
    recovery/          RecoveryConsole
    secrets/           SecretsConsole
    rosie/             RosieMemory
  App.tsx              105 lines (<150 target)
  localData.ts         Canonical types and normalizePersonalData
  vault.ts             AES-GCM crypto engine (unchanged)
  styles.css           Single active stylesheet

tests/
  setup.ts             Vitest + jest-dom setup
  crypto/              encryption.test.ts
  migration/           schema.test.ts
  priority/            normalization.test.ts
  rosie/               engine.test.ts
  vault/               (planned)
  review/              (planned)
```

---

## Services

### VaultService (`src/services/VaultService.ts`)

Single point of access for all cryptographic operations. App.tsx and hooks never import `vault.ts` directly.

| Method | Description |
|---|---|
| `save(data, pass)` | Encrypt and persist to LocalStorage |
| `unlock(pass)` | Decrypt vault, apply schema migration |
| `create(data, pass)` | Initialize new vault |
| `restore(backup, pass)` | Restore from backup package |
| `rotatePassphrase(data, current, next)` | Re-encrypt under new key |
| `exportBackup()` | Download encrypted .imos file |
| `verifyBackup(value)` | Verify package integrity |
| `testRecovery(value, pass)` | In-memory recovery test |

### StorageService (`src/services/StorageService.ts`)

Isolated LocalStorage access layer. Swapping to IndexedDB or another provider requires only changing this file.

### RosieEngine (`src/services/RosieEngine.ts`)

Deterministic operator intelligence. No AI, no inference, no external services. Every output is derived from operator-supplied data.

| Method | Description |
|---|---|
| `getGreeting()` | Time-aware greeting from system clock |
| `getRecommendation(primary?)` | Priority recommendation from operator data |
| `getMemory(data, period?)` | Reflection "remember" fields only |
| `getExecutiveSummary(data, period)` | Counts derived from encrypted records |
| `getBriefLine(data)` | Short tactical status line |

---

## Hooks

| Hook | Used in | Purpose |
|---|---|---|
| `useVault()` | App.tsx | Vault lifecycle + all data mutations |
| `usePriorities(data)` | App.tsx | Active count, primary, overdue, critical |
| `useSecrets(data)` | App.tsx | Records and count |
| `useReview()` | ReviewCenter.tsx | Period and tab state |
| `useTimeline(timeline)` | TimelineExplorer.tsx | Filtered/sorted timeline |
| `useRosie(data, period?)` | Arrival, ReviewCenter | Greeting, memory, summary |

No Context API, Redux, or Zustand. State passes through typed props.

---

## Schema Version Engine

`src/SchemaVersion.ts` provides:
- `SCHEMA_VERSION` constant
- `migrateToLatest(raw)` — accepts any unknown payload, returns a safe `PersonalData`
- `isCompatibleVersion(v)` — version guard

Compatible with all vaults from Builds 003–008.

---

## Shared Component Library

`src/components/shared.tsx` exports:

`StatusBadge` · `SectionHeader` · `SearchBox` · `FilterBar` · `MetricCard` · `Card` · `PrimaryButton` · `SecondaryButton` · `DangerButton` · `ResultCount`

---

## Lazy Loading

Four large feature consoles are loaded only when opened:

| Component | Chunk |
|---|---|
| ReviewCenter | `ReviewCenter-*.js` (13.5KB) |
| RecoveryConsole | `RecoveryConsole-*.js` (6.9KB) |
| SecretsConsole | `SecretsConsole-*.js` (7.5KB) |
| ReflectionHistory | `ReflectionHistory-*.js` (2.3KB) |

Main bundle reduced from 257KB to 233KB.

---

## Error Boundary

`src/components/ErrorBoundary.tsx` wraps all lazy-loaded feature consoles.

- Failures fail closed — no decrypted information is exposed on error
- Displays RETRY option
- Logs errors to console without leaking data

---

## Testing

Framework: Vitest 4 + jsdom + @testing-library/react

```
tests/
  crypto/encryption.test.ts     AES-GCM round-trip, IV randomness, wrong passphrase
  migration/schema.test.ts       migrateToLatest with null, empty, older builds
  priority/normalization.test.ts normalizePersonalData, primary assignment, level coercion
  rosie/engine.test.ts           greeting, recommendation, memory, executive summary
```

Run: `pnpm test` (21 tests, all pass)

---

## CI/CD

`.github/workflows/ci.yml` runs on every push and PR:

1. TypeScript check (`tsc -b --noEmit`)
2. Unit tests (`pnpm test`)
3. Production build (`pnpm run build`)
4. Build output verification

Fails if: TypeScript errors, test failures, or build failures.

---

## Migration Compatibility

All vaults from Builds 003–008 open correctly via `migrateToLatest()`:

| Build | Missing fields handled |
|---|---|
| 003 | `secrets`, `priorities`, `timeline` arrays added |
| 004 | Recovery audit stored separately — no vault migration needed |
| 005 | Normalized via existing `normalizePersonalData` |
| 006 | Priority `level`, `order`, `primary` normalized |
| 007+ | Full schema, no migration required |

---

## Security

All security properties from Builds 003–007 are unchanged:

- AES-256-GCM encryption
- PBKDF2-SHA-256 (310,000 iterations)
- Passphrase in memory only (never persisted)
- LocalStorage only — encrypted ciphertext
- No network requests
- No external services
- No telemetry
- Fail closed on all errors

VaultService is the only allowed entry point for crypto operations. App.tsx has no direct access to `vault.ts`.

---

## Acceptance Criteria

- [x] App.tsx: 105 lines (<150 target)
- [x] src/types/index.ts created
- [x] src/constants.ts created
- [x] src/utils/ created
- [x] src/SchemaVersion.ts created
- [x] StorageService.ts created
- [x] VaultService.ts created
- [x] RosieEngine.ts created
- [x] All 6 hooks created
- [x] Shared component library created
- [x] ErrorBoundary created
- [x] All feature files in src/features/
- [x] Feature index.ts re-exports per directory
- [x] Lazy loading: 4 large consoles
- [x] Vitest: 21 tests, all pass
- [x] GitHub Actions CI workflow
- [x] TypeScript: 0 errors
- [x] Vite production build: success (203ms)

---

## Known Limitations

- `tests/vault/` and `tests/review/` directories are scaffolded but contain no tests yet — vault tests require crypto stubs that are planned for Build 009
- `RosieEngine.getGreeting()` depends on `new Date()` — not injectable in tests (covered by snapshot)
- The `useTimeline` and `useReview` hooks are currently component-local; future builds could hoist to App.tsx if cross-component coordination is needed

---

## Stack Relationship

```
main
 └── agent/build-004-secure-recovery
      └── agent/build-005-secrets-management
           └── agent/build-006-priority-memory
                └── agent/build-007-operator-intelligence
                     └── agent/build-008-core-architecture  ← this build
```

Draft PR targets `agent/build-007-operator-intelligence`.
