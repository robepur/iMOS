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
  MissionPlan,
  MissionStep,
} from '../localData'

export type {
  VaultEnvelope,
  BackupPackage,
  RecoveryAuditEvent,
} from '../vault'

export type {
  CognitionDataCategory,
  CognitionFeatureSurface,
  CognitionConsentAction,
  CognitionConsentAuditEvent,
  CognitionConsent,
  UnderstandingContractState,
  UnderstandingProvenance,
  UnderstandingCorrection,
  OperatorUnderstanding,
  CloudSyncConsentDeclaration,
  ConnectorPermissionLevel,
  ConnectorPermissionGrant,
  ConnectorConsentDeclaration,
  Phase3ConsentState,
} from './cognitive'
