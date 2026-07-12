import { useState } from 'react'
import type { PilotCheckIn } from '../../types/operatorPilot'

function ratingOptions() {
  return [1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)
}

export default function PilotDailyCheckIn({
  sessionId,
  dayNumber,
  onSave,
}: {
  sessionId: string
  dayNumber: number
  onSave: (checkIn: PilotCheckIn) => void
}) {
  const [briefingUsefulness, setBriefingUsefulness] = useState<1 | 2 | 3 | 4 | 5>(3)
  const [recommendationUsefulness, setRecommendationUsefulness] = useState<1 | 2 | 3 | 4 | 5>(3)
  const [cognitiveEffort, setCognitiveEffort] = useState<1 | 2 | 3 | 4 | 5>(3)
  const [reasoningUnderstandable, setReasoningUnderstandable] = useState(true)
  const [missingContext, setMissingContext] = useState(false)
  const [incorrectAssumption, setIncorrectAssumption] = useState(false)
  const [reducedCognitiveEffort, setReducedCognitiveEffort] = useState(true)
  const [improvedDecisionClarity, setImprovedDecisionClarity] = useState(true)
  const [respectedOperatorAuthority, setRespectedOperatorAuthority] = useState(true)
  const [trustedRecommendationProcess, setTrustedRecommendationProcess] = useState(true)
  const [helpedAdvanceMission, setHelpedAdvanceMission] = useState(true)
  const [acceptedRecommendations, setAcceptedRecommendations] = useState(0)
  const [rejectedRecommendations, setRejectedRecommendations] = useState(0)
  const [operatorCorrections, setOperatorCorrections] = useState(0)
  const [comment, setComment] = useState('')

  return (
    <section className="panel" style={{ padding: '1rem' }} data-testid="pilot-daily-checkin">
      <p className="eyebrow">DAILY PILOT CHECK IN</p>
      <div className="recordGrid">
        <label>Briefing usefulness
          <select value={briefingUsefulness} onChange={(e) => setBriefingUsefulness(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}>{ratingOptions()}</select>
        </label>
        <label>Recommendation usefulness
          <select value={recommendationUsefulness} onChange={(e) => setRecommendationUsefulness(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}>{ratingOptions()}</select>
        </label>
        <label>Cognitive effort
          <select value={cognitiveEffort} onChange={(e) => setCognitiveEffort(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}>{ratingOptions()}</select>
        </label>
        <label>Accepted recommendations
          <input type="number" min={0} value={acceptedRecommendations} onChange={(e) => setAcceptedRecommendations(Math.max(0, Number(e.target.value) || 0))} />
        </label>
        <label>Rejected recommendations
          <input type="number" min={0} value={rejectedRecommendations} onChange={(e) => setRejectedRecommendations(Math.max(0, Number(e.target.value) || 0))} />
        </label>
        <label>Operator corrections
          <input type="number" min={0} value={operatorCorrections} onChange={(e) => setOperatorCorrections(Math.max(0, Number(e.target.value) || 0))} />
        </label>
      </div>
      <div className="captureActions">
        <label><input type="checkbox" checked={reasoningUnderstandable} onChange={(e) => setReasoningUnderstandable(e.target.checked)} /> Reasoning understandable</label>
        <label><input type="checkbox" checked={missingContext} onChange={(e) => setMissingContext(e.target.checked)} /> Missing context</label>
        <label><input type="checkbox" checked={incorrectAssumption} onChange={(e) => setIncorrectAssumption(e.target.checked)} /> Incorrect assumption</label>
        <label><input type="checkbox" checked={reducedCognitiveEffort} onChange={(e) => setReducedCognitiveEffort(e.target.checked)} /> Reduced cognitive effort</label>
        <label><input type="checkbox" checked={improvedDecisionClarity} onChange={(e) => setImprovedDecisionClarity(e.target.checked)} /> Improved decision clarity</label>
        <label><input type="checkbox" checked={respectedOperatorAuthority} onChange={(e) => setRespectedOperatorAuthority(e.target.checked)} /> Respected operator authority</label>
        <label><input type="checkbox" checked={trustedRecommendationProcess} onChange={(e) => setTrustedRecommendationProcess(e.target.checked)} /> Trusted recommendation process</label>
        <label><input type="checkbox" checked={helpedAdvanceMission} onChange={(e) => setHelpedAdvanceMission(e.target.checked)} /> Helped advance mission</label>
      </div>
      <label>
        Optional comment
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
      </label>
      <button
        data-testid="pilot-checkin-save"
        onClick={() => {
          onSave({
            id: `pilot-checkin:${crypto.randomUUID()}`,
            sessionId,
            dayNumber,
            date: new Date().toISOString(),
            briefingUsefulness,
            recommendationUsefulness,
            reasoningUnderstandable,
            missingContext,
            incorrectAssumption,
            reducedCognitiveEffort,
            improvedDecisionClarity,
            respectedOperatorAuthority,
            trustedRecommendationProcess,
            helpedAdvanceMission,
            cognitiveEffort,
            acceptedRecommendations,
            rejectedRecommendations,
            operatorCorrections,
            comment: comment.trim() || undefined,
            createdAt: new Date().toISOString(),
          })
        }}
      >
        Save check in
      </button>
    </section>
  )
}
