import { randomUUID } from 'expo-crypto';
import type { PracticeSession } from '../core/practice-session.ts';
import type { OpenPractice } from '../core/open-practice.ts';
import { createChoiceAttemptRecord, createOpenAttemptRecord } from './attempt-records.ts';
import type { AttemptRecord } from './attempt-records.ts';
import { AttemptConflictError, openAttemptRepository } from './attempt-repository.ts';
import { reconcilePersistedCheckpoint } from './persisted-recovery.ts';
import { sameRecoveryValue } from './recovery-choice.ts';
export type AttemptSaveSnapshot = Readonly<{
  recordId: string; sessionId: string; kind: 'choice' | 'open'; fixture: boolean; objective: boolean;
  status: 'ready' | 'saving' | 'saved' | 'unconfirmed' | 'conflict';
  receipt: 'saved' | 'already_saved' | null; message: string;
}>;
export type AttemptSaveController = Readonly<{
  getRecord: () => AttemptRecord;
  getSnapshot: () => AttemptSaveSnapshot;
  subscribe: (listener: () => void) => () => void;
  save: () => Promise<AttemptSaveSnapshot>;
}>;
type SaveJob = Readonly<{ controller: AttemptSaveController; confirmSaved: () => void }>;
function newId(): string {
  const id = randomUUID();
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error('A native UUID could not be generated');
  return id;
}
export function newPracticeSessionId(): string { return newId(); }
const jobs = new Map<string, SaveJob>();
function key(sessionId: string, kind: 'choice' | 'open', packId: string, version: string, language: string, questionId: string, revision: number): string {
  return JSON.stringify([sessionId, kind, packId, version, language, questionId, revision]);
}
function recordKey(record: AttemptRecord): string {
  return key(record.sessionId, record.kind, record.packId, record.contentVersion, record.language, record.questionId, record.questionRevision);
}
function createJob(value: AttemptRecord, initial: 'captured' | 'outstanding' | 'acknowledged' = 'captured'): SaveJob {
  const record: AttemptRecord = Object.freeze({ ...value });
  const identity = { recordId: record.recordId, sessionId: record.sessionId, kind: record.kind, fixture: record.fixture, objective: record.objective };
  let snapshot: AttemptSaveSnapshot = Object.freeze({
    ...identity, status: initial === 'acknowledged' ? 'saved' : initial === 'outstanding' ? 'unconfirmed' : 'ready',
    receipt: initial === 'acknowledged' ? 'already_saved' : null,
    message: initial === 'acknowledged' ? 'Identical captured record confirmed by recovery lookup.' : initial === 'outstanding' ? 'Recovered captured record; no saved row found during reconciliation. No retry has been started.' : 'Captured in memory; not yet confirmed saved.'
  });
  let pending: Promise<AttemptSaveSnapshot> | null = null;
  const listeners = new Set<() => void>();
  function publish(status: AttemptSaveSnapshot['status'], message: string, receipt: AttemptSaveSnapshot['receipt'] = null) {
    snapshot = Object.freeze({ ...identity, status, receipt, message });
    for (const listener of [...listeners]) { try { listener(); } catch { /* UI listeners do not change the storage outcome. */ } }
  }
  const controller: AttemptSaveController = Object.freeze({
    getRecord: () => record,
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
  return Object.freeze({ controller, confirmSaved() {
    if (pending || snapshot.status === 'saving' || snapshot.status === 'conflict') throw new Error('Controller cannot accept recovery confirmation in its current state');
    if (snapshot.status !== 'saved') publish('saved', 'Identical captured record confirmed by recovery lookup.', 'already_saved');
  } });
}
export function prepareChoiceSave(session: PracticeSession, questionId: string): AttemptSaveController {
  const question = session.questions.find(item => item.id === questionId);
  if (!question) throw new Error('Question snapshot unavailable');
  const jobKey = key(session.sessionId, 'choice', session.content.packId, session.content.contentVersion, session.content.language, question.id, question.revision);
  const existing = jobs.get(jobKey);
  if (existing) return existing.controller;
  const record = createChoiceAttemptRecord({ recordId: newId(), recordedAt: Date.now(), session, questionId });
  const job = createJob(record); jobs.set(jobKey, job); return job.controller;
}
export function prepareOpenSave(state: OpenPractice): AttemptSaveController {
  const jobKey = key(state.sessionId, 'open', state.content.packId, state.content.contentVersion, state.content.language, state.question.id, state.question.revision);
  const existing = jobs.get(jobKey);
  if (existing) return existing.controller;
  const record = createOpenAttemptRecord({ recordId: newId(), recordedAt: Date.now(), state });
  const job = createJob(record); jobs.set(jobKey, job); return job.controller;
}
export function sessionSaveControllers(sessionId: string): readonly AttemptSaveController[] {
  return Object.freeze([...jobs.values()].map(job => job.controller).filter(controller => controller.getSnapshot().sessionId === sessionId));
}
export function sessionSaveRecords(sessionId: string): readonly AttemptRecord[] {
  return Object.freeze(sessionSaveControllers(sessionId).map(controller => controller.getRecord()));
}
export function restoreSessionSaveControllers(storedJson: unknown, observationsJson: unknown): readonly AttemptSaveController[] {
  const reconciled = reconcilePersistedCheckpoint(storedJson, observationsJson);
  const acknowledged = new Set(reconciled.acknowledged.map(record => record.recordId));
  const retainedById = new Map([...jobs.entries()].map(([jobKey, job]) => [job.controller.getRecord().recordId, { jobKey, job }]));
  const plan = reconciled.recovery.pending.map(record => {
    const jobKey = recordKey(record); const existing = jobs.get(jobKey); const sameId = retainedById.get(record.recordId);
    if (sameId && sameId.jobKey !== jobKey) throw new Error('Recovered record ID is already bound to another logical outcome');
    if (existing) {
      if (!sameRecoveryValue(existing.controller.getRecord(), record)) throw new Error('Recovered outcome differs from its retained record');
      const status = existing.controller.getSnapshot().status;
      if (status === 'saving' || status === 'conflict') throw new Error('Recovery cannot replace an in-flight or conflicted controller');
      if (status === 'saved' && !acknowledged.has(record.recordId)) throw new Error('Recovery lookup disagrees with an existing save confirmation');
    }
    return { record, jobKey, existing, confirmed: acknowledged.has(record.recordId) };
  });
  const prepared = plan.map(item => ({ ...item, job: item.existing ?? createJob(item.record, item.confirmed ? 'acknowledged' : 'outstanding') }));
  for (const item of prepared) if (!item.existing) jobs.set(item.jobKey, item.job);
  for (const item of prepared) if (item.confirmed && item.existing) item.job.confirmSaved();
  return Object.freeze(prepared.map(item => item.job.controller));
}
