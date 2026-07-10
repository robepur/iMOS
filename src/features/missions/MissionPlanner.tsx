import { useMemo, useState } from 'react'
import type { MissionPlan, MissionStep, PersonalData } from '../../localData'
import { MissionPlanningEngine } from '../../services/MissionPlanningEngine'
import { DependencyEngine } from '../../services/DependencyEngine'
import MissionDashboard from './MissionDashboard'
import MissionHistory from './MissionHistory'
import MissionStatistics from './MissionStatistics'
import DependencyViewer from './DependencyViewer'
import MissionTimeline from './MissionTimeline'

type Props = {
  data: PersonalData
  onClose: () => void
  onSaveMissionPlan: (plan: MissionPlan, steps: MissionStep[]) => void
  onSetMissionPlanStatus: (planId: string, status: MissionPlan['status']) => void
  onUpdateMissionPlan: (planId: string, patch: Partial<Pick<MissionPlan, 'title' | 'objective' | 'explanation'>>) => void
  onUpdateMissionStepStatus: (planId: string, stepId: string, status: MissionStep['status'], reason?: string) => void
  onUpdateMissionStep: (planId: string, stepId: string, patch: Partial<Pick<MissionStep, 'title' | 'description' | 'estimatedEffort' | 'dependsOn'>>) => void
  onAddMissionStep: (planId: string, title: string) => void
  onDeleteMissionStep: (planId: string, stepId: string) => void
  onReorderMissionSteps: (planId: string, orderedStepIds: string[]) => void
  onDeleteMissionPlan: (planId: string) => void
}

type Tab = 'planner' | 'dashboard' | 'history' | 'statistics' | 'timeline'

export default function MissionPlanner({
  data,
  onClose,
  onSaveMissionPlan,
  onSetMissionPlanStatus,
  onUpdateMissionPlan,
  onUpdateMissionStepStatus,
  onUpdateMissionStep,
  onAddMissionStep,
  onDeleteMissionStep,
  onReorderMissionSteps,
  onDeleteMissionPlan,
}: Props) {
  const [tab, setTab] = useState<Tab>('planner')
  const [objective, setObjective] = useState('')
  const [newStepTitle, setNewStepTitle] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(data.missionPlans?.[0]?.id ?? null)

  const plans = data.missionPlans ?? []
  const steps = data.missionSteps ?? []
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null
  const selectedSteps = selectedPlan ? steps.filter((s) => selectedPlan.stepIds.includes(s.id)).sort((a, b) => a.order - b.order) : []
  const activePlan = plans.find((p) => p.status === 'active') ?? null
  const activeSteps = activePlan ? steps.filter((s) => activePlan.stepIds.includes(s.id)) : []
  const dependencyReport = useMemo(
    () => selectedPlan ? DependencyEngine.analyze(selectedPlan, selectedSteps, data) : null,
    [data, selectedPlan, selectedSteps]
  )

  const generate = () => {
    const { plan, steps: generated } = MissionPlanningEngine.generateMission(data, objective.trim() || undefined)
    onSaveMissionPlan(plan, generated)
    setSelectedPlanId(plan.id)
    setObjective('')
  }

  return (
    <section className="mission-planner panel" aria-label="Rosie Mission Planner">
      <div className="panelHeader">
        <div><p className="eyebrow">ROSIE MISSION PLANNING ENGINE</p><h2>Mission Planner</h2></div>
        <button className="closeButton" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <nav className="ud-tabs" aria-label="Mission sections">
        {(['planner', 'dashboard', 'history', 'statistics', 'timeline'] as Tab[]).map((t) => (
          <button key={t} className={`ud-tab${tab === t ? ' ud-tab--active' : ''}`} onClick={() => setTab(t)}>
            {t.toUpperCase()}
          </button>
        ))}
      </nav>

      {tab === 'planner' && (
        <div className="mission-grid">
          <section className="mission-card">
            <p className="eyebrow">MISSION GENERATOR</p>
            <label className="mission-label">Mission objective
              <textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Optional objective override" />
            </label>
            <button className="utilityButton" onClick={generate}>Generate mission plan</button>
          </section>

          <section className="mission-card">
            <p className="eyebrow">MISSION PLANS</p>
            {plans.length === 0 && <p className="emptyState">No plans generated.</p>}
            {plans.map((plan) => (
              <button key={plan.id} className={`mission-plan-row${selectedPlanId === plan.id ? ' mission-plan-row--active' : ''}`} onClick={() => setSelectedPlanId(plan.id)}>
                <span>{plan.title}</span><strong>{plan.status.toUpperCase()}</strong>
              </button>
            ))}
          </section>

          {selectedPlan && (
            <>
              <section className="mission-card mission-card--wide">
                <p className="eyebrow">PLAN EXPLANATION</p>
                <input className="mission-input" value={selectedPlan.title} onChange={(e) => onUpdateMissionPlan(selectedPlan.id, { title: e.target.value })} aria-label="Mission title" />
                <textarea value={selectedPlan.objective} onChange={(e) => onUpdateMissionPlan(selectedPlan.id, { objective: e.target.value })} aria-label="Mission objective" />
                <textarea value={selectedPlan.explanation} onChange={(e) => onUpdateMissionPlan(selectedPlan.id, { explanation: e.target.value })} aria-label="Mission explanation" />
                <div className="mission-actions">
                  <button onClick={() => onSetMissionPlanStatus(selectedPlan.id, 'approved')}>Approve</button>
                  <button onClick={() => onSetMissionPlanStatus(selectedPlan.id, 'active')}>Activate</button>
                  <button onClick={() => onSetMissionPlanStatus(selectedPlan.id, 'paused')}>Pause</button>
                  <button onClick={() => onSetMissionPlanStatus(selectedPlan.id, 'completed')}>Complete</button>
                  <button onClick={() => onSetMissionPlanStatus(selectedPlan.id, 'cancelled')}>Reject</button>
                  <button onClick={() => onDeleteMissionPlan(selectedPlan.id)}>Delete</button>
                </div>
                {selectedPlan.requiresOperatorReview && <p className="mission-evidence">Operator review required before activation.</p>}
              </section>

              <section className="mission-card mission-card--wide">
                <p className="eyebrow">MISSION STEPS</p>
                <div className="mission-actions">
                  <input
                    className="mission-input"
                    value={newStepTitle}
                    onChange={(event) => setNewStepTitle(event.target.value)}
                    placeholder="Add operator step"
                    aria-label="New mission step title"
                  />
                  <button
                    onClick={() => {
                      onAddMissionStep(selectedPlan.id, newStepTitle)
                      setNewStepTitle('')
                    }}
                  >
                    Add step
                  </button>
                </div>
                <label className="mission-label">Override reason
                  <input className="mission-input" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Optional override reason" />
                </label>
                {selectedSteps.map((step) => (
                  <div key={step.id} className="mission-step-row">
                    <div>
                      <strong>{step.order}. {step.title}</strong>
                      <input
                        className="mission-input"
                        value={step.title}
                        aria-label={`Step title ${step.order}`}
                        onChange={(event) => onUpdateMissionStep(selectedPlan.id, step.id, { title: event.target.value })}
                      />
                      <textarea
                        value={step.description}
                        aria-label={`Step description ${step.order}`}
                        onChange={(event) => onUpdateMissionStep(selectedPlan.id, step.id, { description: event.target.value })}
                      />
                      <label className="mission-label">Dependencies (comma-separated step IDs)
                        <input
                          className="mission-input"
                          value={step.dependsOn.join(', ')}
                          onChange={(event) => onUpdateMissionStep(
                            selectedPlan.id,
                            step.id,
                            { dependsOn: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) }
                          )}
                          aria-label={`Step dependencies ${step.order}`}
                        />
                      </label>
                      <label className="mission-label">Estimated effort
                        <select
                          value={step.estimatedEffort}
                          onChange={(event) => onUpdateMissionStep(selectedPlan.id, step.id, { estimatedEffort: event.target.value as MissionStep['estimatedEffort'] })}
                          aria-label={`Step effort ${step.order}`}
                        >
                          <option value="small">Small</option>
                          <option value="medium">Medium</option>
                          <option value="large">Large</option>
                        </select>
                      </label>
                      <p className="mission-evidence">Effort: {step.estimatedEffort.toUpperCase()} · Depends on: {step.dependsOn.length}</p>
                      <ul>{step.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
                    </div>
                    <div className="mission-step-actions">
                      <button onClick={() => onReorderMissionSteps(selectedPlan.id, [step.id, ...selectedSteps.filter((s) => s.id !== step.id).map((s) => s.id)])}>Move first</button>
                      <button onClick={() => onUpdateMissionStepStatus(selectedPlan.id, step.id, 'active', overrideReason.trim() || undefined)}>Active</button>
                      <button onClick={() => onUpdateMissionStepStatus(selectedPlan.id, step.id, 'blocked', overrideReason.trim() || undefined)}>Blocked</button>
                      <button onClick={() => onUpdateMissionStepStatus(selectedPlan.id, step.id, 'completed', overrideReason.trim() || undefined)}>Complete</button>
                      <button onClick={() => onDeleteMissionStep(selectedPlan.id, step.id)}>Delete step</button>
                    </div>
                  </div>
                ))}
              </section>

              {dependencyReport && <DependencyViewer report={dependencyReport} />}
            </>
          )}
        </div>
      )}

      {tab === 'dashboard' && <MissionDashboard activePlan={activePlan} steps={activeSteps} />}
      {tab === 'history' && <MissionHistory plans={plans} steps={steps} />}
      {tab === 'statistics' && <MissionStatistics plans={plans} steps={steps} />}
      {tab === 'timeline' && <MissionTimeline timeline={data.timeline} />}
    </section>
  )
}
