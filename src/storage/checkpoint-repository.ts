import type { SQLiteDatabase } from 'expo-sqlite';
import type { AttemptRecord } from './attempt-records.ts';
import type { RecoveryCheckpoint } from './recovery-checkpoints.ts';
type Queue = <T>(operation: () => Promise<T>) => Promise<T>;
export type StoredCheckpoint = Readonly<{ checkpoint: RecoveryCheckpoint; discarded: boolean }>;
export type CheckpointSaveResult = Readonly<{ status: 'saved' | 'already_saved'; sessionId: string; revision: number }>;
export type CheckpointRepository = Readonly<{
  saveCheckpoint: (checkpoint: RecoveryCheckpoint, expectedRevision: number | null) => Promise<CheckpointSaveResult>;
  findCheckpoint: (sessionId: string) => Promise<StoredCheckpoint | null>;
  listCheckpoints: (mode: 'resumable' | 'outbox', limit?: number, offset?: number) => Promise<readonly StoredCheckpoint[]>;
  discardCheckpoint: (sessionId: string, expectedRevision: number) => Promise<'discarded' | 'already_discarded'>;
}>;
export class CheckpointConflictError extends Error {
  constructor(message: string) { super(message); this.name = 'CheckpointConflictError'; }
}
type Row = { session_id: string; kind: string; revision: number; fixture: number; status: string; updated_at: number; pending_count: number; discarded: number; checkpoint_json: string };
function capture(value: RecoveryCheckpoint, encodeAttempt: (record: AttemptRecord) => string) {
  if (value.schemaVersion !== 1 || !value.sessionId.trim() || !['choice', 'open'].includes(value.kind) || typeof value.fixture !== 'boolean' || !['active', 'completed'].includes(value.status) || !Number.isSafeInteger(value.revision) || value.revision < 1 || !Number.isFinite(value.updatedAt) || value.updatedAt < 0 || !Number.isInteger(value.pendingCount) || value.pendingCount < 0 || typeof value.snapshotJson !== 'string') throw new Error('Invalid checkpoint header');
  const body = JSON.parse(value.snapshotJson);
  if (!body || typeof body !== 'object' || Array.isArray(body) || body.format !== 'devquiz.recovery.v1' || body.sessionId !== value.sessionId || body.kind !== value.kind || body.fixture !== value.fixture || body.revision !== value.revision || body.status !== value.status || body.updatedAt !== value.updatedAt || !body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload) || !Array.isArray(body.pendingRecords) || body.pendingRecords.length !== value.pendingCount) throw new Error('Checkpoint encoding/context mismatch');
  const pending = body.pendingRecords as AttemptRecord[];
  const ids = new Set<string>();
  const outcomes = new Set<string>();
  for (const record of pending) {
    encodeAttempt(record);
    const outcome = JSON.stringify([record.packId, record.contentVersion, record.language, record.questionId, record.questionRevision, record.kind]);
    if (record.sessionId !== value.sessionId || record.kind !== value.kind || record.fixture !== value.fixture || record.recordedAt > value.updatedAt || ids.has(record.recordId) || outcomes.has(outcome)) throw new Error('Invalid checkpoint outbox ownership');
    ids.add(record.recordId); outcomes.add(outcome);
  }
  const checkpoint: RecoveryCheckpoint = Object.freeze({ schemaVersion: 1, sessionId: value.sessionId, kind: value.kind, revision: value.revision, fixture: value.fixture, status: value.status, updatedAt: value.updatedAt, pendingCount: value.pendingCount, snapshotJson: value.snapshotJson });
  return { checkpoint, pending, encoded: JSON.stringify(checkpoint) };
}
function stored(row: Row, encodeAttempt: (record: AttemptRecord) => string): StoredCheckpoint {
  const checkpoint = capture(JSON.parse(row.checkpoint_json) as RecoveryCheckpoint, encodeAttempt).checkpoint;
  if (row.session_id !== checkpoint.sessionId || row.kind !== checkpoint.kind || row.revision !== checkpoint.revision || row.fixture !== (checkpoint.fixture ? 1 : 0) || row.status !== checkpoint.status || row.updated_at !== checkpoint.updatedAt || row.pending_count !== checkpoint.pendingCount || (row.discarded !== 0 && row.discarded !== 1)) throw new Error('Stored checkpoint projection mismatch');
  return Object.freeze({ checkpoint, discarded: row.discarded === 1 });
}
export function attachCheckpointRepository(db: SQLiteDatabase, queued: Queue, encodeAttempt: (record: AttemptRecord) => string): CheckpointRepository {
  return Object.freeze({
    saveCheckpoint(value: RecoveryCheckpoint, expectedRevision: number | null): Promise<CheckpointSaveResult> {
      let captured: ReturnType<typeof capture>;
      try {
        captured = capture(value, encodeAttempt);
        if (expectedRevision !== null && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)) throw new Error('Invalid expected revision');
        if (captured.checkpoint.revision !== (expectedRevision === null ? 1 : expectedRevision + 1)) throw new Error('Checkpoint must advance exactly one revision');
      } catch (error) { return Promise.reject(error); }
      return queued(async () => {
        const checkpoint = captured.checkpoint;
        let status: CheckpointSaveResult['status'] = 'saved';
        await db.withExclusiveTransactionAsync(async transaction => {
          const row = await transaction.getFirstAsync<Row>('SELECT * FROM session_checkpoints WHERE session_id = ?', checkpoint.sessionId);
          if (row) {
            const old = stored(row, encodeAttempt);
            if (old.discarded) throw new CheckpointConflictError('Discarded sessions cannot be revived by background checkpoint writes');
            if (row.revision === checkpoint.revision && row.checkpoint_json === captured.encoded) { status = 'already_saved'; return; }
            if (expectedRevision !== row.revision || checkpoint.kind !== old.checkpoint.kind || checkpoint.fixture !== old.checkpoint.fixture) throw new CheckpointConflictError('Checkpoint revision or identity conflict');
            if (old.checkpoint.status === 'completed' && checkpoint.status !== 'completed') throw new CheckpointConflictError('Completed session cannot return to active under the same ID');
            const previous = capture(old.checkpoint, encodeAttempt);
            const next = new Map(captured.pending.map(record => [record.recordId, record]));
            for (const record of previous.pending) {
              const replacement = next.get(record.recordId);
              if (replacement) {
                if (encodeAttempt(replacement) !== encodeAttempt(record)) throw new CheckpointConflictError('Pending captured records cannot be changed');
              } else {
                const saved = await transaction.getFirstAsync<{ record_json: string }>('SELECT record_json FROM attempt_records WHERE record_id = ?', record.recordId);
                if (!saved || saved.record_json !== encodeAttempt(record)) throw new CheckpointConflictError('Unconfirmed outbox record cannot be dropped');
              }
            }
            const update = await transaction.runAsync('UPDATE session_checkpoints SET revision = ?, status = ?, updated_at = ?, pending_count = ?, checkpoint_json = ? WHERE session_id = ? AND revision = ? AND discarded = 0', checkpoint.revision, checkpoint.status, checkpoint.updatedAt, checkpoint.pendingCount, captured.encoded, checkpoint.sessionId, expectedRevision);
            if (update.changes !== 1) throw new CheckpointConflictError('Checkpoint changed concurrently');
          } else {
            if (expectedRevision !== null) throw new CheckpointConflictError('Expected checkpoint does not exist');
            await transaction.runAsync('INSERT INTO session_checkpoints (session_id, kind, revision, fixture, status, updated_at, pending_count, discarded, checkpoint_json) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)', checkpoint.sessionId, checkpoint.kind, checkpoint.revision, checkpoint.fixture ? 1 : 0, checkpoint.status, checkpoint.updatedAt, checkpoint.pendingCount, captured.encoded);
          }
        });
        return Object.freeze({ status, sessionId: checkpoint.sessionId, revision: checkpoint.revision });
      });
    },
    findCheckpoint(sessionId: string): Promise<StoredCheckpoint | null> {
      return queued(async () => { const row = await db.getFirstAsync<Row>('SELECT * FROM session_checkpoints WHERE session_id = ?', sessionId); return row ? stored(row, encodeAttempt) : null; });
    },
    listCheckpoints(mode: 'resumable' | 'outbox', limit = 50, offset = 0): Promise<readonly StoredCheckpoint[]> {
      if (!['resumable', 'outbox'].includes(mode) || !Number.isInteger(limit) || limit < 1 || limit > 1000 || !Number.isInteger(offset) || offset < 0) return Promise.reject(new Error('Invalid checkpoint page'));
      return queued(async () => {
        const filter = mode === 'resumable' ? "discarded = 0 AND status = 'active'" : 'pending_count > 0';
        const rows = await db.getAllAsync<Row>('SELECT * FROM session_checkpoints WHERE ' + filter + ' ORDER BY updated_at DESC, session_id LIMIT ? OFFSET ?', limit, offset);
        return Object.freeze(rows.map(row => stored(row, encodeAttempt)));
      });
    },
    discardCheckpoint(sessionId: string, expectedRevision: number): Promise<'discarded' | 'already_discarded'> {
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) return Promise.reject(new Error('Invalid discard revision'));
      return queued(async () => {
        let result: 'discarded' | 'already_discarded' = 'discarded';
        await db.withExclusiveTransactionAsync(async transaction => {
          const row = await transaction.getFirstAsync<Row>('SELECT * FROM session_checkpoints WHERE session_id = ?', sessionId);
          if (!row || row.revision !== expectedRevision) throw new CheckpointConflictError('Discard target changed or does not exist');
          const current = stored(row, encodeAttempt);
          if (current.discarded) { result = 'already_discarded'; return; }
          const update = await transaction.runAsync('UPDATE session_checkpoints SET discarded = 1 WHERE session_id = ? AND revision = ? AND discarded = 0', sessionId, expectedRevision);
          if (update.changes !== 1) throw new CheckpointConflictError('Discard target changed concurrently');
        });
        return result;
      });
    }
  });
}
