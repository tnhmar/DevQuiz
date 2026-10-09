import type { RecoveryCheckpoint } from './recovery-checkpoints.ts';
import type { RecoveryReadRepository } from './recovery-loader.ts';
import { loadRecoverySession } from './recovery-loader.ts';
import { decodePersistedCheckpoint } from './persisted-recovery.ts';
import { array, id, integer, object, parseRecoveryJson, requireValue, time } from './recovery-guards.ts';
export type CheckpointReceiptPlan =
  | Readonly<{ action: 'blocked'; sessionId: string; reason: 'missing' | 'revision-changed' | 'discarded' | 'clock-regression' | 'revision-limit' }>
  | Readonly<{ action: 'unchanged'; sessionId: string; revision: number; pendingCount: number }>
  | Readonly<{ action: 'save-checkpoint'; sessionId: string; expectedRevision: number; sourceStoredJson: string; checkpoint: RecoveryCheckpoint; removedRecordIds: readonly string[]; retainedRecordIds: readonly string[] }>;
function blocked(sessionId: string, reason: Extract<CheckpointReceiptPlan, { action: 'blocked' }>['reason']): CheckpointReceiptPlan {
  return Object.freeze({ action: 'blocked', sessionId, reason });
}
export async function prepareCheckpointReceiptRevision(
  repository: RecoveryReadRepository,
  requestedSessionId: string,
  requestedRevision: number,
  requestedUpdatedAt: number
): Promise<CheckpointReceiptPlan> {
  const sessionId = id(requestedSessionId); const expectedRevision = integer(requestedRevision, 1);
  const updatedAt = time(requestedUpdatedAt);
  const loaded = await loadRecoverySession(repository, sessionId);
  if (loaded === null) return blocked(sessionId, 'missing');
  const recovery = loaded.reconciled.recovery; const previous = recovery.checkpoint;
  if (previous.revision !== expectedRevision) return blocked(sessionId, 'revision-changed');
  if (recovery.discarded) return blocked(sessionId, 'discarded');
  if (loaded.reconciled.acknowledged.length === 0) return Object.freeze({ action: 'unchanged', sessionId, revision: expectedRevision, pendingCount: previous.pendingCount });
  if (updatedAt < previous.updatedAt) return blocked(sessionId, 'clock-regression');
  if (expectedRevision === Number.MAX_SAFE_INTEGER) return blocked(sessionId, 'revision-limit');
  const outstanding = new Set(loaded.reconciled.outstanding.map(record => record.recordId));
  const body = object(parseRecoveryJson(previous.snapshotJson), ['format', 'sessionId', 'kind', 'fixture', 'revision', 'status', 'updatedAt', 'payload', 'pendingRecords']);
  const captured = array(body.pendingRecords, previous.pendingCount, previous.pendingCount);
  const pendingRecords = captured.filter((_, index) => outstanding.has(recovery.pending[index].recordId));
  requireValue(pendingRecords.length === outstanding.size, 'Receipt revision would lose an outstanding record');
  const revision = expectedRevision + 1;
  const snapshotJson = JSON.stringify({ ...body, revision, updatedAt, pendingRecords });
  const checkpoint: RecoveryCheckpoint = Object.freeze({ ...previous, revision, updatedAt, pendingCount: pendingRecords.length, snapshotJson });
  decodePersistedCheckpoint(JSON.stringify({ checkpoint, discarded: false }));
  const current = await repository.findCheckpoint(sessionId);
  if (current === null) return blocked(sessionId, 'missing');
  if (JSON.stringify(current) !== loaded.storedJson) return blocked(sessionId, 'revision-changed');
  return Object.freeze({
    action: 'save-checkpoint', sessionId, expectedRevision, sourceStoredJson: loaded.storedJson, checkpoint,
    removedRecordIds: Object.freeze(loaded.reconciled.acknowledged.map(record => record.recordId)),
    retainedRecordIds: Object.freeze(loaded.reconciled.outstanding.map(record => record.recordId))
  });
}
