import type { RecoveryCheckpoint } from './recovery-checkpoint.ts';
export type ResumeEligibility = Readonly<{
  eligible: boolean;
  reasons: readonly string[];
}>;
const INELIGIBLE: Readonly<ResumeEligibility> = { eligible: false, reasons: [] as string[] };
function ineligible(reason: string): ResumeEligibility { return { eligible: false, reasons: [reason] }; }
const ELIGIBLE: Readonly<ResumeEligibility> = { eligible: true, reasons: [] };
export function checkResumeEligibility(
  checkpoint: RecoveryCheckpoint,
  flags: Readonly<{
    isActive: boolean;
    isAuthorized: boolean;
    hasMatchingPending: boolean;
    receiptsMatch: boolean;
    isWithinWindow: boolean;
  }>
): ResumeEligibility {
  if (checkpoint.status === 'discarded') return ineligible('discarded');
  if (!flags.isActive) return ineligible('not-active');
  if (!flags.isAuthorized) return ineligible('not-authorized');
  if (!flags.hasMatchingPending) return ineligible('no-matching-pending');
  if (!flags.receiptsMatch) return ineligible('receipts-mismatch');
  if (!flags.isWithinWindow) return ineligible('outside-window');
  return ELIGIBLE;
}
