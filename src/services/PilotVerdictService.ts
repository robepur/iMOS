import type { PilotCompletionVerdict, PilotConcern, PilotMeasurementSummary } from '../types/operatorPilot'

export class PilotVerdictService {
  static resolve(summary: PilotMeasurementSummary, concerns: PilotConcern[]): { verdict: PilotCompletionVerdict; evidence: string[] } {
    const unresolved = concerns.filter((c) => !c.resolvedAt)
    const evidence: string[] = [
      `active_days=${summary.activeDayCount}`,
      `remaining_days=${summary.remainingDayCount}`,
      `workflow_completion_points=${summary.workflowCompletionTrend.length}`,
      `briefing_trend_points=${summary.briefingUsefulnessTrend.length}`,
      `recommendation_trend_points=${summary.recommendationUsefulnessTrend.length}`,
      `cognitive_effort_points=${summary.cognitiveEffortTrend.length}`,
      `trust_concern_reports=${summary.trustConcernReports}`,
      `unresolved_concerns=${unresolved.length}`,
    ]

    if (unresolved.some((c) => c.type === 'critical_security')) return { verdict: 'security_review_required', evidence }
    if (unresolved.some((c) => c.type === 'recovery_failure' || c.type === 'suspected_data_loss')) return { verdict: 'recovery_review_required', evidence }
    if (unresolved.some((c) => c.type === 'repeated_trust_concern')) return { verdict: 'rosie_refinement_required', evidence }
    if (summary.activeDayCount < 14) return { verdict: 'extend_pilot', evidence }
    if (summary.trustConcernReports > 0 || summary.unresolvedConcernCount > 0) return { verdict: 'pause_and_review', evidence }
    return { verdict: 'continue_to_production_preparation', evidence }
  }
}
