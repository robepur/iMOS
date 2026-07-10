import type { MorningBriefData, EveningSummaryData } from '../../services/RosieEngine'
import { Sunrise, Sunset } from 'lucide-react'

type Props = {
  morning: MorningBriefData
  evening: EveningSummaryData
}

export default function DailyBrief({ morning, evening }: Props) {
  const now = new Date().getHours()
  const isEvening = now >= 17

  return (
    <section className="daily-brief" aria-label="Daily Brief">
      <div className="brief-header">
        {isEvening ? <Sunset size={20} /> : <Sunrise size={20} />}
        <span className="eyebrow">{isEvening ? 'EVENING SUMMARY' : 'MORNING BRIEF'}</span>
      </div>

      {!isEvening && (
        <>
          {morning.criticalWork.length > 0 && (
            <div className="brief-block brief-block--critical">
              <p className="eyebrow">CRITICAL ATTENTION</p>
              <ul>
                {morning.criticalWork.map((p) => <li key={p.id}>{p.title}</li>)}
              </ul>
            </div>
          )}
          {morning.overdueCommitments.length > 0 && (
            <div className="brief-block brief-block--overdue">
              <p className="eyebrow">OVERDUE COMMITMENTS</p>
              <ul>
                {morning.overdueCommitments.map((c) => (
                  <li key={c.id}>{c.title} <span className="brief-date">(due {c.due})</span></li>
                ))}
              </ul>
            </div>
          )}
          {morning.openDecisions.length > 0 && (
            <div className="brief-block">
              <p className="eyebrow">OPEN DECISIONS</p>
              <ul>
                {morning.openDecisions.map((d) => <li key={d.id}>{d.title}</li>)}
              </ul>
            </div>
          )}
          {morning.priorities.length > 0 && (
            <div className="brief-block">
              <p className="eyebrow">ACTIVE PRIORITIES</p>
              <ul>
                {morning.priorities.map((p) => (
                  <li key={p.id}>{p.title} <span className={`rec-badge rec-badge--${p.level}`}>{p.level}</span></li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {isEvening && (
        <>
          {evening.completedPriorities.length > 0 && (
            <div className="brief-block brief-block--done">
              <p className="eyebrow">COMPLETED PRIORITIES</p>
              <ul>{evening.completedPriorities.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}
          {evening.completedCommitments.length > 0 && (
            <div className="brief-block brief-block--done">
              <p className="eyebrow">COMPLETED COMMITMENTS</p>
              <ul>{evening.completedCommitments.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}
          {evening.decisionsMade.length > 0 && (
            <div className="brief-block brief-block--done">
              <p className="eyebrow">DECISIONS MADE</p>
              <ul>{evening.decisionsMade.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}
          {evening.reflectionNeeded && (
            <div className="brief-block brief-block--remind">
              <p className="eyebrow">REFLECTION</p>
              <p>No reflection recorded today. Complete your executive reflection before closing this session.</p>
            </div>
          )}
        </>
      )}
    </section>
  )
}
