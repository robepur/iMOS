import { useState, useCallback, useRef, useEffect } from 'react'
import type { SyncReviewItem, OperatorDecisionAction } from '../../types/syncReview'
import { CONFIRMATION_REQUIRED_ACTIONS } from '../../types/syncReview'

// ── Helpers ──────────────────────────────────────────────────────────────────

function kindLabel(kind: SyncReviewItem['kind']): string {
  switch (kind) {
    case 'divergent_history': return 'DIVERGENT HISTORY'
    case 'tombstone_conflict': return 'TOMBSTONE CONFLICT'
    case 'quarantine_record': return 'QUARANTINE'
  }
}

function kindDescription(kind: SyncReviewItem['kind']): string {
  switch (kind) {
    case 'divergent_history':
      return 'Two devices evolved from the same point in different directions. Operator confirmation required before accepting any version.'
    case 'tombstone_conflict':
      return 'A remote device has marked this object as deleted. Operator confirmation required before applying the deletion.'
    case 'quarantine_record':
      return 'This object failed security validation and was quarantined. Review the reason before discarding.'
  }
}

function actionLabel(action: OperatorDecisionAction): string {
  switch (action) {
    case 'keep_local': return 'Keep Local'
    case 'accept_remote': return 'Accept Remote'
    case 'preserve_both': return 'Preserve Both'
    case 'reject_remote': return 'Reject Remote'
    case 'discard_quarantine': return 'Discard Record'
    case 'leave_unresolved': return 'Leave Unresolved'
  }
}

function actionDescription(action: OperatorDecisionAction): string {
  switch (action) {
    case 'keep_local': return 'Discard the remote version. Your local data is preserved unchanged.'
    case 'accept_remote': return 'Apply the remote version. This will replace your local data for this object.'
    case 'preserve_both': return 'Keep both versions for later review. No data is discarded.'
    case 'reject_remote': return 'Reject the remote version without applying it. Your local data is unchanged.'
    case 'discard_quarantine': return 'Permanently remove this quarantine record. This cannot be undone.'
    case 'leave_unresolved': return 'No action taken. This item will remain in the review queue.'
  }
}

function availableActions(kind: SyncReviewItem['kind']): OperatorDecisionAction[] {
  if (kind === 'quarantine_record') {
    return ['discard_quarantine', 'leave_unresolved']
  }
  return ['keep_local', 'accept_remote', 'preserve_both', 'reject_remote', 'leave_unresolved']
}

// ── Confirmation Dialog ───────────────────────────────────────────────────────

interface ConfirmDialogProps {
  action: OperatorDecisionAction
  item: SyncReviewItem
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({ action, item, onConfirm, onCancel }: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()
  }, [])

  return (
    <div
      className="secretEditorBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-confirm-title"
      aria-describedby="sync-confirm-desc"
    >
      <div className="panel" style={{ width: 'min(480px, 100%)', padding: '28px' }}>
        <p className="eyebrow">Confirm Action</p>
        <h3 id="sync-confirm-title" style={{ margin: '8px 0' }}>{actionLabel(action)}</h3>
        <p id="sync-confirm-desc" style={{ color: '#9fb0c0', margin: '0 0 16px', lineHeight: 1.6 }}>
          {actionDescription(action)}
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {action === 'discard_quarantine'
            ? (
              <button
                className="dangerButton"
                onClick={onConfirm}
                ref={confirmRef}
                aria-label={`Confirm ${actionLabel(action)}`}
              >
                {actionLabel(action)}
              </button>
            )
            : (
              <button
                onClick={onConfirm}
                ref={confirmRef}
                aria-label={`Confirm ${actionLabel(action)}`}
              >
                {actionLabel(action)}
              </button>
            )
          }
          <button
            className="secondaryButton"
            onClick={onCancel}
            aria-label="Cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Review Item Row ──────────────────────────────────────────────────────────

interface ReviewItemRowProps {
  item: SyncReviewItem
  onAction: (itemId: string, action: OperatorDecisionAction) => void
  disabled: boolean
}

function ReviewItemRow({ item, onAction, disabled }: ReviewItemRowProps) {
  const [showDetail, setShowDetail] = useState(false)

  const statusColor: Record<SyncReviewItem['status'], string> = {
    pending: '#c5a253',
    in_progress: '#5ba8d4',
    resolved: '#53be84',
    failed: '#ff9f9b',
    unresolved: '#8fa5b9',
  }

  return (
    <div
      style={{
        padding: '18px',
        border: '1px solid rgba(255,255,255,.1)',
        background: 'rgba(255,255,255,.03)',
        marginBottom: '10px',
      }}
      data-testid={`review-item-${item.id}`}
      aria-label={`${kindLabel(item.kind)} review item`}
    >
      {/* Status line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <span
          className="eyebrow"
          style={{ color: statusColor[item.status] }}
          aria-label={`Status: ${item.status}`}
        >
          {item.status.toUpperCase().replace('_', ' ')}
        </span>
        <span className="eyebrow">{kindLabel(item.kind)}</span>
      </div>

      {/* Object info */}
      <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#d7dee6', overflowWrap: 'anywhere' }}>
        {item.objectId}
      </p>
      <p style={{ margin: '0 0 12px', fontSize: '11px', color: '#8fa5b9', overflowWrap: 'anywhere' }}>
        Namespace: {item.namespace}
      </p>

      {/* Version info for conflict items */}
      {(item.localVersion || item.remoteVersion) && (
        <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
          {item.localVersion && (
            <span style={{ fontSize: '11px', color: '#8fa5b9' }}>
              Local: <strong style={{ color: '#d7dee6' }}>v{item.localVersion}</strong>
            </span>
          )}
          {item.remoteVersion && (
            <span style={{ fontSize: '11px', color: '#8fa5b9' }}>
              Remote: <strong style={{ color: '#d7dee6' }}>v{item.remoteVersion}</strong>
            </span>
          )}
        </div>
      )}

      {/* Quarantine reason (no plaintext) */}
      {item.kind === 'quarantine_record' && item.quarantineRecord && (
        <div style={{ marginBottom: '12px', fontSize: '11px', color: '#8fa5b9' }}>
          Quarantine reason: <strong style={{ color: '#d7dee6' }}>{item.quarantineRecord.reason}</strong>
        </div>
      )}

      {/* Resolution info */}
      {item.status === 'resolved' && item.resolvedAction && (
        <p style={{ margin: '0 0 12px', fontSize: '11px', color: '#53be84' }}>
          Resolved: {actionLabel(item.resolvedAction)}
        </p>
      )}
      {item.status === 'failed' && item.failureReason && (
        <p style={{ margin: '0 0 12px', fontSize: '11px', color: '#ff9f9b' }}>
          Failed — please retry or contact support
        </p>
      )}

      {/* Detail toggle */}
      <button
        className="secondaryButton"
        style={{ fontSize: '11px', padding: '6px 12px', marginBottom: '12px' }}
        onClick={() => setShowDetail(d => !d)}
        aria-expanded={showDetail}
        aria-controls={`detail-${item.id}`}
      >
        {showDetail ? 'Hide detail' : 'Show detail'}
      </button>

      {showDetail && (
        <div
          id={`detail-${item.id}`}
          style={{
            padding: '12px',
            background: 'rgba(0,0,0,.18)',
            border: '1px solid rgba(255,255,255,.08)',
            marginBottom: '12px',
            fontSize: '11px',
            color: '#8fa5b9',
            lineHeight: 1.6,
          }}
        >
          <p style={{ margin: '0 0 4px' }}>{kindDescription(item.kind)}</p>
          {item.remoteDescriptor && (
            <p style={{ margin: '4px 0 0' }}>
              Signer device: <span style={{ color: '#d7dee6' }}>{item.remoteDescriptor.signerDeviceId}</span>
            </p>
          )}
          <p style={{ margin: '4px 0 0' }}>Created: {item.createdAt}</p>
        </div>
      )}

      {/* Action buttons — only for pending items */}
      {item.status === 'pending' && (
        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
          role="group"
          aria-label={`Actions for ${kindLabel(item.kind)}`}
        >
          {availableActions(item.kind).map(action => (
            <button
              key={action}
              className={action === 'discard_quarantine' ? 'dangerButton' : 'secondaryButton'}
              style={{ fontSize: '11px', padding: '8px 12px', letterSpacing: '.08em' }}
              onClick={() => onAction(item.id, action)}
              disabled={disabled}
              aria-label={actionLabel(action)}
            >
              {actionLabel(action)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Panel ───────────────────────────────────────────────────────────────

export type SyncReviewPanelState = 'loading' | 'idle' | 'error' | 'recovering'

export interface SyncReviewPanelProps {
  items: SyncReviewItem[]
  panelState?: SyncReviewPanelState
  errorMessage?: string
  onDecision: (itemId: string, action: OperatorDecisionAction) => Promise<void>
  onClose?: () => void
}

/**
 * Operator Sync Review Panel
 *
 * Surfaces divergent histories, tombstone conflicts, and quarantine records
 * for operator decision. All state-changing actions require explicit confirmation.
 * Technical evidence is hidden behind an optional detail view.
 * No key material, credentials, or plaintext is exposed.
 */
export default function SyncReviewPanel({
  items,
  panelState = 'idle',
  errorMessage,
  onDecision,
  onClose,
}: SyncReviewPanelProps) {
  const [confirmState, setConfirmState] = useState<{
    itemId: string
    action: OperatorDecisionAction
    item: SyncReviewItem
  } | null>(null)
  const [processing, setProcessing] = useState(false)

  const handleAction = useCallback(
    (itemId: string, action: OperatorDecisionAction) => {
      const item = items.find(i => i.id === itemId)
      if (!item) return

      if (CONFIRMATION_REQUIRED_ACTIONS.has(action)) {
        setConfirmState({ itemId, action, item })
      } else {
        void onDecision(itemId, action)
      }
    },
    [items, onDecision],
  )

  const handleConfirm = useCallback(async () => {
    if (!confirmState) return
    setConfirmState(null)
    setProcessing(true)
    try {
      await onDecision(confirmState.itemId, confirmState.action)
    } finally {
      setProcessing(false)
    }
  }, [confirmState, onDecision])

  const handleCancel = useCallback(() => {
    setConfirmState(null)
  }, [])

  const pending = items.filter(i => i.status === 'pending')
  const resolved = items.filter(i => i.status === 'resolved')
  const failed = items.filter(i => i.status === 'failed')
  const unresolved = items.filter(i => i.status === 'unresolved')

  return (
    <div
      className="recoveryConsole"
      role="region"
      aria-label="Sync Review"
      data-testid="sync-review-panel"
    >
      <div className="recoveryHeader">
        <div>
          <p className="eyebrow">Phase 4 Build 023</p>
          <h2>Sync Review</h2>
          <p>Review items requiring operator confirmation before synchronization proceeds.</p>
        </div>
        {onClose && (
          <button
            className="iconButton"
            onClick={onClose}
            aria-label="Close sync review"
          >
            ✕
          </button>
        )}
      </div>

      {/* State: Loading */}
      {panelState === 'loading' && (
        <div
          className="recoveryStatus"
          role="status"
          aria-live="polite"
          data-testid="sync-review-loading"
        >
          <p>Loading review items…</p>
        </div>
      )}

      {/* State: Error */}
      {panelState === 'error' && (
        <div
          className="recoveryStatus error"
          role="alert"
          data-testid="sync-review-error"
        >
          <div>
            <strong>Review unavailable</strong>
            <p>{errorMessage ?? 'An error occurred. No sensitive details are available.'}</p>
          </div>
        </div>
      )}

      {/* State: Recovering */}
      {panelState === 'recovering' && (
        <div
          className="recoveryStatus"
          role="status"
          aria-live="polite"
          data-testid="sync-review-recovering"
        >
          <p>Restoring prior confirmed state…</p>
        </div>
      )}

      {/* State: Idle — render items */}
      {panelState === 'idle' && (
        <>
          {/* Empty state */}
          {items.length === 0 && (
            <div
              className="emptyState"
              data-testid="sync-review-empty"
              style={{ padding: '32px 0', textAlign: 'center' }}
            >
              <p>No items require review.</p>
              <p style={{ fontSize: '12px', marginTop: '8px' }}>
                Synchronization is operating normally. All objects are current.
              </p>
            </div>
          )}

          {/* Pending items */}
          {pending.length > 0 && (
            <section aria-label="Pending review items" style={{ marginTop: '22px' }}>
              <p className="eyebrow" style={{ marginBottom: '12px' }}>
                {pending.length} item{pending.length !== 1 ? 's' : ''} requiring review
              </p>
              {pending.map(item => (
                <ReviewItemRow
                  key={item.id}
                  item={item}
                  onAction={handleAction}
                  disabled={processing}
                />
              ))}
            </section>
          )}

          {/* Failed items */}
          {failed.length > 0 && (
            <section aria-label="Failed review items" style={{ marginTop: '22px' }}>
              <p className="eyebrow" style={{ marginBottom: '12px', color: '#ff9f9b' }}>
                {failed.length} failed item{failed.length !== 1 ? 's' : ''}
              </p>
              {failed.map(item => (
                <ReviewItemRow
                  key={item.id}
                  item={item}
                  onAction={handleAction}
                  disabled={processing}
                />
              ))}
            </section>
          )}

          {/* Unresolved items */}
          {unresolved.length > 0 && (
            <section aria-label="Unresolved review items" style={{ marginTop: '22px' }}>
              <p className="eyebrow" style={{ marginBottom: '12px', color: '#8fa5b9' }}>
                {unresolved.length} unresolved item{unresolved.length !== 1 ? 's' : ''}
              </p>
              {unresolved.map(item => (
                <ReviewItemRow
                  key={item.id}
                  item={item}
                  onAction={handleAction}
                  disabled={processing}
                />
              ))}
            </section>
          )}

          {/* Resolved items */}
          {resolved.length > 0 && (
            <section aria-label="Resolved review items" style={{ marginTop: '22px' }}>
              <p className="eyebrow" style={{ marginBottom: '12px', color: '#53be84' }}>
                {resolved.length} resolved item{resolved.length !== 1 ? 's' : ''}
              </p>
              {resolved.map(item => (
                <ReviewItemRow
                  key={item.id}
                  item={item}
                  onAction={handleAction}
                  disabled={processing}
                />
              ))}
            </section>
          )}
        </>
      )}

      {/* Confirmation dialog — rendered on top of everything */}
      {confirmState && (
        <ConfirmDialog
          action={confirmState.action}
          item={confirmState.item}
          onConfirm={() => void handleConfirm()}
          onCancel={handleCancel}
        />
      )}
    </div>
  )
}
