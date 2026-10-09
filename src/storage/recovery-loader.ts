import type { AttemptRepository } from './attempt-repository.ts';
import type { ReconciledPersistedCheckpoint } from './persisted-recovery.ts';
import { decodePersistedCheckpoint, reconcilePersistedCheckpoint } from './persisted-recovery.ts';
import { id, integer, oneOf, requireValue } from './recovery-guards.ts';
export type RecoveryReadRepository = Pick<AttemptRepository, 'findCheckpoint' | 'listCheckpoints' | 'findById'>;
export type LoadedRecovery = Readonly<{
  sessionId: string;
  storedJson: string;
  observationsJson: string;
  reconciled: ReconciledPersistedCheckpoint;
  sessionCandidate: boolean;
  hasOutstanding: boolean;
}>;
export type RecoveryPageEntry = Readonly<{ status: 'loaded'; value: LoadedRecovery }> | Readonly<{ status: 'blocked'; sessionId: string; reason: 'changed-or-unavailable' }>;
export type RecoveryPage = Readonly<{
  mode: 'resumable' | 'outbox'; offset: number; limit: number;
  entries: readonly RecoveryPageEntry[]; nextOffset: number; mayHaveMore: boolean;
}>;
export async function loadRecoverySession(repository: RecoveryReadRepository, requestedSessionId: string): Promise<LoadedRecovery | null> {
  const sessionId = id(requestedSessionId);
  const stored = await repository.findCheckpoint(sessionId);
  if (stored === null) return null;
  const storedJson = JSON.stringify(stored);
  const decoded = decodePersistedCheckpoint(storedJson);
  requireValue(decoded.checkpoint.sessionId === sessionId, 'Recovery lookup returned another session');
  const observations: { recordId: string; recordJson: string | null }[] = [];
  for (const record of decoded.pending) {
    const saved = await repository.findById(record.recordId);
    observations.push({ recordId: record.recordId, recordJson: saved === null ? null : JSON.stringify(saved) });
  }
  const observationsJson = JSON.stringify(observations);
  const reconciled = reconcilePersistedCheckpoint(storedJson, observationsJson);
  const current = await repository.findCheckpoint(sessionId);
  requireValue(current !== null && JSON.stringify(current) === storedJson, 'Checkpoint changed during recovery loading; reload required');
  const recovery = reconciled.recovery;
  const nonempty = recovery.engine.kind === 'choice' ? recovery.engine.decoded.session.phase !== 'empty' : true;
  const sessionCandidate = !recovery.discarded && recovery.checkpoint.status === 'active' && nonempty;
  return Object.freeze({ sessionId, storedJson, observationsJson, reconciled, sessionCandidate, hasOutstanding: reconciled.outstanding.length > 0 });
}
export async function loadRecoveryPage(repository: RecoveryReadRepository, requestedMode: 'resumable' | 'outbox', requestedLimit = 20, requestedOffset = 0): Promise<RecoveryPage> {
  const mode = oneOf(requestedMode, ['resumable', 'outbox']);
  const limit = integer(requestedLimit, 1, 100);
  const offset = integer(requestedOffset, 0, Number.MAX_SAFE_INTEGER - limit);
  const listed = await repository.listCheckpoints(mode, limit, offset);
  requireValue(listed.length <= limit, 'Repository recovery page exceeds requested bounds');
  const ids = listed.map(stored => id(stored.checkpoint.sessionId));
  requireValue(new Set(ids).size === ids.length, 'Repository recovery page contains duplicate sessions');
  const entries: RecoveryPageEntry[] = [];
  for (const sessionId of ids) {
    try {
      const value = await loadRecoverySession(repository, sessionId);
      if (value === null || (mode === 'resumable' && !value.sessionCandidate) || (mode === 'outbox' && value.reconciled.recovery.pending.length === 0)) {
        entries.push(Object.freeze({ status: 'blocked', sessionId, reason: 'changed-or-unavailable' }));
      } else entries.push(Object.freeze({ status: 'loaded', value }));
    } catch {
      entries.push(Object.freeze({ status: 'blocked', sessionId, reason: 'changed-or-unavailable' }));
    }
  }
  return Object.freeze({ mode, offset, limit, entries: Object.freeze(entries), nextOffset: offset + listed.length, mayHaveMore: listed.length === limit });
}
