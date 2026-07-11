import type { CancellationState, ConnectivityRequestDescriptor, PolicyDecision } from '../types/connectivity'

export type ConnectivityTransportResult =
  | { ok: true; decision: PolicyDecision; cancellationState: CancellationState }
  | { ok: false; decision: PolicyDecision; cancellationState: CancellationState }

/**
 * Build 017 transport contract.
 *
 * This interface is intentionally inert: it defines how a future, separately
 * approved adapter runtime could execute an already-authorized request.
 * No implementation is provided in Build 017.
 */
export interface ConnectivityTransport {
  execute(request: ConnectivityRequestDescriptor, decision: PolicyDecision): Promise<ConnectivityTransportResult>
}

