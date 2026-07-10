import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  Focus,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles
} from 'lucide-react'
import {
  Commitment,
  createId,
  Decision,
  exportPersonalData,
  loadPersonalData,
  PersonalData,
  resetPersonalData,
  savePersonalData,
  TimelineEntry
} from './localData'

type Mode = 'arrival' | 'brief' | 'focus' | 'reflection'

export default function App() {
  const [mode, setMode] = useState<Mode>('arrival')
  const [data, setData] = useState<PersonalData>(() => loadPersonalData())
  const [showDataPanel, setShowDataPanel] = useState(false)
  const date = useMemo(
    () => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()),
    []
  )

  useEffect(() => {
    savePersonalData(data)
  }, [data])

  const openCommitments = data.commitments.filter((item) => item.status === 'open').length
  const openDecisions = data.decisions.filter((item) => item.status === 'open').length
  const activePriorities = data.priorities.filter((item) => !item.completed).length

  const stateItems = [
    ['Executive State', mode === 'focus' ? 'Focused' : 'Aware'],
    ['Attention', mode === 'focus' ? 'Protected' : 'Available'],
    ['Priorities', `${activePriorities} Active`],
    ['Commitments', openCommitments ? `${openCommitments} Open` : 'On Track']
  ]

  function addTimeline(entry: Omit<TimelineEntry, 'id' | 'createdAt'>) {
    setData((current) => ({
      ...current,
      timeline: [
        { ...entry, id: createId('timeline'), createdAt: new Date().toISOString() },
        ...current.timeline
      ]
    }))
  }

  function addCommitment(title: string, due: string) {
    const item: Commitment = {
      id: createId('commitment'),
      title,
      due,
      status: 'open',
      createdAt: new Date().toISOString()
    }
    setData((current) => ({ ...current, commitments: [item, ...current.commitments] }))
    addTimeline({ type: 'commitment', title: 'Commitment captured', detail: title })
  }

  function addDecision(title: string, context: string) {
    const item: Decision = {
      id: createId('decision'),
      title,
      context,
      status: 'open',
      createdAt: new Date().toISOString()
    }
    setData((current) => ({ ...current, decisions: [item, ...current.decisions] }))
    addTimeline({ type: 'decision', title: 'Decision opened', detail: title })
  }

  function toggleCommitment(id: string) {
    setData((current) => ({
      ...current,
      commitments: current.commitments.map((item) =>
        item.id === id ? { ...item, status: item.status === 'open' ? 'complete' : 'open' } : item
      )
    }))
  }

  function toggleDecision(id: string) {
    setData((current) => ({
      ...current,
      decisions: current.decisions.map((item) =>
        item.id === id ? { ...item, status: item.status === 'open' ? 'decided' : 'open' } : item
      )
    }))
  }

  function completePriority(id: string) {
    setData((current) => ({
      ...current,
      priorities: current.priorities.map((item) => (item.id === id ? { ...item, completed: true } : item))
    }))
  }

  function saveReflection(accomplished: string, remember: string, tomorrow: string) {
    const createdAt = new Date().toISOString()
    setData((current) => ({
      ...current,
      reflections: [
        { id: createId('reflection'), accomplished, remember, tomorrow, createdAt },
        ...current.reflections
      ],
      timeline: [
        {
          id: createId('timeline'),
          type: 'reflection',
          title: 'Executive reflection completed',
          detail: accomplished || 'Session reviewed.',
          createdAt
        },
        ...current.timeline
      ]
    }))
    setMode('arrival')
  }

  function handleReset() {
    const confirmed = window.confirm('Reset all local iMOS personal data on this device? This cannot be undone unless you exported a backup.')
    if (!confirmed) return
    setData(resetPersonalData())
    setMode('arrival')
    setShowDataPanel(false)
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">INDIVIDUAL MISSION OPERATING SYSTEM</p>
          <h1>iMOS</h1>
        </div>
        <div className="topActions">
          <button className="utilityButton" onClick={() => setShowDataPanel((value) => !value)}>
            <Database size={16} /> LOCAL DATA
          </button>
          <div className="secure"><ShieldCheck size={17} /> PRIVATE MODE</div>
        </div>
      </header>

      {showDataPanel && (
        <section className="dataPanel panel">
          <div>
            <p className="eyebrow">BUILD 002 DATA CONTROL</p>
            <h3>Stored only in this browser.</h3>
            <p>Priorities, commitments, decisions, timeline entries, and reflections persist on this device. Nothing is sent to GitHub or ARGUS.</p>
          </div>
          <div className="dataActions">
            <button className="secondaryButton" onClick={() => exportPersonalData(data)}><Download size={16} /> EXPORT</button>
            <button className="dangerButton" onClick={handleReset}><RotateCcw size={16} /> RESET</button>
          </div>
        </section>
      )}

      <section className="statebar">
        {stateItems.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </section>

      <section className="workspace">
        <div className="primary panel">
          {mode === 'arrival' && (
            <Arrival
              date={date}
              primary={data.priorities.find((item) => !item.completed)}
              onBegin={() => setMode('brief')}
            />
          )}
          {mode === 'brief' && (
            <Brief
              data={data}
              onAddCommitment={addCommitment}
              onAddDecision={addDecision}
              onToggleCommitment={toggleCommitment}
              onToggleDecision={toggleDecision}
              onBegin={() => setMode('focus')}
            />
          )}
          {mode === 'focus' && (
            <FocusView
              priority={data.priorities.find((item) => !item.completed)}
              onCompletePriority={completePriority}
              onComplete={() => setMode('reflection')}
            />
          )}
          {mode === 'reflection' && <Reflection onSave={saveReflection} />}
        </div>

        <aside className="timeline panel">
          <div className="panelTitle"><Clock3 size={17} /><span>EXECUTIVE TIMELINE</span></div>
          {data.timeline.length === 0 && <p className="emptyState">No meaningful events captured yet.</p>}
          {data.timeline.slice(0, 8).map((item) => (
            <TimelineItem key={item.id} entry={item} />
          ))}
        </aside>
      </section>
    </main>
  )
}

function Arrival({
  date,
  primary,
  onBegin
}: {
  date: string
  primary?: PersonalData['priorities'][number]
  onBegin: () => void
}) {
  return <div className="hero">
    <p className="eyebrow">{date.toUpperCase()}</p>
    <h2>Good morning, Rob.</h2>
    <p className="lead">Your personal operating context is available on this device. Nothing critical requires escalation.</p>
    <div className="rosie"><Sparkles size={18} /><div><strong>ROSIE</strong><p>{primary ? `I recommend beginning with ${primary.title}. ${primary.why}` : 'Your current priorities are complete. We can review commitments and decisions before choosing the next mission.'}</p></div></div>
    <button onClick={onBegin}>BEGIN <ArrowRight size={17} /></button>
  </div>
}

function Brief({
  data,
  onAddCommitment,
  onAddDecision,
  onToggleCommitment,
  onToggleDecision,
  onBegin
}: {
  data: PersonalData
  onAddCommitment: (title: string, due: string) => void
  onAddDecision: (title: string, context: string) => void
  onToggleCommitment: (id: string) => void
  onToggleDecision: (id: string) => void
  onBegin: () => void
}) {
  const [capture, setCapture] = useState<'commitment' | 'decision' | null>(null)
  const primary = data.priorities.find((item) => !item.completed)
  const commitments = data.commitments.filter((item) => item.status === 'open').slice(0, 3)
  const decisions = data.decisions.filter((item) => item.status === 'open').slice(0, 3)

  return <div>
    <p className="eyebrow">MORNING EXECUTIVE BRIEF</p>
    <h2>Where we stand.</h2>
    <div className="cards">
      <BriefCard label="PRIMARY MISSION" value={primary?.title ?? 'Define the next mission'} />
      <BriefCard label="COMMITMENTS" value={commitments.length ? `${commitments.length} require attention` : 'No critical risk'} />
      <BriefCard label="DECISIONS" value={decisions.length ? `${decisions.length} awaiting judgment` : 'No open decisions'} />
      <BriefCard label="LOCAL MEMORY" value={`${data.timeline.length} timeline entries`} />
    </div>

    <div className="recordGrid">
      <RecordList title="OPEN COMMITMENTS" items={commitments.map((item) => ({ id: item.id, title: item.title, meta: item.due || 'No due date' }))} onToggle={onToggleCommitment} />
      <RecordList title="OPEN DECISIONS" items={decisions.map((item) => ({ id: item.id, title: item.title, meta: item.context || 'No context added' }))} onToggle={onToggleDecision} />
    </div>

    <div className="captureActions">
      <button className="secondaryButton" onClick={() => setCapture('commitment')}><Plus size={16} /> COMMITMENT</button>
      <button className="secondaryButton" onClick={() => setCapture('decision')}><Plus size={16} /> DECISION</button>
    </div>

    {capture === 'commitment' && <CommitmentForm onSave={(title, due) => { onAddCommitment(title, due); setCapture(null) }} onCancel={() => setCapture(null)} />}
    {capture === 'decision' && <DecisionForm onSave={(title, context) => { onAddDecision(title, context); setCapture(null) }} onCancel={() => setCapture(null)} />}

    <div className="recommendation"><strong>Rosie's recommendation</strong><p>Begin with one active priority. Capture any new commitment or decision before leaving this brief.</p></div>
    <button onClick={onBegin}>ENTER FOCUS MODE <Focus size={17} /></button>
  </div>
}

function FocusView({
  priority,
  onCompletePriority,
  onComplete
}: {
  priority?: PersonalData['priorities'][number]
  onCompletePriority: (id: string) => void
  onComplete: () => void
}) {
  return <div>
    <p className="eyebrow">FOCUS MODE</p>
    <h2>{priority?.title ?? 'Define the next mission.'}</h2>
    <p className="lead">One outcome. No unrelated information.</p>
    <div className="focusGrid">
      <BriefCard label="OUTCOME" value={priority?.title ?? 'Create one clear outcome'} />
      <BriefCard label="WHY IT MATTERS" value={priority?.why ?? 'Direction must be established before execution.'} />
      <BriefCard label="DATA BOUNDARY" value="Local device only" />
      <BriefCard label="ARGUS" value="No connection" />
    </div>
    <div className="captureActions">
      {priority && <button className="secondaryButton" onClick={() => onCompletePriority(priority.id)}><CheckCircle2 size={17} /> MARK PRIORITY COMPLETE</button>}
      <button onClick={onComplete}>COMPLETE SESSION <ArrowRight size={17} /></button>
    </div>
  </div>
}

function Reflection({ onSave }: { onSave: (accomplished: string, remember: string, tomorrow: string) => void }) {
  const [accomplished, setAccomplished] = useState('')
  const [remember, setRemember] = useState('')
  const [tomorrow, setTomorrow] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    onSave(accomplished.trim(), remember.trim(), tomorrow.trim())
  }

  return <div>
    <p className="eyebrow">EXECUTIVE REFLECTION</p>
    <h2>Close the loop.</h2>
    <p className="lead">Capture only what creates future value.</p>
    <form className="reflectionForm" onSubmit={submit}>
      <label>WHAT DID WE ACCOMPLISH?<textarea value={accomplished} onChange={(event) => setAccomplished(event.target.value)} /></label>
      <label>WHAT SHOULD ROSIE REMEMBER?<textarea value={remember} onChange={(event) => setRemember(event.target.value)} /></label>
      <label>WHAT SHOULD HAPPEN TOMORROW?<textarea value={tomorrow} onChange={(event) => setTomorrow(event.target.value)} /></label>
      <button type="submit">SAVE REFLECTION <CheckCircle2 size={17} /></button>
    </form>
  </div>
}

function CommitmentForm({ onSave, onCancel }: { onSave: (title: string, due: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    onSave(title.trim(), due)
  }

  return <form className="captureForm" onSubmit={submit}>
    <label>COMMITMENT<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What did you promise?" /></label>
    <label>DUE<input type="date" value={due} onChange={(event) => setDue(event.target.value)} /></label>
    <div className="captureActions"><button type="submit">SAVE</button><button type="button" className="secondaryButton" onClick={onCancel}>CANCEL</button></div>
  </form>
}

function DecisionForm({ onSave, onCancel }: { onSave: (title: string, context: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [context, setContext] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    onSave(title.trim(), context.trim())
  }

  return <form className="captureForm" onSubmit={submit}>
    <label>DECISION<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What requires judgment?" /></label>
    <label>CONTEXT<textarea value={context} onChange={(event) => setContext(event.target.value)} placeholder="Why does it matter?" /></label>
    <div className="captureActions"><button type="submit">SAVE</button><button type="button" className="secondaryButton" onClick={onCancel}>CANCEL</button></div>
  </form>
}

function RecordList({
  title,
  items,
  onToggle
}: {
  title: string
  items: { id: string; title: string; meta: string }[]
  onToggle: (id: string) => void
}) {
  return <section className="recordList">
    <p className="eyebrow">{title}</p>
    {items.length === 0 && <p className="emptyState">Nothing requires attention.</p>}
    {items.map((item) => (
      <button key={item.id} className="recordRow" onClick={() => onToggle(item.id)}>
        <span><strong>{item.title}</strong><small>{item.meta}</small></span>
        <CheckCircle2 size={17} />
      </button>
    ))}
  </section>
}

function BriefCard({ label, value }: { label: string; value: string }) {
  return <div className="briefCard"><span>{label}</span><strong>{value}</strong></div>
}

function TimelineItem({ entry }: { entry: TimelineEntry }) {
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(entry.createdAt))
  return <div className="timelineItem"><span className="time">{time}</span><div><strong>{entry.title}</strong><p>{entry.detail}</p></div></div>
}
