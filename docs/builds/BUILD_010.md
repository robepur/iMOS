# Build 010: Operator Knowledge Graph

## Purpose

Build 010 evolves Rosie from reacting to isolated records into understanding relationships between records. A deterministic Operator Knowledge Graph is built from the encrypted vault on unlock, continuously maintained after every mutation, and queried by the operator directly through the Knowledge Graph Viewer and Knowledge Search.

No AI. No LLM. No embeddings. No semantic inference. Every relationship is derived from explicit textual evidence.

---

## Architecture

### New Files

| File | Purpose |
|---|---|
| `src/services/KnowledgeGraph.ts` | Full graph engine: build, patch, getRelated, search, getStats, explainEdge |
| `src/hooks/useKnowledgeGraph.ts` | React hook: memoized graph + helper functions |
| `src/features/knowledge/KnowledgeGraphViewer.tsx` | Executive relationship explorer panel |
| `src/features/knowledge/RelationshipPanel.tsx` | Edge list with evidence and confidence |
| `src/features/knowledge/KnowledgeSearch.tsx` | Full-vault search with related record discovery |
| `src/features/knowledge/RosieContextPanel.tsx` | Per-record context: related work, memory, recs, reflections |
| `src/features/knowledge/StatisticsPanel.tsx` | Read-only graph statistics |
| `src/features/knowledge/index.ts` | Export hub |
| `tests/knowledge/graph.test.ts` | 20 relationship discovery, search, stats, backward compat tests |
| `docs/builds/BUILD_010.md` | This document |

### Modified Files

| File | Change |
|---|---|
| `src/localData.ts` | Added `NodeType`, `EdgeType`, `GraphNode`, `GraphEdge`, `KnowledgeGraphData` types; `knowledgeGraph?` on `PersonalData` |
| `src/types/index.ts` | Re-exports all new graph types |
| `src/App.tsx` | Added `useKnowledgeGraph`, KNOWLEDGE topbar button, lazy-loads KnowledgeGraphViewer, graph link count in statebar |
| `src/styles.css` | Appended Build 010 knowledge graph, relationship panel, search, context panel, stats styles |

---

## Node Types

| Type | Source |
|---|---|
| `priority` | `data.priorities` |
| `commitment` | `data.commitments` |
| `decision` | `data.decisions` |
| `reflection` | `data.reflections` |
| `timeline` | `data.timeline` |
| `secret` | `data.secrets` (safe metadata only) |
| `recommendation` | `data.recommendations` |
| `recovery` | Timeline events of type `recovery` |
| `memory` | Rosie memory items |

---

## Edge Types

| Type | Meaning |
|---|---|
| `related_to` | Records share significant keywords |
| `created_from` | Record was created as a result of another |
| `references` | Record explicitly references another |
| `supports` | Record supports the completion of another |
| `depends_on` | Record depends on outcome of another |
| `completed_by` | Priority was completed during a reflection session |
| `mentioned_in` | Text content mentions another record |
| `derived_from` | Record derives its content from another |
| `observed_in` | Record was observed via another record |
| `remembered_by` | Priority is referenced in Rosie memory |

---

## Discovery Rules (9 active)

| Rule | Evidence Used | Edge Type |
|---|---|---|
| Reflection text mentions priority title keywords | `accomplished + remember + tomorrow` vs `priority.title` | `mentioned_in` |
| Reflection "remember" field cross-references priority | `reflection.remember` keyword vs `priority.title` | `remembered_by` |
| Commitment title shares keywords with decision | `commitment.title` vs `decision.title` | `references` |
| Decision context mentions priority keywords | `decision.context` vs `priority.title` | `depends_on` |
| Priority and commitment share title keywords | `priority.title` vs `commitment.title` | `related_to` |
| Recommendation evidence cites a record title | `recommendation.evidence[]` vs record titles | `observed_in` |
| Timeline event mentions priority keywords | `timeline.title + detail` vs `priority.title` | `observed_in` |
| Completed priority on same day as reflection | `priority.completedAt.slice(0,10)` vs `reflection.createdAt.slice(0,10)` | `completed_by` |
| Secret metadata (safe fields only) shares keywords with priority | `secret.title + category + url` vs `priority.title` | `supports` |

---

## Evidence Model

Each edge carries an `evidence` array of human-readable strings explaining why the relationship was detected. Confidence is:
- `low` = 1 evidence item
- `medium` = 2 evidence items
- `high` = 3+ evidence items

---

## Performance

Graph is built in-memory from `PersonalData` on vault unlock. For typical vault sizes (hundreds of records), build time is <1ms. `KnowledgeGraph.patch()` calls `build()` in full — for vault sizes handled by iMOS, incremental rebuild is fast enough that a full rebuild on each mutation is preferred over maintaining partial state.

`useKnowledgeGraph` memoizes the graph on `data` reference, so the graph only rebuilds when vault data actually changes (React `useMemo`).

---

## Security

- Secret node titles only include safe metadata (`title`, `category`, `url`) — never `password`, `username`, or `notes`
- Knowledge graph nodes never expose plaintext sensitive data
- The `knowledgeGraph` field on `PersonalData` is optional and not persisted — it is rebuilt on each unlock
- All graph data remains inside the encrypted vault boundary (computed in-memory only)
- No network requests. No external services.

---

## Migration

`knowledgeGraph` is an optional field on `PersonalData`. Vaults from Builds 003–009 that do not contain it are fully supported — the graph is automatically built after vault unlock. `normalizePersonalData()` does not need to add this field since it is not persisted.

---

## Acceptance Criteria

- [x] Existing vaults (Builds 003–009) open without data loss
- [x] Knowledge graph builds automatically on vault unlock
- [x] KNOWLEDGE topbar button opens KnowledgeGraphViewer
- [x] All 9 discovery rules produce correct edges with evidence
- [x] KnowledgeSearch returns direct and related matches
- [x] RelationshipPanel shows edge type, confidence, evidence, and explanation
- [x] StatisticsPanel shows total nodes, edges, avg degree, most connected records
- [x] Relationship deduplication: same pair + same type = one edge
- [x] Secret values never appear in graph evidence
- [x] Graph link count shown in statebar
- [x] 54 tests passing (20 new graph tests)
- [x] Production build clean

---

## Known Limitations

- Keyword matching uses words >4 chars only — very short titles may not form edges
- Graph is not persisted between sessions (rebuilt on unlock) — intentional for security
- `patch()` is a full rebuild — acceptable for current vault sizes
- Recommendation-to-record edges depend on the recommendation's `evidence[]` text matching record titles precisely

---

## Future Extensions

- Graph path traversal (multi-hop relationship paths)
- Temporal relationship weighting (older relationships decay)
- Graph diff between sessions (what relationships changed)
- Relationship export for personal knowledge management
