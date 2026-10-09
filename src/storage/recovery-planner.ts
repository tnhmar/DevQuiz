import type { DecodedPersistedCheckpoint } from './persisted-recovery.ts';
import type { LoadedRecovery, RecoveryReadRepository } from './recovery-loader.ts';
import { loadRecoverySession } from './recovery-loader.ts';
import { id, integer, object, oneOf, requireValue } from './recovery-guards.ts';
export type ResumePolicyReason = 'policy-unavailable' | 'not-authorized' | 'content-unavailable' | 'content-incompatible';
export type ResumePolicyDecision = Readonly<{ kind: 'allow'; mode: 'fixture-preview' | 'approved-content' }> | Readonly<{ kind: 'deny'; reason: ResumePolicyReason }>;
export type ResumePolicyEvaluator = (recovery: DecodedPersistedCheckpoint) => Promise<ResumePolicyDecision>;
export type RecoveryActionPlan =
  | Readonly<{ action: 'blocked'; sessionId: string; reason: ResumePolicyReason | 'missing' | 'revision-changed' | 'discarded' | 'completed' | 'empty-session' }>
  | Readonly<{ action: 'resume'; sessionId: string; expectedRevision: number; mode: 'fixture-preview' | 'approved-content'; loaded: LoadedRecovery }>
  | Readonly<{ action: 'discard'; sessionId: string; expectedRevision: number; alreadyDiscarded: boolean; retainedPendingRecordIds: readonly string[] }>;
function blocked(sessionId: string, reason: Extract<RecoveryActionPlan, { action: 'blocked' }>['reason']): RecoveryActionPlan {
  return Object.freeze({ action: 'blocked', sessionId, reason });
}
function decodePolicy(value: unknown): ResumePolicyDecision {
  const source = object(value, ['kind'], ['mode', 'reason']);
  const kind = oneOf(source.kind, ['allow', 'deny']);
  if (kind === 'allow') {
    const allow = object(value, ['kind', 'mode']);
    return Object.freeze({ kind, mode: oneOf(allow.mode, ['fixture-preview', 'approved-content']) });
  }
  const deny = object(value, ['kind', 'reason']);
  return Object.freeze({ kind, reason: oneOf(deny.reason, ['policy-unavailable', 'not-authorized', 'content-unavailable', 'content-incompatible']) });
}
export async function prepareRecoveryAction(
  repository: RecoveryReadRepository,
  requestedSessionId: string,
  requestedRevision: number,
  requestedAction: 'resume' | 'discard',
  evaluateResume?: ResumePolicyEvaluator
): Promise<RecoveryActionPlan> {
  const sessionId = id(requestedSessionId); const expectedRevision = integer(requestedRevision, 1);
  const action = oneOf(requestedAction, ['resume', 'discard']);
  const loaded = await loadRecoverySession(repository, sessionId);
  if (loaded === null) return blocked(sessionId, 'missing');
  const recovery = loaded.reconciled.recovery;
  if (recovery.checkpoint.revision !== expectedRevision) return blocked(sessionId, 'revision-changed');
  if (action === 'resume') {
    if (recovery.discarded) return blocked(sessionId, 'discarded');
    if (recovery.checkpoint.status === 'completed') return blocked(sessionId, 'completed');
    if (!loaded.sessionCandidate) return blocked(sessionId, 'empty-session');
    if (!evaluateResume) return blocked(sessionId, 'policy-unavailable');
    const policy = decodePolicy(await evaluateResume(recovery));
    if (policy.kind === 'deny') return blocked(sessionId, policy.reason);
    requireValue((policy.mode === 'fixture-preview') === recovery.checkpoint.fixture, 'Resume policy mode does not match the captured fixture context');
    const current = await repository.findCheckpoint(sessionId);
    if (current === null) return blocked(sessionId, 'missing');
    if (JSON.stringify(current) !== loaded.storedJson) return blocked(sessionId, 'revision-changed');
    return Object.freeze({ action: 'resume', sessionId, expectedRevision, mode: policy.mode, loaded });
  }
  const current = await repository.findCheckpoint(sessionId);
  if (current === null) return blocked(sessionId, 'missing');
  if (JSON.stringify(current) !== loaded.storedJson) return blocked(sessionId, 'revision-changed');
  return Object.freeze({ action: 'discard', sessionId, expectedRevision, alreadyDiscarded: recovery.discarded, retainedPendingRecordIds: Object.freeze(recovery.pending.map(record => record.recordId)) });
}
