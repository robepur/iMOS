import { useState } from 'react'
import { X } from 'lucide-react'
import { inPeriod, PersonalData, ReviewPeriod, getRosieMemory } from '../../localData'
import ReflectionHistory from '../reflection/ReflectionHistory'
import CommitmentHistory from './CommitmentHistory'
import DecisionHistory from './DecisionHistory'
import TimelineExplorer from '../timeline/TimelineExplorer'
import OperatorStatistics from './OperatorStatistics'

type ReviewTab = 'dashboard' | 'timeline' | 'commitments' | 'decisions' | 'reflections' | 'statistics'

const PERIODS: { value: ReviewPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' },
  { value: 'quarter', label: 'Last 90 Days' },
  { value: 'all', label: 'All Time' },
]

const TABS: { value: ReviewTab; label: string }[] = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'commitments', label: 'Commitments' },
  { value: 'decisions', label: 'Decisions' },
  { value: 'reflections', label: 'Reflections' },
  { value: 'statistics', label: 'Statistics' },
]

function DashboardView({ data, period }: { data: PersonalData; period: ReviewPeriod }) {
  const priorities = data.priorities.filter((p) => inPeriod(p.createdAt, period))
  const active = priorities.filter((p) => !p.completed).length
  const completed = priorities.filter((p) => p.completed).length
  const critical = priorities.filter((p) => !p.completed && p.level === 'critical').length
  const today = new Date().toDateString()
  const overdue = priorities.filter((p) => !p.completed && p.due && new Date(p.due) < new Date(today)).length

  const commitments = data.commitments.filter((c) => inPeriod(c.createdAt, period))
  const openCommitments = commitments.filter((c) => c.status === 'open').length
  const completedCommitments = commitments.filter((c) => c.status === 'complete').length
  const overdueCommitments = commitments.filter((c) => c.status === 'open' && c.due && c.due < today).length

  const decisions = data.decisions.filter((d) => inPeriod(d.createdAt, period))
  const openDecisions = decisions.filter((d) => d.status === 'open').length
  const decidedDecisions = decisions.filter((d) => d.status === 'decided').length

  const reflections = data.reflections.filter((r) => inPeriod(r.createdAt, period))
  const lastReflection = reflections[0]

  const memory = getRosieMemory(data, period)

  const execSummary = [
    completedCommitments > 0 ? `Completed ${completedCommitments} commitment${completedCommitments !== 1 ? 's' : ''}` : null,
    decidedDecisions > 0 ? `Resolved ${decidedDecisions} decision${decidedDecisions !== 1 ? 's' : ''}` : null,
    commitments.length > 0 ? `Captured ${commitments.length} commitment${commitments.length !== 1 ? 's' : ''}` : null,
    reflections.length > 0 ? `Completed ${reflections.length} reflection${reflections.length !== 1 ? 's' : ''}` : null,
    overdue > 0 ? `Outstanding ${overdue} critical priorit${overdue !== 1 ? 'ies' : 'y'}` : null,
  ].filter(Boolean)

  return (
    <div className="dashboardView">
      <div className="dashboardGrid">
        <section className="dashSection" aria-label="Priority Summary">
          <p className="eyebrow">PRIORITY SUMMARY</p>
          <div className="dashStats">
            <div><span>Active</span><strong>{active}</strong></div>
            <div><span>Completed</span><strong>{completed}</strong></div>
            <div><span>Critical</span><strong>{critical}</strong></div>
            <div><span>Overdue</span><strong>{overdue}</strong></div>
          </div>
        </section>

        <section className="dashSection" aria-label="Commitments">
          <p className="eyebrow">COMMITMENTS</p>
          <div className="dashStats">
            <div><span>Open</span><strong>{openCommitments}</strong></div>
            <div><span>Completed</span><strong>{completedCommitments}</strong></div>
            <div><span>Overdue</span><strong>{overdueCommitments}</strong></div>
          </div>
        </section>

        <section className="dashSection" aria-label="Decisions">
          <p className="eyebrow">DECISIONS</p>
          <div className="dashStats">
            <div><span>Open</span><strong>{openDecisions}</strong></div>
            <div><span>Decided</span><strong>{decidedDecisions}</strong></div>
          </div>
        </section>

        <section className="dashSection" aria-label="Reflections">
          <p className="eyebrow">REFLECTIONS</p>
          <div className="dashStats">
            <div><span>Count</span><strong>{reflections.length}</strong></div>
          </div>
          {lastReflection && <p className="dashRecent">Most recent: {new Date(lastReflection.createdAt).toLocaleDateString()}</p>}
        </section>
      </div>

      <section className="dashSection rosieSection" aria-label="Rosie Executive Summary">
        <p className="eyebrow">ROSIE EXECUTIVE SUMMARY</p>
        {execSummary.length === 0
          ? <p className="emptyState">No activity recorded for this period.</p>
          : <ul className="execSummaryList">{execSummary.map((item, i) => <li key={i}>{item}</li>)}</ul>
        }
      </section>

      <section className="dashSection" aria-label="Rosie Memory">
        <p className="eyebrow">ROSIE MEMORY</p>
        {memory.length === 0
          ? <p className="emptyState">No memory items for this period.</p>
          : memory.map((m) => (
              <div key={m.id} className="memoryItem">
                <p>{m.text}</p>
                <span className="memoryDate">{new Date(m.createdAt).toLocaleDateString()}</span>
              </div>
            ))
        }
      </section>
    </div>
  )
}

export default function ReviewCenter({ data, onDeleteReflection, onClose }: {
  data: PersonalData
  onDeleteReflection: (id: string) => void
  onClose: () => void
}) {
  const [period, setPeriod] = useState<ReviewPeriod>('week')
  const [tab, setTab] = useState<ReviewTab>('dashboard')

  const filteredTimeline = data.timeline.filter((e) => inPeriod(e.createdAt, period))
  const filteredCommitments = data.commitments.filter((c) => inPeriod(c.createdAt, period))
  const filteredDecisions = data.decisions.filter((d) => inPeriod(d.createdAt, period))
  const filteredReflections = data.reflections.filter((r) => inPeriod(r.createdAt, period))

  return (
    <section className="reviewCenter panel" aria-label="Operator Review Center">
      <div className="reviewHeader">
        <div>
          <p className="eyebrow">OPERATOR REVIEW CENTER</p>
          <h2>Operational History</h2>
        </div>
        <button className="iconButton" onClick={onClose} aria-label="Close review center"><X size={18} /></button>
      </div>

      <div className="periodSelector" role="group" aria-label="Review period">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            className={period === p.value ? 'periodBtn active' : 'periodBtn'}
            onClick={() => setPeriod(p.value)}
            aria-pressed={period === p.value}
          >
            {p.label}
          </button>
        ))}
      </div>

      <nav className="reviewTabs" aria-label="Review sections">
        {TABS.map((t) => (
          <button
            key={t.value}
            className={tab === t.value ? 'reviewTab active' : 'reviewTab'}
            onClick={() => setTab(t.value)}
            aria-current={tab === t.value ? 'page' : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="reviewContent">
        {tab === 'dashboard' && <DashboardView data={data} period={period} />}
        {tab === 'timeline' && <TimelineExplorer timeline={filteredTimeline} />}
        {tab === 'commitments' && <CommitmentHistory commitments={filteredCommitments} />}
        {tab === 'decisions' && <DecisionHistory decisions={filteredDecisions} />}
        {tab === 'reflections' && (
          <ReflectionHistory
            reflections={filteredReflections}
            onDelete={onDeleteReflection}
          />
        )}
        {tab === 'statistics' && <OperatorStatistics data={data} />}
      </div>
    </section>
  )
}


