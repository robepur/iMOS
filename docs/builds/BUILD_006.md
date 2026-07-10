# Build 006 | Priority Command and Rosie Memory

## Purpose

Extend iMOS from a basic operating loop into a persistent executive priority and memory system. The operator can create, organize, edit, complete, and review priorities. Rosie surfaces deterministic memory from prior operator reflections using only data inside the encrypted vault.

## Scope

1. Full priority lifecycle management (create, edit, complete, reopen, delete, reorder, set primary)
2. Priority data model upgrade with backward compatible migration
3. Priority Command Console — dedicated component
4. Time-aware Arrival greeting
5. Rosie Memory — deterministic, derived from reflection records
6. Rosie Memory Interface — shown during Arrival
7. Reflection History view — review and delete prior reflections
8. Updated Executive Brief with true counts and priority stats
9. Timeline audit events for all priority and reflection operations
10. Build documentation

## Data Model

### Priority (upgraded, backward compatible)

```typescript
export type PriorityLevel = 'critical' | 'high' | 'normal' | 'low'

export type Priority = {
  id: string
  title: string
  why: string
  level: PriorityLevel
  due: string
  completed: boolean
  primary: boolean
  order: number
  createdAt: string
  updatedAt: string
  completedAt?: string
}
```

### RosieMemoryItem (derived, not persisted)

```typescript
export type RosieMemoryItem = {
  id: string
  text: string
  sourceReflectionId: string
  createdAt: string
}
```

RosieMemoryItem records are never stored separately. They are derived from reflection records at runtime and discarded when the vault is locked.

## Migration Behavior

Build 006 vaults open all prior vault formats (Build 003, Build 004, Build 005) without requiring the operator to export and reimport.

On unlock, `normalizePersonalData()` reconstructs every Priority with the full new schema:

| Missing field | Assigned value |
|---|---|
| `level` | `'normal'` |
| `due` | `''` |
| `primary` | `false` for all except the first incomplete priority when no primary exists |
| `order` | array index at normalization time |
| `updatedAt` | copied from `createdAt` |

The first save after unlock persists the normalized schema into the encrypted vault. Legacy data is never discarded.

## Priority Console

Component: `src/PriorityConsole.tsx`

### Features

- Active and completed priority lists
- Active priorities sorted by `order` value
- Completed priorities sorted by `completedAt` descending
- Search by title and why text
- Filter by Active or Completed
- Create new priority
- Edit any priority
- Mark one priority as primary (automatically removes primary from previous)
- Move active priority up or down (explicit controls, no drag and drop)
- Complete a priority (removes primary flag, assigns primary to next incomplete)
- Reopen a completed priority
- Delete a priority with confirmation

### Accessibility

- All buttons have accessible `aria-label` attributes
- Edit icon uses a visible text span with `.srOnly` class for screen readers
- Editor opens in a modal dialog with `role="dialog"` and `aria-modal="true"`
- Filter buttons are grouped with `role="group"`
- Form fields are explicitly labelled

## Rosie Memory Rules

Function: `getRosieMemory(data: PersonalData): RosieMemoryItem[]`

Source: `reflection.remember` field only.

Rules:
1. Only non-empty `remember` values are included
2. Reflections are processed newest first (natural array order, newest at index 0)
3. Maximum 5 items returned from the function
4. Maximum 3 items displayed during Arrival
5. Memory text is the exact operator-supplied text — nothing is inferred, generated, or modified
6. `RosieMemoryItem` records are derived at render time and never stored separately

Rosie Memory does not:
- Call any AI API
- Generate probabilistic conclusions
- Perform semantic search
- Infer meaning from text
- Learn or adapt

The UI label reads: "You asked Rosie to remember this."

## Reflection History

Component: `src/ReflectionHistory.tsx`

- Displays all reflections newest first
- Shows date, accomplished, remember, and tomorrow fields
- Delete requires confirmation dialog
- Deletion creates a Timeline event: "Reflection deleted"
- Editing is not supported in this build
- Accessible from the Executive Brief via the REFLECTION HISTORY button

## Timeline Events

Build 006 adds the following timeline events of type `'priority'`:

| Event | Trigger |
|---|---|
| Priority created | New priority saved in PriorityConsole |
| Priority updated | Existing priority saved in PriorityConsole |
| Priority completed | Priority marked complete in PriorityConsole or FocusView |
| Priority reopened | Completed priority reopened in PriorityConsole |
| Priority deleted | Priority removed after confirmation |
| Primary priority changed | Star button clicked in PriorityConsole |
| Priority reordered | Move up or move down control used |
| Reflection deleted | Reflection removed from ReflectionHistory |

Timeline event details do not include passphrase, secret values, usernames, or secure note content.

## Security Boundaries

- All priority data, Rosie Memory source data, and reflections remain inside the encrypted vault
- No new localStorage keys are created
- `RosieMemoryItem` records are never persisted — derived at runtime and cleared on lock
- Locking the vault clears `showPriorities`, `showReflectionHistory`, and all active React state
- Normalization does not log decrypted values to the console
- Priority and reflection delete operations do not expose record content in Timeline details

## Known Limitations

- Rosie Memory is deterministic — no AI model is used
- Rosie Memory uses only the operator-supplied `remember` text from reflections
- No semantic search or inference
- No drag and drop priority reordering — Move Up and Move Down controls are used
- No recurring priorities
- No priority dependencies
- No shared priorities
- No external sync
- Reflection editing is not supported in this build
- The `src/index.css` dead file from Build 003 is still present but not imported

## Acceptance Criteria

1. An existing Build 005 vault unlocks without error
2. A new priority can be created with title, level, due date, why, and primary flag
3. A priority can be edited — all fields update correctly
4. Only one priority may be primary at a time — assigning primary removes it from the previous holder
5. Priorities can be moved up and down in active order
6. A priority can be completed — it moves to the completed list and primary is reassigned
7. A completed priority can be reopened
8. A priority can only be deleted after explicit confirmation
9. All priority operations create safe Timeline entries without exposing sensitive data
10. Reflection History displays prior reflections newest first
11. Rosie Memory displays non-empty `remember` values during Arrival
12. Rosie Memory does not display empty `remember` values
13. Rosie Memory displays newest items first
14. Locking the vault removes all decrypted data from active React state
15. Unlocking restores all encrypted information
16. Backup export includes Build 006 priority and reflection data
17. A Build 005 backup can be restored successfully
18. Arrival greeting reflects time of day (morning / afternoon / evening)
19. No network request occurs during normal operation
20. TypeScript build and Vite production build both pass without errors
