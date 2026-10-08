import type { PracticeSelection } from '../core/practice-selection.ts';
import type { PracticeSession } from '../core/practice-session.ts';
import type { OpenPractice } from '../core/open-practice.ts';
import { boolean, id, integer, object, oneOf, parseRecoveryJson, requireValue, text, time } from './recovery-guards.ts';
import { decodeChoiceRecoveryPayload, freezeRecovery, sameRecoveryValue } from './recovery-choice.ts';
import { decodeOpenRecoveryPayload } from './recovery-open.ts';
export type RecoveryCheckpoint = Readonly<{
  checkpointId: string;
  createdAt: number;
  updatedAt: number;
  kind: 'choice' | 'open';
  status: 'active' | 'discarded';
  discard: null | Readonly<{ discardedAt: number; reason: 'user' | 'superseded' | 'incompatible' }>;
  payloadVersion: 'ui-05d-v1';
  session: PracticeSession | OpenPractice;
  selection: PracticeSelection | null;
}>;
function discardState(value: unknown, status: 'active' | 'discarded', updatedAt: number): RecoveryCheckpoint['discard'] {
  if (value === null) { requireValue(status === 'active', 'Discarded checkpoint requires discard metadata'); return null; }
  const discard = object(value, ['discardedAt', 'reason']);
  const discardedAt = time(discard.discardedAt);
  requireValue(status === 'discarded' && discardedAt === updatedAt, 'Discard status/time mismatch');
  return { discardedAt, reason: oneOf(discard.reason, ['user', 'superseded', 'incompatible']) };
}
export function decodeRecoveryCheckpoint(value: unknown): RecoveryCheckpoint {
  const source = object(parseRecoveryJson(value), ['checkpointId', 'createdAt', 'updatedAt', 'kind', 'status', 'discard', 'payloadVersion', 'payload']);
  const checkpointId = id(source.checkpointId); const createdAt = time(source.createdAt); const updatedAt = time(source.updatedAt);
  requireValue(createdAt <= updatedAt, 'Checkpoint timestamps are out of order');
  const kind = oneOf(source.kind, ['choice', 'open']); const status = oneOf(source.status, ['active', 'discarded']);
  const discard = discardState(source.discard, status, updatedAt);
  requireValue(source.payloadVersion === 'ui-05d-v1', 'Unsupported checkpoint payload version');
  if (kind === 'choice') {
    const decoded = decodeChoiceRecoveryPayload(source.payload, updatedAt);
    requireValue(decoded.session.sessionId !== checkpointId && decoded.session.phase !== 'empty', 'Invalid active choice checkpoint session');
    requireValue(sameRecoveryValue(decoded.selection.questions, decoded.session.questions), 'Choice payload/session question snapshot mismatch');
    return freezeRecovery({ checkpointId, createdAt, updatedAt, kind, status, discard, payloadVersion: 'ui-05d-v1', session: decoded.session, selection: decoded.selection });
  }
  const decoded = decodeOpenRecoveryPayload(source.payload, updatedAt);
  requireValue(decoded.state.sessionId !== checkpointId && decoded.state.phase !== 'finished', 'Invalid active open checkpoint session');
  return freezeRecovery({ checkpointId, createdAt, updatedAt, kind, status, discard, payloadVersion: 'ui-05d-v1', session: decoded.state, selection: null });
}
