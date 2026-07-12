import { AlertTriangle, Download, Pause, Play, Trash2 } from 'lucide-react'
import type {
  PilotAuditEvent,
  PilotCheckIn,
  PilotConcern,
  PilotDayRecord,
  PilotSession,
} from '../../types/operatorPilot'
import { OperatorPilotService } from '../../services/OperatorPilotService'
import { PilotMeasurementService } from '../../services/PilotMeasurementService'
import { PilotConcernEvaluator } from '../../services/PilotConcernEvaluator'
import { PilotVerdictService } from '../../services/PilotVerdictService'
import { PilotExportService } from '../../services/PilotExportService'
import PilotActivation from './PilotActivation'
import PilotDailyCheckIn from './PilotDailyCheckIn'

type Props = {
  session?: PilotSession
  dayRecords: PilotDayRecord[]
  checkIns: PilotCheckIn[]
  concerns: PilotConcern[]
  audit: PilotAuditEvent[]
  backupReady: boolean
  onSession: (session: PilotSession | undefined) => void
  onDayRecords: (records: PilotDayRecord[]) => void
  onCheckIns: (checkIns: PilotCheckIn[]) => void
  onConcerns: (concerns: PilotConcern[]) => void
  onAudit: (audit: PilotAuditEvent[]) => void
  onDeleteMeasurements: () => void
  onClose: () => void
}

export default function OperatorPilotDashboard({
  session,
  dayRecords,
  checkIns,
  concerns,
  audit,
  backupReady,
  onSession,
  onDayRecords,
  onCheckIns,
  onConcerns,
  onAudit,
  onDeleteMeasurements,
  onClose,
}: Props) {
  const scopedConcerns = session ? concerns.filter((c) => c.sessionId === session.id) : []
  const summary = session
    ? PilotMeasurementService.summarize(session, dayRecords, checkIns, scopedConcerns.filter((c) => !c.resolvedAt).length)
    : undefined

  const unresolvedConcernCount = scopedConcerns.filter((c) => !c.resolvedAt).length
  const verdict = summary ? PilotVerdictService.resolve(summary, scopedConcerns) : undefined

  function appendAudit(action: PilotAuditEvent['action'], detail: string, sessionId: string) {
    onAudit([...audit, OperatorPilotService.createAudit(sessionId, action, detail)])
  }

  function createSession(durationDays: number, acknowledgedPurpose: boolean, acknowledgedLocalMeasurement: boolean) {
    let next = OperatorPilotService.createReadySession(durationDays)
    next = { ...next, acknowledgedPurpose, acknowledgedLocalMeasurement, lastUpdatedAt: new Date().toISOString() }
    onSession(next)
    appendAudit('pilot_created', `Pilot session created with duration ${next.selectedDurationDays} days.`, next.id)
  }

  function startOrResume() {
    if (!session) return
    const next = session.status === 'paused' ? OperatorPilotService.resumePilot(session) : OperatorPilotService.startPilot(session)
    onSession(next)
    appendAudit(session.status === 'paused' ? 'pilot_resumed' : 'pilot_started', 'Pilot active.', next.id)
  }

  function pausePilot() {
    if (!session) return
    const next = OperatorPilotService.pausePilot(session)
    onSession(next)
    appendAudit('pilot_paused', 'Pilot paused by operator.', next.id)
  }

  function extendPilot() {
    if (!session) return
    const next = OperatorPilotService.extendPilot(session, 7)
    onSession(next)
    appendAudit('pilot_extended', 'Pilot extended by 7 days.', next.id)
  }

  function endEarly() {
    if (!session) return
    const next = OperatorPilotService.endEarly(session)
    onSession(next)
    appendAudit('pilot_ended_early', 'Pilot ended early by operator.', next.id)
  }

  function completePilot() {
    if (!session) return
    const next = OperatorPilotService.complete(session)
    onSession(next)
    appendAudit('pilot_completed', 'Pilot marked completed.', next.id)
  }

  function saveCheckIn(checkIn: PilotCheckIn) {
    if (!session) return
    const { records, session: updatedSession } = OperatorPilotService.appendDayRecord(dayRecords, session, {
      date: checkIn.date,
      workflowCompleted: true,
      backupReady,
    })
    onDayRecords(records)
    onCheckIns([...checkIns, checkIn])

    const summaryNext = PilotMeasurementService.summarize(updatedSession, records, [...checkIns, checkIn], unresolvedConcernCount)
    const concernResult = PilotConcernEvaluator.evaluate(
      updatedSession,
      summaryNext,
      { securityConcern: false, suspectedDataLoss: false, recoveryFailure: false },
    )
    const mergedConcerns = [...concerns, ...concernResult.concerns]
    onConcerns(mergedConcerns)

    const nextSession = concernResult.shouldPause
      ? OperatorPilotService.pausePilot(updatedSession)
      : concernResult.shouldRequireReview
        ? OperatorPilotService.markReviewRequired(updatedSession)
        : updatedSession

    onSession(nextSession)
    appendAudit('pilot_checkin_saved', `Pilot check in saved for day ${checkIn.dayNumber}.`, nextSession.id)
    if (concernResult.concerns.length > 0) {
      appendAudit('pilot_concern_detected', `Detected ${concernResult.concerns.length} pilot concerns.`, nextSession.id)
    }
  }

  function exportPilot() {
    if (!session || !summary) return
    const payload = OperatorPilotService.buildExportPayload(session, dayRecords, checkIns, concerns, verdict?.verdict ?? 'pause_and_review')
    PilotExportService.exportLocalJson(`imos-pilot-report-${new Date().toISOString().slice(0, 10)}.json`, payload)
    appendAudit('pilot_exported', 'Pilot report exported locally.', session.id)
  }

  function deletePilot() {
    if (!session) return
    if (!window.confirm('Delete pilot and pilot measurements? Operational records are preserved.')) return
    onDeleteMeasurements()
    const deleted = OperatorPilotService.markDeleted(session)
    onSession(deleted)
    onConcerns([])
    onDayRecords([])
    onCheckIns([])
    appendAudit('pilot_deleted', 'Pilot and measurements deleted by operator.', deleted.id)
  }

  return (
    <div className="recoveryConsole" data-testid="operator-pilot-dashboard">
      <div className="recoveryHeader">
        <div>
          <p className="eyebrow">OPERATOR PILOT</p>
          <h2>Controlled pilot activation</h2>
        </div>
        <button className="iconButton" onClick={onClose} aria-label="Close pilot dashboard">✕</button>
      </div>

      <p className="emptyState">
        Pilot status is neutral and evidence based. No operator score, grade, or ranking is produced.
      </p>

      <PilotActivation session={session} onCreate={createSession} onStart={startOrResume} />

      {session && (
        <section className="panel" style={{ padding: '1rem', marginTop: '1rem' }} data-testid="pilot-status-panel">
          <p className="eyebrow">PILOT STATUS</p>
          <div className="recordGrid">
            <div><span>Status</span><strong style={{ textTransform: 'uppercase' }}>{session.status.replaceAll('_', ' ')}</strong></div>
            <div><span>Active days</span><strong>{session.dayCount}</strong></div>
            <div><span>Remaining days</span><strong>{session.remainingDays}</strong></div>
            <div><span>Backup ready</span><strong>{backupReady ? 'Yes' : 'No'}</strong></div>
          </div>
          <div className="captureActions" style={{ marginTop: '0.75rem' }}>
            {(session.status === 'active' || session.status === 'extended') && (
              <button className="secondaryButton" onClick={pausePilot} data-testid="pilot-pause-button"><Pause size={16} /> Pause pilot</button>
            )}
            {(session.status === 'paused' || session.status === 'ready') && (
              <button className="secondaryButton" onClick={startOrResume} data-testid="pilot-resume-button"><Play size={16} /> Resume pilot</button>
            )}
            {(session.status === 'active' || session.status === 'extended' || session.status === 'paused') && (
              <>
                <button className="secondaryButton" onClick={extendPilot} data-testid="pilot-extend-button">Extend 7 days</button>
                <button className="secondaryButton" onClick={endEarly} data-testid="pilot-end-early-button">End early</button>
                <button className="secondaryButton" onClick={completePilot} data-testid="pilot-complete-button">Complete pilot</button>
              </>
            )}
            <button className="secondaryButton" onClick={exportPilot} data-testid="pilot-export-button"><Download size={16} /> Export report</button>
            <button className="dangerButton" onClick={deletePilot} data-testid="pilot-delete-button"><Trash2 size={16} /> Delete pilot</button>
          </div>
        </section>
      )}

      {session && (session.status === 'active' || session.status === 'extended') && (
        <div style={{ marginTop: '1rem' }}>
          <PilotDailyCheckIn sessionId={session.id} dayNumber={session.dayCount + 1} onSave={saveCheckIn} />
        </div>
      )}

      {summary && (
        <section className="panel" style={{ padding: '1rem', marginTop: '1rem' }} data-testid="pilot-summary-panel">
          <p className="eyebrow">PILOT DASHBOARD</p>
          <div className="recordGrid">
            <div><span>Workflow completion trend points</span><strong>{summary.workflowCompletionTrend.length}</strong></div>
            <div><span>Briefing usefulness trend points</span><strong>{summary.briefingUsefulnessTrend.length}</strong></div>
            <div><span>Recommendation usefulness trend points</span><strong>{summary.recommendationUsefulnessTrend.length}</strong></div>
            <div><span>Cognitive effort trend points</span><strong>{summary.cognitiveEffortTrend.length}</strong></div>
            <div><span>Correction count</span><strong>{summary.correctionCount}</strong></div>
            <div><span>Missing context reports</span><strong>{summary.missingContextReports}</strong></div>
            <div><span>Trust concern reports</span><strong>{summary.trustConcernReports}</strong></div>
            <div><span>Accepted recommendations</span><strong>{summary.acceptedRecommendations}</strong></div>
            <div><span>Rejected recommendations</span><strong>{summary.rejectedRecommendations}</strong></div>
            <div><span>Unresolved concerns</span><strong>{summary.unresolvedConcernCount}</strong></div>
          </div>
          {verdict && (
            <div style={{ marginTop: '0.75rem' }}>
              <p className="eyebrow">Completion verdict</p>
              <strong style={{ textTransform: 'uppercase' }}>{verdict.verdict.replaceAll('_', ' ')}</strong>
              <p className="emptyState">Operator remains final decision maker.</p>
            </div>
          )}
        </section>
      )}

      {scopedConcerns.length > 0 && (
        <section className="recoveryStatus error" data-testid="pilot-concern-review">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>Pilot concern review</strong>
            <p>{scopedConcerns.filter((c) => !c.resolvedAt).length} unresolved concerns require review.</p>
          </div>
        </section>
      )}
    </div>
  )
}
