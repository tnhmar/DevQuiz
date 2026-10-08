import type { PracticeSession } from '../core/practice-session.ts';
import type { OpenPractice } from '../core/open-practice.ts';
import type { PracticeSelection } from '../core/practice-selection.ts';
import type { AttemptRecord } from './attempt-records.ts';
export type RecoveryCheckpoint = Readonly<{
  schemaVersion: 1; sessionId: string; kind: 'choice' | 'open'; revision: number;
  fixture: boolean; status: 'active' | 'completed'; updatedAt: number;
  pendingCount: number; snapshotJson: string;
}>;
type CheckpointInput = {
  revision: number; updatedAt: number; pendingRecords: readonly AttemptRecord[];
};
function checkpoint(input: CheckpointInput, sessionId: string, kind: RecoveryCheckpoint['kind'], fixture: boolean, status: RecoveryCheckpoint['status'], payload: unknown): RecoveryCheckpoint {
  if (!sessionId.trim() || !Number.isSafeInteger(input.revision) || input.revision < 1 || !Number.isFinite(input.updatedAt) || input.updatedAt < 0 || typeof fixture !== 'boolean') throw new Error('Invalid checkpoint identity or time');
  const ids = new Set<string>();
  const outcomes = new Set<string>();
  for (const record of input.pendingRecords) {
    if (record.schemaVersion !== 1 || !record.recordId.trim() || ids.has(record.recordId) || record.sessionId !== sessionId || record.kind !== kind || record.fixture !== fixture || !Number.isFinite(record.recordedAt) || record.recordedAt > input.updatedAt) throw new Error('Pending record does not match its checkpoint');
    const outcome = JSON.stringify([record.packId, record.contentVersion, record.language, record.questionId, record.questionRevision, record.kind]);
    if (outcomes.has(outcome)) throw new Error('Duplicate pending logical outcome');
    ids.add(record.recordId); outcomes.add(outcome);
  }
  return Object.freeze({
    schemaVersion: 1, sessionId, kind, revision: input.revision, fixture, status,
    updatedAt: input.updatedAt, pendingCount: input.pendingRecords.length,
    snapshotJson: JSON.stringify({ format: 'devquiz.recovery.v1', sessionId, kind, fixture, revision: input.revision, status, updatedAt: input.updatedAt, ...{ payload }, pendingRecords: input.pendingRecords })
  });
}
export function createChoiceCheckpoint(input: CheckpointInput & { session: PracticeSession; selection: PracticeSelection }): RecoveryCheckpoint {
  const { session, selection } = input;
  if (session.questions.length > 100 || selection.questions.length !== session.questions.length || selection.selected !== session.questions.length) throw new Error('Selection does not match the session snapshot');
  if (selection.questions.some((question, index) => question.id !== session.questions[index].id || question.revision !== session.questions[index].revision)) throw new Error('Selected question order/revisions changed');
  for (const record of input.pendingRecords) {
    const answer = session.answers.find(value => value.questionId === record.questionId && value.questionRevision === record.questionRevision);
    const question = session.questions.find(value => value.id === record.questionId && value.revision === record.questionRevision);
    if (!answer || !question || record.objective !== true || record.questionFamilyId !== question.questionFamilyId || record.committedAt !== answer.committedAt || record.packId !== session.content.packId || record.contentVersion !== session.content.contentVersion || record.language !== session.content.language) throw new Error('Pending choice record does not match a committed answer');
  }
  return checkpoint(input, session.sessionId, 'choice', session.fixture, session.phase === 'finished' ? 'completed' : 'active', {
    engineVersion: 'choice-session-v1', engineSnapshot: session,
    selectionSnapshot: {
      filters: selection.filters, matchingQuestions: selection.matchingQuestions, availableFamilies: selection.availableFamilies,
      requested: selection.requested, selected: selection.selected, shortfall: selection.shortfall,
      excludedFamilyVariants: selection.excludedFamilyVariants, order: selection.order, seed: selection.seed, policy: selection.policy
    }
  });
}
export function createOpenCheckpoint(input: CheckpointInput & { state: OpenPractice }): RecoveryCheckpoint {
  const { state } = input;
  for (const record of input.pendingRecords) {
    if (state.phase !== 'finished' || !state.result || record.objective !== false || record.questionId !== state.question.id || record.questionRevision !== state.question.revision || record.questionFamilyId !== state.question.questionFamilyId || record.committedAt !== state.result.rubricCommittedAt || record.packId !== state.content.packId || record.contentVersion !== state.content.contentVersion || record.language !== state.content.language) throw new Error('Pending open record does not match the finalized self-assessment');
  }
  return checkpoint(input, state.sessionId, 'open', state.fixture, state.phase === 'finished' ? 'completed' : 'active', {
    engineVersion: 'open-session-v1', engineSnapshot: state,
    modelAnswerExposure: 'not_captured', retryHistory: 'not_captured'
  });
}
