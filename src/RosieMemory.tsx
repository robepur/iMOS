import { Sparkles } from 'lucide-react'
import { getRosieMemory, PersonalData } from './localData'

type Props = {
  data: PersonalData
}

export default function RosieMemory({ data }: Props) {
  const items = getRosieMemory(data).slice(0, 3)
  if (items.length === 0) return null

  return (
    <div className="rosieMemory">
      <div className="rosieMemoryHeader">
        <Sparkles size={15} />
        <span>ROSIE MEMORY</span>
      </div>
      {items.map((item) => (
        <div key={item.id} className="rosieMemoryItem">
          <p className="rosieMemoryText">{item.text}</p>
          <p className="rosieMemoryMeta">
            <span>FROM YOUR REFLECTION</span>
            <span>{formatDate(item.createdAt)}</span>
          </p>
          <p className="rosieMemoryDisclaimer">You asked Rosie to remember this.</p>
        </div>
      ))}
    </div>
  )
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
}
