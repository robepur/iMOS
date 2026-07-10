import { useState } from 'react'
import { ArrowRight, CheckCircle2, Focus, ListChecks, Plus } from 'lucide-react'
import { PersonalData, Priority, TimelineEntry } from '../../localData'
import type { EveningSummaryData } from '../../services/RosieEngine'
import type { UnderstandingObservation } from '../../services/UnderstandingEngine'
import RosieMemory from '../rosie/RosieMemory'

export function Arrival({ date, data, primary, onBegin }: {
  date: string
  data: PersonalData
  primary?: Priority
  onBegin: () => void
}) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  return (
    <div className="hero">
      <p className="eyebrow">{date.toUpperCase()}</p>
      <h2>{greeting}, Rob.</h2>
      <p className="lead">Your private operating context is unlocked and ready.</p>
      <div className="rosie">
        <span className="rosieIcon">â˜…</span>
        <div>
          <strong>ROSIE</strong>
          <p>{primary ? `I recommend beginning with ${primary.title}. ${primary.why}` : 'No primary priority is set. Open the Priority Console to select your next mission.'}</p>
        </div>
      </div>
      <RosieMemory data={data} />
      <button onClick={onBegin}>BEGIN <ArrowRight size={17} /></button>
    </div>
  )
}

export function Brief({ data, overdueCount, criticalCount, secretCount, onAddCommitment, onAddDecision, onToggleCommitment, onToggleDecision, onOpenPriorities, onOpenReflectionHistory, onBegin, morningObservations = [] }: {
  data: PersonalData
  overdueCount: number
  criticalCount: number
  secretCount: number
  onAddCommitment: (title: string, due: string) => void
  onAddDecision: (title: string, context: string) => void
  onToggleCommitment: (id: string) => void
  onToggleDecision: (id: string) => void
  onOpenPriorities: () => void
  onOpenReflectionHistory: () => void
  onBegin: () => void
  morningObservations?: UnderstandingObservation[]
}) {
  const [capture, setCapture] = useState<'commitment' | 'decision' | null>(null)
  const openCommitments = data.commitments.filter((item) => item.status === 'open')
  const openDecisions = data.decisions.filter((item) => item.status === 'open')
  const activePriorities = data.priorities.filter((p) => !p.completed)
  const primary = activePriorities.find((p) => p.primary) ?? activePriorities[0]

  const observations = morningObservations

  return (
    <div>
      <p className="eyebrow">MORNING EXECUTIVE BRIEF</p>
      <h2>Where we stand.</h2>
      <div className="cards">
        <BriefCard label="PRIMARY MISSION" value={primary?.title ?? 'No primary priority set'} />
        <BriefCard label="CRITICAL" value={criticalCount ? `${criticalCount} critical active` : 'No critical priorities'} />
        <BriefCard label="OVERDUE" value={overdueCount ? `${overdueCount} overdue` : 'None overdue'} />
        <BriefCard label="SECRETS" value={`${secretCount} encrypted records`} />
      </div>
      <div className="briefMeta">
        <span>{openCommitments.length} open commitment{openCommitments.length !== 1 ? 's' : ''}</span>
        <span>{openDecisions.length} open decision{openDecisions.length !== 1 ? 's' : ''}</span>
        <span>{activePriorities.length} active priorit{activePriorities.length !== 1 ? 'ies' : 'y'}</span>
      </div>
      {observations.length > 0 && (
        <section className="dashSection" aria-label="Rosie understanding observations">
          <p className="eyebrow">UNDERSTANDING OBSERVATIONS</p>
          {observations.map((obs, index) => (
            <div key={index} className="memoryItem">
              <p><strong>{obs.noticed}</strong> — {obs.why}</p>
              <span className="memoryDate">{obs.evidence}</span>
              {obs.action && <p className="dashRecent">Action: {obs.action}</p>}
            </div>
          ))}
        </section>
      )}
      <div className="recordGrid">
        <RecordList title="OPEN COMMITMENTS" items={openCommitments.map((item) => ({ id: item.id, title: item.title, meta: item.due || 'No due date' }))} onToggle={onToggleCommitment} />
        <RecordList title="OPEN DECISIONS" items={openDecisions.map((item) => ({ id: item.id, title: item.title, meta: item.context || 'No context added' }))} onToggle={onToggleDecision} />
      </div>
      <div className="captureActions">
        <button className="secondaryButton" onClick={() => setCapture('commitment')}><Plus size={16} /> COMMITMENT</button>
        <button className="secondaryButton" onClick={() => setCapture('decision')}><Plus size={16} /> DECISION</button>
        <button className="secondaryButton" onClick={onOpenPriorities}><ListChecks size={16} /> PRIORITIES</button>
        <button className="secondaryButton" onClick={onOpenReflectionHistory}>REFLECTION HISTORY</button>
      </div>
      {capture === 'commitment' && <CommitmentForm onSave={(title, due) => { onAddCommitment(title, due); setCapture(null) }} onCancel={() => setCapture(null)} />}
      {capture === 'decision' && <DecisionForm onSave={(title, context) => { onAddDecision(title, context); setCapture(null) }} onCancel={() => setCapture(null)} />}
      <div className="recommendation"><strong>Rosie's recommendation</strong><p>Begin with the primary priority. All changes are re-encrypted automatically.</p></div>
      <button onClick={onBegin}>ENTER FOCUS MODE <Focus size={17} /></button>
    </div>
  )
}

export function FocusView({ primary, onCompletePriority, onComplete }: {
  primary?: Priority
  onCompletePriority: () => void
  onComplete: () => void
}) {
  return (
    <div>
      <p className="eyebrow">FOCUS MODE</p>
      <h2>{primary?.title ?? 'Define the next mission.'}</h2>
      <p className="lead">One outcome. No unrelated information.</p>
      <div className="focusGrid">
        <BriefCard label="OUTCOME" value={primary?.title ?? 'Create one clear outcome'} />
        <BriefCard label="WHY IT MATTERS" value={primary?.why ?? 'Direction must be established before execution.'} />
        <BriefCard label="DATA BOUNDARY" value="Encrypted local vault" />
        <BriefCard label="AUTOFILL" value="Disabled by design" />
      </div>
      <div className="captureActions">
        {primary && <button className="secondaryButton" onClick={onCompletePriority}><CheckCircle2 size={17} /> MARK PRIORITY COMPLETE</button>}
        <button onClick={onComplete}>COMPLETE SESSION <ArrowRight size={17} /></button>
      </div>
    </div>
  )
}

export function Reflection({
  onSave,
  eveningSummary,
  eveningObservations = [],
}: {
  onSave: (accomplished: string, remember: string, tomorrow: string) => void
  eveningSummary?: EveningSummaryData
  eveningObservations?: UnderstandingObservation[]
}) {
  const [accomplished, setAccomplished] = useState('')
  const [remember, setRemember] = useState('')
  const [tomorrow, setTomorrow] = useState('')
  return (
    <div>
      <p className="eyebrow">EXECUTIVE REFLECTION</p>
      <h2>Close the loop.</h2>
      {eveningSummary && (
        <section className="dashSection" aria-label="Evening operational summary">
          <p className="eyebrow">EVENING SUMMARY</p>
          <div className="briefMeta">
            <span>{eveningSummary.completedPriorities.length} priorities completed</span>
            <span>{eveningSummary.completedCommitments.length} commitments completed</span>
            <span>{eveningSummary.decisionsMade.length} decisions made</span>
          </div>
        </section>
      )}
      {eveningObservations.length > 0 && (
        <section className="dashSection" aria-label="Understanding evening observations">
          <p className="eyebrow">UNDERSTANDING OBSERVATIONS</p>
          {eveningObservations.map((obs, index) => (
            <div key={index} className="memoryItem">
              <p><strong>{obs.noticed}</strong> — {obs.why}</p>
              <span className="memoryDate">{obs.evidence}</span>
              {obs.action && <p className="dashRecent">Action: {obs.action}</p>}
            </div>
          ))}
        </section>
      )}
      <form className="reflectionForm" onSubmit={(e) => { e.preventDefault(); onSave(accomplished.trim(), remember.trim(), tomorrow.trim()) }}>
        <label>WHAT DID WE ACCOMPLISH?<textarea value={accomplished} onChange={(e) => setAccomplished(e.target.value)} /></label>
        <label>WHAT SHOULD ROSIE REMEMBER?<textarea value={remember} onChange={(e) => setRemember(e.target.value)} /></label>
        <label>WHAT SHOULD HAPPEN TOMORROW?<textarea value={tomorrow} onChange={(e) => setTomorrow(e.target.value)} /></label>
        <button type="submit">SAVE REFLECTION <CheckCircle2 size={17} /></button>
      </form>
    </div>
  )
}

export function CommitmentForm({ onSave, onCancel }: { onSave: (title: string, due: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  return (
    <form className="captureForm" onSubmit={(e) => { e.preventDefault(); if (title.trim()) onSave(title.trim(), due) }}>
      <label>COMMITMENT<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label>DUE<input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
      <div className="captureActions"><button>SAVE</button><button type="button" className="secondaryButton" onClick={onCancel}>CANCEL</button></div>
    </form>
  )
}

export function DecisionForm({ onSave, onCancel }: { onSave: (title: string, context: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [context, setContext] = useState('')
  return (
    <form className="captureForm" onSubmit={(e) => { e.preventDefault(); if (title.trim()) onSave(title.trim(), context.trim()) }}>
      <label>DECISION<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label>CONTEXT<textarea value={context} onChange={(e) => setContext(e.target.value)} /></label>
      <div className="captureActions"><button>SAVE</button><button type="button" className="secondaryButton" onClick={onCancel}>CANCEL</button></div>
    </form>
  )
}

export function RecordList({ title, items, onToggle }: { title: string; items: { id: string; title: string; meta: string }[]; onToggle: (id: string) => void }) {
  return (
    <section className="recordList">
      <p className="eyebrow">{title}</p>
      {items.length === 0 && <p className="emptyState">Nothing requires attention.</p>}
      {items.map((item) => (
        <button key={item.id} className="recordRow" onClick={() => onToggle(item.id)}>
          <span><strong>{item.title}</strong><small>{item.meta}</small></span>
          <CheckCircle2 size={17} />
        </button>
      ))}
    </section>
  )
}

export function BriefCard({ label, value }: { label: string; value: string }) {
  return <div className="briefCard"><span>{label}</span><strong>{value}</strong></div>
}

export function TimelineItem({ entry }: { entry: TimelineEntry }) {
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(entry.createdAt))
  return (
    <div className="timelineItem">
      <span className="time">{time}</span>
      <div><strong>{entry.title}</strong><p>{entry.detail}</p></div>
    </div>
  )
}
