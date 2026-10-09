import type { PracticeSession } from '../core/practice-session.ts';
import type { OpenPractice } from '../core/open-practice.ts';
import type { PracticeSelection } from '../core/practice-selection.ts';
import type { AttemptRecord } from './attempt-records.ts';
import type { CheckpointRepository, CheckpointSaveResult } from './checkpoint-repository.ts';
import { CheckpointConflictError } from './checkpoint-repository.ts';
import type { RecoveryCheckpoint } from './recovery-checkpoints.ts';
import { createChoiceCheckpoint, createOpenCheckpoint } from './recovery-checkpoints.ts';
export type PracticeCheckpointSnapshot = Readonly<{
  sessionId: string; revision: number | null;
  status: 'empty' | 'captured' | 'saving' | 'saved' | 'unconfirmed' | 'conflict';
  receipt: CheckpointSaveResult | null; message: string;
}>;
export type PracticeCheckpointController = Readonly<{
  getSnapshot: () => PracticeCheckpointSnapshot;
  getCheckpoint: () => RecoveryCheckpoint | null;
  subscribe: (listener: () => void) => () => void;
  captureChoice: (session: PracticeSession, selection: PracticeSelection, pendingRecords: readonly AttemptRecord[], updatedAt: number) => Promise<PracticeCheckpointSnapshot>;
  captureOpen: (state: OpenPractice, pendingRecords: readonly AttemptRecord[], updatedAt: number) => Promise<PracticeCheckpointSnapshot>;
  retryExact: () => Promise<PracticeCheckpointSnapshot>;
}>;
export function createPracticeCheckpointController(
  repository: Pick<CheckpointRepository, 'saveCheckpoint'>,
  sessionId: string
): PracticeCheckpointController {
  if (!sessionId.trim()) throw new Error('Checkpoint session ID is required');
  let revision: number | null = null;
  let committed: RecoveryCheckpoint | null = null;
  let proposed: RecoveryCheckpoint | null = null;
  let pending: Promise<PracticeCheckpointSnapshot> | null = null;
  let queuedCapture: (() => RecoveryCheckpoint) | null = null;
  let snapshot: PracticeCheckpointSnapshot = Object.freeze({ sessionId, revision, status: 'empty', receipt: null, message: 'No checkpoint has been captured.' });
  const listeners = new Set<() => void>();
  function publish(status: PracticeCheckpointSnapshot['status'], message: string, receipt: CheckpointSaveResult | null = null) {
    snapshot = Object.freeze({ sessionId, revision, status, receipt, message });
    for (const listener of [...listeners]) { try { listener(); } catch { /* UI listeners cannot affect persistence. */ } }
  }
  function makeNext(build: () => RecoveryCheckpoint, updatedAt: number): RecoveryCheckpoint {
    if (proposed && snapshot.status === 'unconfirmed') throw new Error('An uncertain checkpoint write must be resolved before making a newer revision');
    const base = proposed ?? committed;
    if (proposed && (snapshot.status === 'saving' || snapshot.status === 'captured')) {
      queuedCapture = build;
      throw new Error('Checkpoint write is in progress; latest state was queued for the next revision');
    }
    if (base?.status === 'completed') throw new Error('Completed checkpoint cannot return to active');
    if (base && updatedAt < base.updatedAt) throw new Error('Checkpoint capture time moved backwards');
    return build();
  }
  async function writeCurrent(): Promise<PracticeCheckpointSnapshot> {
    if (pending) return pending;
    if (!proposed) return snapshot;
    const target = proposed;
    const expectedRevision = revision;
    if (target.revision !== (expectedRevision === null ? 1 : expectedRevision + 1)) throw new Error('Checkpoint revision sequence mismatch');
    publish('saving', 'Saving the exact captured checkpoint revision.');
    pending = (async () => {
      try {
        const receipt = await repository.saveCheckpoint(target, expectedRevision);
        if (receipt.sessionId !== sessionId || receipt.revision !== target.revision || (receipt.status !== 'saved' && receipt.status !== 'already_saved')) throw new Error('Unexpected checkpoint receipt');
        committed = target; revision = target.revision; proposed = null;
        publish('saved', receipt.status === 'already_saved' ? 'Identical checkpoint revision already saved.' : 'Checkpoint revision confirmed saved.', receipt);
        if (queuedCapture) {
          const build = queuedCapture; queuedCapture = null; proposed = build(); publish('captured', 'Latest checkpoint state captured; next revision is not yet confirmed.');
        }
      } catch (error) {
        if (error instanceof CheckpointConflictError) publish('conflict', 'Checkpoint revision conflict. No overwrite or newer revision attempted.');
        else publish('unconfirmed', 'Checkpoint write is unconfirmed. Retry this exact captured revision before advancing.');
      }
      return snapshot;
    })().finally(() => { pending = null; });
    return pending;
  }
  async function capture(build: () => RecoveryCheckpoint, updatedAt: number): Promise<PracticeCheckpointSnapshot> {
    if (pending || snapshot.status === 'saving') {
      queuedCapture = build;
      return pending ?? snapshot;
    }
    const next = makeNext(build, updatedAt);
    if (next === proposed) return snapshot;
    proposed = next; revision = next.revision;
    publish('captured', 'Checkpoint state captured; persistence is not yet confirmed.');
    return writeCurrent();
  }
  return Object.freeze({
    getSnapshot: () => snapshot,
    getCheckpoint: () => proposed ?? committed,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    captureChoice(session, selection, pendingRecords, updatedAt) {
      if (session.sessionId !== sessionId) return Promise.reject(new Error('Choice checkpoint belongs to another session'));
      const build = () => createChoiceCheckpoint({ revision: (revision ?? 0) + 1, updatedAt, pendingRecords, session, selection });
      try { return capture(build, updatedAt); } catch (error) { return Promise.reject(error); }
    },
    captureOpen(state, pendingRecords, updatedAt) {
      if (state.sessionId !== sessionId) return Promise.reject(new Error('Open checkpoint belongs to another session'));
      const build = () => createOpenCheckpoint({ revision: (revision ?? 0) + 1, updatedAt, pendingRecords, state });
      try { return capture(build, updatedAt); } catch (error) { return Promise.reject(error); }
    },
    retryExact() {
      if (!proposed || (snapshot.status !== 'unconfirmed' && snapshot.status !== 'conflict' && snapshot.status !== 'captured')) return Promise.resolve(snapshot);
      if (snapshot.status === 'conflict') return Promise.resolve(snapshot);
      publish('captured', 'Retrying the exact captured checkpoint revision.');
      return writeCurrent();
    }
  });
}
