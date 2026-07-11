export type RecoveryAuditEvent = {
  id: string
  type: 'backup-created' | 'backup-verified' | 'recovery-tested' | 'vault-restored' | 'passphrase-rotated' | 'recovery-failed'
  createdAt: string
  detail: string
}
