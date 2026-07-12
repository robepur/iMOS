import type { PilotCheckIn, PilotDayRecord, PilotMeasurementSummary, PilotSession } from '../types/operatorPilot'

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return Number((values.reduce((sum, n) => sum + n, 0) / values.length).toFixed(2))
}

export class PilotMeasurementService {
  static summarize(
    session: PilotSession,
    dayRecords: PilotDayRecord[],
    checkIns: PilotCheckIn[],
    unresolvedConcernCount: number,
  ): PilotMeasurementSummary {
    const scopedDays = dayRecords.filter((r) => r.sessionId === session.id)
    const scopedCheckIns = checkIns.filter((r) => r.sessionId === session.id)

    const briefingTrend = scopedCheckIns.map((r) => r.briefingUsefulness)
    const recTrend = scopedCheckIns.map((r) => r.recommendationUsefulness)
    const effortTrend = scopedCheckIns.map((r) => r.cognitiveEffort)

    return {
      sessionId: session.id,
      status: session.status,
      activeDayCount: session.dayCount,
      remainingDayCount: session.remainingDays,
      workflowCompletionTrend: scopedDays.map((r) => (r.workflowCompleted ? 1 : 0)),
      briefingUsefulnessTrend: briefingTrend,
      recommendationUsefulnessTrend: recTrend,
      cognitiveEffortTrend: effortTrend,
      correctionCount: scopedCheckIns.reduce((sum, r) => sum + r.operatorCorrections, 0),
      missingContextReports: scopedCheckIns.filter((r) => r.missingContext).length,
      trustConcernReports: scopedCheckIns.filter((r) => !r.trustedRecommendationProcess).length,
      acceptedRecommendations: scopedCheckIns.reduce((sum, r) => sum + r.acceptedRecommendations, 0),
      rejectedRecommendations: scopedCheckIns.reduce((sum, r) => sum + r.rejectedRecommendations, 0),
      unresolvedConcernCount,
      backupReady: scopedDays.length === 0 ? false : scopedDays[scopedDays.length - 1].backupReady,
    }
  }

  static averages(checkIns: PilotCheckIn[]): { briefingUsefulness: number; recommendationUsefulness: number; cognitiveEffort: number } {
    return {
      briefingUsefulness: avg(checkIns.map((r) => r.briefingUsefulness)),
      recommendationUsefulness: avg(checkIns.map((r) => r.recommendationUsefulness)),
      cognitiveEffort: avg(checkIns.map((r) => r.cognitiveEffort)),
    }
  }
}
