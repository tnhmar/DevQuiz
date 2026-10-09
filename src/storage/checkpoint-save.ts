import type { RecoveryCheckpoint } from './recovery-checkpoints.ts';
import type { CheckpointRepository, CheckpointSaveResult } from './checkpoint-repository.ts';
import { CheckpointConflictError } from './checkpoint-repository.ts';
import type { RecoveryReadRepository } from './recovery-loader.ts';
import type { CheckpointReceiptPlan } from './checkpoint-revision.ts';
import { prepareCheckpointReceiptRevision } from './checkpoint-revision.ts';
import { decodePersistedCheckpoint } from './persisted-recovery.ts';
import { integer, requireValue } from './recovery-guards.ts';
export type CheckpointSaveSnapshot = Readonly<{
  sessionId: string; revision: number; expectedRevision: number | null;
  status: 'ready' | 'saving' | 'saved' | 'unconfirmed' | 'conflict';
  receipt: CheckpointSaveResult | null; message: string;
}>;
export type CheckpointSaveController = Readonly<{
  getCheckpoint: () => RecoveryCheckpoint;
  getSnapshot: () => CheckpointSaveSnapshot;
  subscribe: (listener: () => void) => () => void;
  save: () => Promise<CheckpointSaveSnapshot>;
}>;
export function createCheckpointSaveController(
  repository: Pick<CheckpointRepository, 'saveCheckpoint'>,
  value: RecoveryCheckpoint,
  requestedExpectedRevision: number | null
): CheckpointSaveController {
  const checkpoint = decodePersistedCheckpoint(JSON.stringify({ checkpoint: value, discarded: false })).checkpoint;
  const expectedRevision = requestedExpectedRevision === null ? null : integer(requestedExpectedRevision, 1, Number.MAX_SAFE_INTEGER - 1);
  requireValue(checkpoint.revision === (expectedRevision === null ? 1 : expectedRevision + 1), 'Checkpoint write must advance exactly one revision');
  const identity = { sessionId: checkpoint.sessionId, revision: checkpoint.revision, expectedRevision };
  let snapshot: CheckpointSaveSnapshot = Object.freeze({ ...identity, status: 'ready', receipt: null, message: 'Checkpoint captured for an explicit write; durability is not confirmed.' });
  let pending: Promise<CheckpointSaveSnapshot> | null = null;
  const listeners = new Set<() => void>();
  function publish(status: CheckpointSaveSnapshot['status'], message: string, receipt: CheckpointSaveResult | null = null) {
    snapshot = Object.freeze({ ...identity, status, receipt });
    snapshot = Object.freeze({ ...snapshot, message });
    for (const listener of [...listeners]) { try { listener(); } catch { /* Listeners cannot change a storage receipt. */ } }
  }
  return Object.freeze({
    getCheckpoint: () => checkpoint,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    save(): Promise<CheckpointSaveSnapshot> {
      if (pending) return pending;
      if (snapshot.status === 'saved' || snapshot.status === 'conflict') return Promise.resolve(snapshot);
      pending = Promise.resolve().then(async () => {
        try {
          const result = await repository.saveCheckpoint(checkpoint, expectedRevision);
          if (result.sessionId !== checkpoint.sessionId || result.revision !== checkpoint.revision || (result.status !== 'saved' && result.status !== 'already_saved')) throw new Error('Unexpected checkpoint receipt');
          const receipt: CheckpointSaveResult = Object.freeze({ status: result.status, sessionId: result.sessionId, revision: result.revision });
          publish('saved', result.status === 'already_saved' ? 'This identical checkpoint revision was already saved.' : 'This captured checkpoint revision is confirmed saved.', receipt);
        } catch (error) {
          if (error instanceof CheckpointConflictError) publish('conflict', 'Checkpoint conflict. No newer revision or discarded session was replaced.');
          else publish('unconfirmed', 'Checkpoint save is unconfirmed. Retry keeps the identical revision, capture time and snapshot; the previous write may have succeeded.');
        }
        return snapshot;
      }).finally(() => { pending = null; });
      publish('saving', 'Saving this exact captured checkpoint revision.');
      return pending;
    }
  });
}
export async function prepareReceiptRevisionSaveController(
  repository: RecoveryReadRepository & Pick<CheckpointRepository, 'saveCheckpoint'>,
  sessionId: string,
  revision: number,
  updatedAt: number
): Promise<Readonly<{ plan: CheckpointReceiptPlan; controller: CheckpointSaveController | null }>> {
  const plan = await prepareCheckpointReceiptRevision(repository, sessionId, revision, updatedAt);
  const controller = plan.action === 'save-checkpoint' ? createCheckpointSaveController(repository, plan.checkpoint, plan.expectedRevision) : null;
  return Object.freeze({ plan, controller });
}
