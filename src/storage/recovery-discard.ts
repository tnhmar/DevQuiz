import type { CheckpointRepository } from './checkpoint-repository.ts';
import { CheckpointConflictError } from './checkpoint-repository.ts';
import type { RecoveryReadRepository } from './recovery-loader.ts';
import type { RecoveryActionPlan } from './recovery-planner.ts';
import { prepareRecoveryAction } from './recovery-planner.ts';
import { boolean, id, integer, object, oneOf, requireValue } from './recovery-guards.ts';
export type DiscardConfirmation = Readonly<{ sessionId: string; revision: number; confirmed: boolean }>;
export type DiscardRecoveryResult =
  | Readonly<{ status: 'blocked'; plan: Extract<RecoveryActionPlan, { action: 'blocked' }> }>
  | Readonly<{ status: 'discarded' | 'already_discarded'; sessionId: string; expectedRevision: number; retainedPendingRecordIds: readonly string[] }>
  | Readonly<{ status: 'unconfirmed' | 'conflict'; sessionId: string; expectedRevision: number }>;
export async function discardRecoverySession(
  repository: RecoveryReadRepository & Pick<CheckpointRepository, 'discardCheckpoint'>,
  requestedSessionId: string,
  requestedRevision: number,
  confirmation: DiscardConfirmation
): Promise<DiscardRecoveryResult> {
  const sessionId = id(requestedSessionId); const expectedRevision = integer(requestedRevision, 1);
  const confirmed = object(confirmation, ['sessionId', 'revision', 'confirmed']);
  requireValue(boolean(confirmed.confirmed) && id(confirmed.sessionId) === sessionId && integer(confirmed.revision, 1) === expectedRevision, 'Discard needs explicit confirmation for this exact session revision');
  const plan = await prepareRecoveryAction(repository, sessionId, expectedRevision, 'discard');
  if (plan.action === 'blocked') return Object.freeze({ status: 'blocked', plan });
  requireValue(plan.action === 'discard', 'Unexpected recovery discard plan');
  try {
    const status = oneOf(await repository.discardCheckpoint(sessionId, expectedRevision), ['discarded', 'already_discarded']);
    return Object.freeze({ status, sessionId, expectedRevision, retainedPendingRecordIds: plan.retainedPendingRecordIds });
  } catch (error) {
    return Object.freeze({ status: error instanceof CheckpointConflictError ? 'conflict' : 'unconfirmed', sessionId, expectedRevision });
  }
}
