import type { RecoveryCheckpoint } from './recovery-checkpoints.ts';
import type { AttemptRecord } from './attempt-records.ts';
import { createChoiceAttemptRecord, createOpenAttemptRecord } from './attempt-records.ts';
import { decodeChoiceRecoveryPayload, freezeRecovery, sameRecoveryValue } from './recovery-choice.ts';
import { decodeOpenRecoveryPayload } from './recovery-open.ts';
import { array, boolean, id, integer, object, oneOf, parseRecoveryJson, requireValue, text, time } from './recovery-guards.ts';
export type DecodedPersistedCheckpoint = Readonly<{
  checkpoint: RecoveryCheckpoint; discarded: boolean;
  engine: Readonly<{ kind: 'choice'; decoded: ReturnType<typeof decodeChoiceRecoveryPayload> }> | Readonly<{ kind: 'open'; decoded: ReturnType<typeof decodeOpenRecoveryPayload> }>;
  pending: readonly AttemptRecord[];
}>;
export type ReconciledPersistedCheckpoint = Readonly<{
  recovery: DecodedPersistedCheckpoint;
  acknowledged: readonly AttemptRecord[];
  outstanding: readonly AttemptRecord[];
}>;
const recordKeys = ['schemaVersion', 'recordId', 'sessionId', 'fixture', 'packId', 'contentVersion', 'language', 'questionId', 'questionRevision', 'questionFamilyId', 'primaryConceptId', 'level', 'dimension', 'technologyScopesJson', 'committedAt', 'recordedAt', 'payloadJson', 'kind', 'objective'] as const;
function matchCapturedRecord(value: unknown, engine: DecodedPersistedCheckpoint['engine'], cutoff: number): AttemptRecord {
  const source = object(value, recordKeys);
  const recordId = id(source.recordId); const recordedAt = time(source.recordedAt);
  requireValue(recordedAt <= cutoff, 'Pending capture is after its checkpoint');
  const expected = engine.kind === 'choice'
    ? createChoiceAttemptRecord({ recordId, recordedAt, session: engine.decoded.session, questionId: id(source.questionId) })
    : createOpenAttemptRecord({ recordId, recordedAt, state: engine.decoded.state });
  const payloadJson = text(source.payloadJson, 1, 16000000);
  const technologyScopesJson = text(source.technologyScopesJson, 1, 16000000);
  requireValue(sameRecoveryValue(parseRecoveryJson(payloadJson), parseRecoveryJson(expected.payloadJson)), 'Pending payload differs from the locked outcome');
  requireValue(sameRecoveryValue(parseRecoveryJson(technologyScopesJson), parseRecoveryJson(expected.technologyScopesJson)), 'Pending technology scope differs');
  const retained = { ...expected, payloadJson, technologyScopesJson };
  requireValue(sameRecoveryValue(source, retained), 'Pending record headers differ from the captured outcome');
  return Object.freeze(retained);
}
export function decodePersistedCheckpoint(storedJson: unknown): DecodedPersistedCheckpoint {
  const stored = object(parseRecoveryJson(storedJson), ['checkpoint', 'discarded']);
  const discarded = boolean(stored.discarded);
  const header = object(stored.checkpoint, ['schemaVersion', 'sessionId', 'kind', 'revision', 'fixture', 'status', 'updatedAt', 'pendingCount', 'snapshotJson']);
  requireValue(header.schemaVersion === 1, 'Unsupported persisted checkpoint schema');
  const sessionId = id(header.sessionId); const kind = oneOf(header.kind, ['choice', 'open']);
  const revision = integer(header.revision, 1); const fixture = boolean(header.fixture);
  const status = oneOf(header.status, ['active', 'completed']); const updatedAt = time(header.updatedAt);
  const pendingCount = integer(header.pendingCount, 0, 100);
  const snapshotJson = text(header.snapshotJson, 1, 16000000);
  const body = object(parseRecoveryJson(snapshotJson), ['format', 'sessionId', 'kind', 'fixture', 'revision', 'status', 'updatedAt', 'payload', 'pendingRecords']);
  requireValue(body.format === 'devquiz.recovery.v1', 'Unsupported persisted recovery format');
  for (const key of ['sessionId', 'kind', 'fixture', 'revision', 'status', 'updatedAt'] as const) requireValue(body[key] === header[key], 'Persisted checkpoint header/body mismatch');
  const payload = object(body.payload, kind === 'choice' ? ['engineVersion', 'engineSnapshot', 'selectionSnapshot'] : ['engineVersion', 'engineSnapshot', 'modelAnswerExposure', 'retryHistory']);
  const engine: DecodedPersistedCheckpoint['engine'] = kind === 'choice'
    ? { kind: 'choice', decoded: decodeChoiceRecoveryPayload(JSON.stringify(payload), updatedAt) }
    : { kind: 'open', decoded: decodeOpenRecoveryPayload(JSON.stringify(payload), updatedAt) };
  const state = engine.kind === 'choice' ? engine.decoded.session : engine.decoded.state;
  requireValue(state.sessionId === sessionId && state.fixture === fixture, 'Persisted engine identity mismatch');
  requireValue(status === (state.phase === 'finished' ? 'completed' : 'active'), 'Persisted completion status mismatch');
  const pending = array(body.pendingRecords, pendingCount, pendingCount).map(value => matchCapturedRecord(value, engine, updatedAt));
  const recordIds = new Set<string>(); const outcomes = new Set<string>();
  for (const record of pending) {
    const outcome = JSON.stringify([record.packId, record.contentVersion, record.language, record.questionId, record.questionRevision, record.kind]);
    requireValue(!recordIds.has(record.recordId) && !outcomes.has(outcome), 'Duplicate pending record or logical outcome');
    recordIds.add(record.recordId); outcomes.add(outcome);
  }
  const checkpoint: RecoveryCheckpoint = { schemaVersion: 1, sessionId, kind, revision, fixture, status, updatedAt, pendingCount, snapshotJson };
  return freezeRecovery({ checkpoint, discarded, engine, pending });
}
export function reconcilePersistedCheckpoint(storedJson: unknown, observationsJson: unknown): ReconciledPersistedCheckpoint {
  const recovery = decodePersistedCheckpoint(storedJson);
  const pending = new Map(recovery.pending.map(record => [record.recordId, record]));
  const observed = new Set<string>();
  const acknowledgedIds = new Set<string>();
  const observations = array(parseRecoveryJson(observationsJson), recovery.pending.length, recovery.pending.length);
  for (const value of observations) {
    const observation = object(value, ['recordId', 'recordJson']);
    const recordId = id(observation.recordId);
    const expected = pending.get(recordId);
    requireValue(expected !== undefined && !observed.has(recordId), 'Unknown or duplicate saved-record observation');
    observed.add(recordId);
    if (observation.recordJson !== null) {
      const saved = object(parseRecoveryJson(observation.recordJson), recordKeys);
      requireValue(sameRecoveryValue(saved, expected), 'Saved record conflicts with the exact pending capture');
      acknowledgedIds.add(recordId);
    }
  }
  const acknowledged = recovery.pending.filter(record => acknowledgedIds.has(record.recordId));
  const outstanding = recovery.pending.filter(record => !acknowledgedIds.has(record.recordId));
  return freezeRecovery({ recovery, acknowledged, outstanding });
}
