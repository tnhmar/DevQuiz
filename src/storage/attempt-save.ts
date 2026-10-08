import { randomUUID } from 'expo-crypto';
import type { PracticeSession } from '../core/practice-session.ts';
import type { OpenPractice } from '../core/open-practice.ts';
import { createChoiceAttemptRecord, createOpenAttemptRecord } from './attempt-records.ts';
import type { AttemptRecord } from './attempt-records.ts';
import { AttemptConflictError, openAttemptRepository } from './attempt-repository.ts';
export type AttemptSaveSnapshot = Readonly<{
  recordId: string; sessionId: string; kind: 'choice' | 'open'; fixture: boolean; objective: boolean;
  status: 'ready' | 'saving' | 'saved' | 'unconfirmed' | 'conflict';
  receipt: 'saved' | 'already_saved' | null; message: string;
}>;
export type AttemptSaveController = Readonly<{
  getSnapshot: () => AttemptSaveSnapshot;
  subscribe: (listener: () => void) => () => void;
  save: () => Promise<AttemptSaveSnapshot>;
}>;
function newId(): string {
  const id = randomUUID();
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error('A native UUID could not be generated');
  return id;
}
export function newPracticeSessionId(): string { return newId(); }
const jobs = new Map<string, AttemptSaveController>();
function key(sessionId: string, kind: 'choice' | 'open', packId: string, version: string, language: string, questionId: string, revision: number): string {
  return JSON.stringify([sessionId, kind, packId, version, language, questionId, revision]);
}
function controller(record: AttemptRecord): AttemptSaveController {
  const identity = { recordId: record.recordId, sessionId: record.sessionId, kind: record.kind, fixture: record.fixture, objective: record.objective };
  let snapshot: AttemptSaveSnapshot = Object.freeze({ ...identity, status: 'ready', receipt: null, message: 'Captured in memory; not yet confirmed saved.' });
  let pending: Promise<AttemptSaveSnapshot> | null = null;
  const listeners = new Set<() => void>();
  function publish(status: AttemptSaveSnapshot['status'], message: string, receipt: AttemptSaveSnapshot['receipt'] = null) {
    snapshot = Object.freeze({ ...identity, status, receipt, message });
    for (const listener of [...listeners]) { try { listener(); } catch { /* UI listeners do not change the storage outcome. */ } }
  }
  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    save(): Promise<AttemptSaveSnapshot> {
      if (pending) return pending;
      if (snapshot.status === 'saved' || snapshot.status === 'conflict') return Promise.resolve(snapshot);
      publish('saving', 'Saving this exact captured record locally.');
      pending = (async () => {
        try {
          const repository = await openAttemptRepository();
          const receipt = await repository.append(record);
          if (receipt.recordId !== record.recordId || (receipt.status !== 'saved' && receipt.status !== 'already_saved')) throw new Error('Unexpected save receipt');
          publish('saved', receipt.status === 'already_saved' ? 'Identical captured record already saved locally.' : 'Captured record confirmed saved locally.', receipt.status);
        } catch (error) {
          if (error instanceof AttemptConflictError) publish('conflict', 'Save conflict: existing history differs. No historical record was replaced.');
          else publish('unconfirmed', 'Local save is not confirmed. Retry reuses the same record ID and captured data; the previous write may have succeeded.');
        }
        return snapshot;
      })();
      pending = pending.finally(() => { pending = null; });
      return pending;
    }
  });
}
export function prepareChoiceSave(session: PracticeSession, questionId: string): AttemptSaveController {
  const question = session.questions.find(item => item.id === questionId);
  if (!question) throw new Error('Question snapshot unavailable');
  const jobKey = key(session.sessionId, 'choice', session.content.packId, session.content.contentVersion, session.content.language, question.id, question.revision);
  const existing = jobs.get(jobKey);
  if (existing) return existing;
  const record = createChoiceAttemptRecord({ recordId: newId(), recordedAt: Date.now(), session, questionId });
  const job = controller(record); jobs.set(jobKey, job); return job;
}
export function prepareOpenSave(state: OpenPractice): AttemptSaveController {
  const jobKey = key(state.sessionId, 'open', state.content.packId, state.content.contentVersion, state.content.language, state.question.id, state.question.revision);
  const existing = jobs.get(jobKey);
  if (existing) return existing;
  const record = createOpenAttemptRecord({ recordId: newId(), recordedAt: Date.now(), state });
  const job = controller(record); jobs.set(jobKey, job); return job;
}
export function sessionSaveControllers(sessionId: string): readonly AttemptSaveController[] {
  return Object.freeze([...jobs.values()].filter(job => job.getSnapshot().sessionId === sessionId));
}
