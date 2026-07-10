// Re-export all shared types from canonical sources.
// Import from here (../../types) inside feature modules.

export type {
  PriorityLevel,
  ReviewPeriod,
  Priority,
  RosieMemoryItem,
  RosieRecommendation,
  Commitment,
  Decision,
  TimelineEntry,
  Reflection,
  SecretRecord,
  PersonalData,
  NodeType,
  EdgeType,
  GraphNode,
  GraphEdge,
  KnowledgeGraphData,
} from '../localData'

export type {
  VaultEnvelope,
  BackupPackage,
  RecoveryAuditEvent,
} from '../vault'
