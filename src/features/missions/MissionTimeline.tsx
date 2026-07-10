import type { TimelineEntry } from '../../localData'

const ALLOWED = new Set([
  'Mission Created',
  'Mission Approved',
  'Mission Activated',
  'Mission Paused',
  'Mission Completed',
  'Mission Cancelled',
  'Step Completed',
  'Dependency Resolved',
  'Blocked Work',
])

export default function MissionTimeline({ timeline }: { timeline: TimelineEntry[] }) {
  const events = timeline.filter((e) => e.type === 'mission' || ALLOWED.has(e.title)).slice(0, 20)
  return (
    <section className="mission-card">
      <p className="eyebrow">MISSION TIMELINE</p>
      {events.length === 0 && <p className="emptyState">No mission events yet.</p>}
      {events.map((entry) => (
        <div key={entry.id} className="mission-timeline-item">
          <strong>{entry.title}</strong>
          <p>{entry.detail}</p>
          <span>{new Date(entry.createdAt).toLocaleString()}</span>
        </div>
      ))}
    </section>
  )
}

