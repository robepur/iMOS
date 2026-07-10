import { useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, Clock3, Focus, ShieldCheck, Sparkles } from 'lucide-react'

type Mode = 'arrival' | 'brief' | 'focus' | 'reflection'

const stateItems = [
  ['Executive State', 'Aware'],
  ['Attention', 'Protected'],
  ['Strategic Alignment', 'High'],
  ['Commitments', 'On Track']
]

export default function App() {
  const [mode, setMode] = useState<Mode>('arrival')
  const date = useMemo(() => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()), [])

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">INDIVIDUAL MISSION OPERATING SYSTEM</p>
          <h1>iMOS</h1>
        </div>
        <div className="secure"><ShieldCheck size={17} /> PRIVATE MODE</div>
      </header>

      <section className="statebar">
        {stateItems.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </section>

      <section className="workspace">
        <div className="primary panel">
          {mode === 'arrival' && <Arrival date={date} onBegin={() => setMode('brief')} />}
          {mode === 'brief' && <Brief onBegin={() => setMode('focus')} />}
          {mode === 'focus' && <FocusView onComplete={() => setMode('reflection')} />}
          {mode === 'reflection' && <Reflection onReset={() => setMode('arrival')} />}
        </div>

        <aside className="timeline panel">
          <div className="panelTitle"><Clock3 size={17} /><span>EXECUTIVE TIMELINE</span></div>
          <TimelineItem time="08:30" title="Morning brief" status="Prepared" />
          <TimelineItem time="09:00" title="Protected focus" status="Recommended" />
          <TimelineItem time="11:00" title="Business follow up" status="Pending" />
          <TimelineItem time="16:30" title="Reflection" status="Planned" />
        </aside>
      </section>
    </main>
  )
}

function Arrival({ date, onBegin }: { date: string; onBegin: () => void }) {
  return <div className="hero">
    <p className="eyebrow">{date.toUpperCase()}</p>
    <h2>Good morning, Rob.</h2>
    <p className="lead">Everything remains on course. One focused action will create the greatest leverage today.</p>
    <div className="rosie"><Sparkles size={18} /><div><strong>ROSIE</strong><p>I recommend protecting the next ninety minutes for iMOS Build 001. The goal is simple: establish a working operating environment you would return to tomorrow morning.</p></div></div>
    <button onClick={onBegin}>BEGIN <ArrowRight size={17} /></button>
  </div>
}

function Brief({ onBegin }: { onBegin: () => void }) {
  return <div>
    <p className="eyebrow">MORNING EXECUTIVE BRIEF</p>
    <h2>Where we stand.</h2>
    <div className="cards">
      <BriefCard label="PRIMARY MISSION" value="Establish iMOS Build 001" />
      <BriefCard label="COMMITMENTS" value="No critical risk" />
      <BriefCard label="DECISION" value="Protect the morning" />
      <BriefCard label="FOCUS WINDOW" value="90 minutes available" />
    </div>
    <div className="recommendation"><strong>Rosie's recommendation</strong><p>Begin now. Keep the first session limited to one outcome and one clear completion point.</p></div>
    <button onClick={onBegin}>ENTER FOCUS MODE <Focus size={17} /></button>
  </div>
}

function FocusView({ onComplete }: { onComplete: () => void }) {
  return <div>
    <p className="eyebrow">FOCUS MODE</p>
    <h2>Complete Build 001.</h2>
    <p className="lead">One outcome. No unrelated information.</p>
    <div className="focusGrid">
      <BriefCard label="OUTCOME" value="Runnable executive environment" />
      <BriefCard label="NEXT ACTION" value="Review the operating loop" />
      <BriefCard label="CONTEXT" value="ARGUS tactical styling" />
      <BriefCard label="BOUNDARY" value="No ARGUS connection" />
    </div>
    <button onClick={onComplete}>COMPLETE SESSION <CheckCircle2 size={17} /></button>
  </div>
}

function Reflection({ onReset }: { onReset: () => void }) {
  return <div>
    <p className="eyebrow">EXECUTIVE REFLECTION</p>
    <h2>Session complete.</h2>
    <p className="lead">The first operating loop is established. The next session should improve persistence and real personal context.</p>
    <div className="recommendation"><strong>What should happen next?</strong><p>Add local personal data storage for priorities, commitments, decisions, and reflections while preserving complete separation from ARGUS.</p></div>
    <button onClick={onReset}>RETURN TO ARRIVAL <ArrowRight size={17} /></button>
  </div>
}

function BriefCard({ label, value }: { label: string; value: string }) {
  return <div className="briefCard"><span>{label}</span><strong>{value}</strong></div>
}

function TimelineItem({ time, title, status }: { time: string; title: string; status: string }) {
  return <div className="timelineItem"><span className="time">{time}</span><div><strong>{title}</strong><p>{status}</p></div></div>
}
