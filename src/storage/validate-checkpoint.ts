import type { RecoveryCheckpoint } from './recovery-checkpoint.ts';
import type { PracticeSession } from '../core/practice-session.ts';
import type { OpenPractice } from '../core/open-practice.ts';
import type { PracticeAnswer } from '../core/practice-session.ts';
import type { OpenPracticeResult } from '../core/open-practice.ts';
export type PendingRecord = Readonly<{
  kind: 'attempt' | 'save';
  id: string;
  sessionId: string;
  questionId: string;
  questionRevision: number;
  answerCommittedAt: number;
  isAcknowledged: boolean;
  failureReason: string | null;
}>;
export type Receipt = Readonly<{
  kind: 'acknowledged' | 'failed' | 'conflict';
  pendingId: string;
  savedAt: number | null;
  error: string | null;
}>;
export type OutstandingJob = Readonly<{
  kind: 'pending-attempt' | 'pending-save' | 'retry-save';
  pendingId: string;
  sessionId: string;
  questionId: string;
  questionRevision: number;
  answerCommittedAt: number;
}>;
export type ValidatedCheckpoint = Readonly<{
  checkpoint: RecoveryCheckpoint;
  pending: readonly PendingRecord[];
  receipts: readonly Receipt[];
  outstanding: readonly OutstandingJob[];
}>;
function validateCheckpointHeader(stored: Readonly<{ id: string; version: string; createdAt: number; updatedAt: number; status: 'active' | 'discarded'; discard: unknown }>, decoded: RecoveryCheckpoint): void {
  if (stored.id !== decoded.checkpointId) throw new Error('Checkpoint ID mismatch');
  if (stored.version !== 'ui-05d-v1') throw new Error('Unsupported checkpoint version');
  if (stored.createdAt !== decoded.createdAt) throw new Error('Checkpoint createdAt mismatch');
  if (stored.updatedAt !== decoded.updatedAt) throw new Error('Checkpoint updatedAt mismatch');
  if (stored.status !== decoded.status) throw new Error('Checkpoint status mismatch');
  if (stored.status === 'discarded' && (stored.discard === null || typeof stored.discard !== 'object')) throw new Error('Discarded checkpoint lacks discard metadata');
}
function validatePendingRecords(pending: readonly PendingRecord[], session: PracticeSession | OpenPractice): void {
  for (const record of pending) {
    if (record.sessionId !== session.sessionId) throw new Error('Pending record session ID mismatch');
    if ((session as PracticeSession).questions !== undefined) {
      const question = (session as PracticeSession).questions.find(q => q.id === record.questionId);
      if (!question || question.revision !== record.questionRevision) throw new Error('Choice pending record question/revision mismatch');
      const answer = (session as PracticeSession).answers.find(a => a.questionId === record.questionId);
      if (!answer || answer.committedAt !== record.answerCommittedAt) throw new Error('Choice pending record answer-time mismatch');
    } else {
      const open = session as OpenPractice;
      if (record.questionId !== open.question.id || record.questionRevision !== open.question.revision || record.answerCommittedAt !== (open.answerCommittedAt ?? 0)) throw new Error('Open pending record mismatch');
    }
  }
}
function reconcileReceipts(pending: readonly PendingRecord[], receipts: readonly Receipt[]): readonly Receipt[] {
  const map = new Map<string, Receipt>();
  for (const receipt of receipts) {
    const existing = map.get(receipt.pendingId);
    if (!existing) { map.set(receipt.pendingId, receipt); continue; }
    if (existing.kind === 'acknowledged' && receipt.kind !== 'acknowledged') throw new Error('Receipt downgrade detected');
    if (existing.kind === 'failed' && receipt.kind === 'acknowledged') map.set(receipt.pendingId, receipt);
  }
  return Array.from(map.values());
}
function computeOutstanding(pending: readonly PendingRecord[], receipts: readonly Receipt[]): OutstandingJob[] {
  const receiptMap = new Map(receipts.map(r => [r.pendingId, r]));
  const result: OutstandingJob[] = [];
  for (const p of pending) {
    const receipt = receiptMap.get(p.id);
    if (!receipt || receipt.kind === 'failed') result.push({ kind: p.isAcknowledged ? 'retry-save' : 'pending-save', pendingId: p.id, sessionId: p.sessionId, questionId: p.questionId, questionRevision: p.questionRevision, answerCommittedAt: p.answerCommittedAt });
    else if (!p.isAcknowledged) result.push({ kind: 'pending-attempt', pendingId: p.id, sessionId: p.sessionId, questionId: p.questionId, questionRevision: p.questionRevision, answerCommittedAt: p.answerCommittedAt });
  }
  return result;
}
export function validateAndReconcileCheckpoint(
  stored: Readonly<{ id: string; version: string; createdAt: number; updatedAt: number; status: 'active' | 'discarded'; discard: unknown }>,
  decoded: RecoveryCheckpoint,
  pending: readonly PendingRecord[],
  receipts: readonly Receipt[]
): ValidatedCheckpoint {
  validateCheckpointHeader(stored, decoded);
  validatePendingRecords(pending, decoded.session);
  const reconciled = reconcileReceipts(pending, receipts);
  const outstanding = computeOutstanding(pending, reconciled);
  return { checkpoint: decoded, pending, receipts: reconciled, outstanding };
}
