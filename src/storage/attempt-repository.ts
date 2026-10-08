import { Platform } from 'react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { AttemptRecord } from './attempt-records.ts';
import { ATTEMPT_DATABASE_NAME, ATTEMPT_SCHEMA_VERSION, ATTEMPT_SCHEMA_V1, ATTEMPT_SCHEMA_V2 } from './attempt-schema.ts';
import { attachCheckpointRepository } from './checkpoint-repository.ts';
import type { CheckpointRepository } from './checkpoint-repository.ts';
export type AttemptSaveResult = Readonly<{ status: 'saved' | 'already_saved'; recordId: string }>;
export type AttemptRepository = CheckpointRepository & Readonly<{
  append: (record: AttemptRecord) => Promise<AttemptSaveResult>;
  findById: (recordId: string) => Promise<AttemptRecord | null>;
  listSession: (sessionId: string, limit?: number, offset?: number) => Promise<readonly AttemptRecord[]>;
}>;
export class AttemptConflictError extends Error {
  constructor(message: string) { super(message); this.name = 'AttemptConflictError'; }
}
function encode(record: AttemptRecord): string {
  if (record.schemaVersion !== 1 || !record.recordId.trim() || record.recordId.length > 128 || !record.sessionId.trim()) throw new Error('Invalid attempt record identity');
  if (typeof record.fixture !== 'boolean' || !((record.kind === 'choice' && record.objective === true) || (record.kind === 'open' && record.objective === false))) throw new Error('Invalid attempt method/context');
  if (!record.packId.trim() || !record.contentVersion.trim() || !['en', 'fr'].includes(record.language) || !record.questionId || !record.questionFamilyId || !record.primaryConceptId || !Number.isInteger(record.questionRevision) || record.questionRevision < 1) throw new Error('Invalid attempt content identity');
  if (!['beginner', 'intermediate', 'advanced', 'expert'].includes(record.level) || !['recall', 'understanding', 'application', 'diagnosis', 'design_judgement'].includes(record.dimension)) throw new Error('Invalid attempt assessment scope');
  if (!Number.isFinite(record.committedAt) || record.committedAt < 0 || !Number.isFinite(record.recordedAt) || record.recordedAt < record.committedAt) throw new Error('Invalid attempt record time');
  if (typeof record.payloadJson !== 'string' || typeof record.technologyScopesJson !== 'string' || !Array.isArray(JSON.parse(record.technologyScopesJson))) throw new Error('Invalid attempt snapshot encoding');
  const payload = JSON.parse(record.payloadJson);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.format !== 'devquiz.attempt.v1' || payload.kind !== record.kind || payload.objective !== record.objective || payload.fixture !== record.fixture) throw new Error('Invalid attempt payload context');
  return JSON.stringify({
    schemaVersion: record.schemaVersion, recordId: record.recordId, sessionId: record.sessionId,
    kind: record.kind, objective: record.objective, fixture: record.fixture,
    packId: record.packId, contentVersion: record.contentVersion, language: record.language,
    questionId: record.questionId, questionRevision: record.questionRevision, questionFamilyId: record.questionFamilyId,
    primaryConceptId: record.primaryConceptId, level: record.level, dimension: record.dimension,
    technologyScopesJson: record.technologyScopesJson, committedAt: record.committedAt,
    recordedAt: record.recordedAt, payloadJson: record.payloadJson
  });
}
function decode(recordJson: string): AttemptRecord {
  const value = JSON.parse(recordJson) as AttemptRecord;
  return Object.freeze(JSON.parse(encode(value)) as AttemptRecord);
}
async function migrate(db: SQLiteDatabase) {
  await db.withExclusiveTransactionAsync(async transaction => {
    const version = await transaction.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if (!version || !Number.isInteger(version.user_version) || version.user_version < 0 || version.user_version > ATTEMPT_SCHEMA_VERSION) throw new Error('Unsupported attempt database version');
    let current = version.user_version;
    if (current === 0) { await transaction.execAsync(ATTEMPT_SCHEMA_V1); current = 1; }
    if (current === 1) await transaction.execAsync(ATTEMPT_SCHEMA_V2);
  });
}
function repository(db: SQLiteDatabase): AttemptRepository {
  let tail: Promise<void> = Promise.resolve();
  function queued<T>(operation: () => Promise<T>): Promise<T> {
    const task = tail.then(operation);
    tail = task.then(() => undefined, () => undefined);
    return task;
  }
  return Object.freeze({
    ...attachCheckpointRepository(db, queued, encode),
    append(record: AttemptRecord): Promise<AttemptSaveResult> {
      let recordJson: string;
      try { recordJson = encode(record); } catch (error) { return Promise.reject(error); }
      const captured = decode(recordJson);
      return queued(async () => {
        let result: AttemptSaveResult = { status: 'saved', recordId: captured.recordId };
        await db.withExclusiveTransactionAsync(async transaction => {
          const existing = await transaction.getFirstAsync<{ record_json: string }>('SELECT record_json FROM attempt_records WHERE record_id = ?', captured.recordId);
          if (existing) {
            if (existing.record_json !== recordJson) throw new AttemptConflictError('The record ID is already bound to different captured data');
            result = { status: 'already_saved', recordId: captured.recordId }; return;
          }
          const logical = await transaction.getFirstAsync<{ record_id: string }>('SELECT record_id FROM attempt_records WHERE session_id = ? AND pack_id = ? AND content_version = ? AND language = ? AND question_id = ? AND question_revision = ? AND kind = ?', captured.sessionId, captured.packId, captured.contentVersion, captured.language, captured.questionId, captured.questionRevision, captured.kind);
          if (logical) throw new AttemptConflictError('This session/question outcome already has a different record ID');
          await transaction.runAsync('INSERT INTO attempt_records (record_id, session_id, pack_id, content_version, language, question_id, question_revision, kind, objective, fixture, committed_at, recorded_at, record_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', captured.recordId, captured.sessionId, captured.packId, captured.contentVersion, captured.language, captured.questionId, captured.questionRevision, captured.kind, captured.objective ? 1 : 0, captured.fixture ? 1 : 0, captured.committedAt, captured.recordedAt, recordJson);
        });
        return Object.freeze(result);
      });
    },
    findById(recordId: string): Promise<AttemptRecord | null> {
      return queued(async () => {
        const row = await db.getFirstAsync<{ record_json: string }>('SELECT record_json FROM attempt_records WHERE record_id = ?', recordId);
        return row ? decode(row.record_json) : null;
      });
    },
    listSession(sessionId: string, limit = 100, offset = 0): Promise<readonly AttemptRecord[]> {
      if (!Number.isInteger(limit) || limit < 1 || limit > 1000 || !Number.isInteger(offset) || offset < 0) return Promise.reject(new Error('Invalid history page'));
      return queued(async () => {
        const rows = await db.getAllAsync<{ record_json: string }>('SELECT record_json FROM attempt_records WHERE session_id = ? ORDER BY committed_at, record_id LIMIT ? OFFSET ?', sessionId, limit, offset);
        return Object.freeze(rows.map(row => decode(row.record_json)));
      });
    }
  });
}
let opening: Promise<AttemptRepository> | null = null;
export function openAttemptRepository(): Promise<AttemptRepository> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return Promise.reject(new Error('Attempt storage currently supports native iOS and Android only'));
  if (!opening) {
    opening = (async () => {
      const db = await openDatabaseAsync(ATTEMPT_DATABASE_NAME);
      try {
        await db.execAsync('PRAGMA journal_mode = WAL;');
        await migrate(db);
        return repository(db);
      } catch (error) {
        await db.closeAsync().catch(() => undefined); throw error;
      }
    })().catch(error => { opening = null; throw error; });
  }
  return opening;
}
