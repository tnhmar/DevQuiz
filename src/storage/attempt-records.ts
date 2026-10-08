import type { Question } from '../content/questions.ts';
import type { ContentIdentity, PracticeSession } from '../core/practice-session.ts';
import type { OpenPractice } from '../core/open-practice.ts';
type AttemptRecordBase = Readonly<{
  schemaVersion: 1; recordId: string; sessionId: string; fixture: boolean;
  packId: string; contentVersion: string; language: 'en' | 'fr';
  questionId: string; questionRevision: number; questionFamilyId: string;
  primaryConceptId: string; level: Question['level']; dimension: Question['dimension'];
  technologyScopesJson: string; committedAt: number; recordedAt: number; payloadJson: string;
}>;
export type ChoiceAttemptRecord = AttemptRecordBase & Readonly<{ kind: 'choice'; objective: true }>;
export type OpenAttemptRecord = AttemptRecordBase & Readonly<{ kind: 'open'; objective: false }>;
export type AttemptRecord = ChoiceAttemptRecord | OpenAttemptRecord;
type RecordIdentity = { recordId: string; recordedAt: number };
function header(input: RecordIdentity, sessionId: string, content: ContentIdentity, fixture: boolean, question: Question, committedAt: number): Omit<AttemptRecordBase, 'payloadJson'> {
  if (!input.recordId.trim() || input.recordId.length > 128 || !sessionId.trim()) throw new Error('Stable record and session identities are required');
  if (!content.packId.trim() || !content.contentVersion.trim() || (content.language !== 'en' && content.language !== 'fr')) throw new Error('Content identity is required');
  if (typeof fixture !== 'boolean' || !question.id || !question.questionFamilyId || !question.primaryConceptId || !Number.isInteger(question.revision) || question.revision < 1) throw new Error('Invalid attempt identity');
  if (!Number.isFinite(committedAt) || committedAt < 0 || !Number.isFinite(input.recordedAt) || input.recordedAt < committedAt) throw new Error('Invalid record timestamps');
  return {
    schemaVersion: 1, recordId: input.recordId, sessionId, fixture,
    packId: content.packId, contentVersion: content.contentVersion, language: content.language,
    questionId: question.id, questionRevision: question.revision, questionFamilyId: question.questionFamilyId,
    primaryConceptId: question.primaryConceptId, level: question.level, dimension: question.dimension,
    technologyScopesJson: JSON.stringify(question.technologyScopes), committedAt, recordedAt: input.recordedAt
  };
}
export function createChoiceAttemptRecord(input: RecordIdentity & { session: PracticeSession; questionId: string }): ChoiceAttemptRecord {
  const { session } = input;
  const matches = session.answers.filter(answer => answer.questionId === input.questionId);
  if (matches.length !== 1) throw new Error('Exactly one committed answer is required');
  const answer = matches[0];
  const question = session.questions.find(value => value.id === answer.questionId && value.revision === answer.questionRevision);
  if (!question || answer.sessionId !== session.sessionId || answer.questionFamilyId !== question.questionFamilyId || answer.fixture !== session.fixture || answer.objective !== true) throw new Error('Committed answer does not match its session snapshot');
  const hints = Object.prototype.hasOwnProperty.call(session.hintsByQuestion, question.id) ? session.hintsByQuestion[question.id] : [];
  const payloadJson = JSON.stringify({
    format: 'devquiz.attempt.v1', kind: 'choice', objective: true, fixture: session.fixture,
    contentSnapshot: session.content, questionSnapshot: question, answerSnapshot: answer,
    hintDefinitionsSnapshot: hints,
    retryContextSnapshot: { retryOfSessionId: session.retryOfSessionId, previouslyCommittedIds: session.previouslyCommittedIds, previouslyMissedIds: session.previouslyMissedIds },
    publicationChecked: false, evidenceEligibility: 'not_evaluated'
  });
  return Object.freeze({ ...header(input, session.sessionId, session.content, session.fixture, question, answer.committedAt), kind: 'choice' as const, objective: true as const, payloadJson });
}
export function createOpenAttemptRecord(input: RecordIdentity & { state: OpenPractice }): OpenAttemptRecord {
  const { state } = input;
  const result = state.result;
  if (state.phase !== 'finished' || !result || state.answerCommittedAt === null || state.submittedConfidence === null) throw new Error('A finished self-assessment is required');
  if (result.sessionId !== state.sessionId || result.response.questionId !== state.question.id || result.response.questionRevision !== state.question.revision || result.questionFamilyId !== state.question.questionFamilyId || result.fixture !== state.fixture || result.objective !== false || result.response.objective !== false) throw new Error('Self-assessment does not match its session snapshot');
  if (result.content.packId !== state.content.packId || result.content.contentVersion !== state.content.contentVersion || result.content.language !== state.content.language || result.response.text !== state.text || result.answerCommittedAt !== state.answerCommittedAt || result.rubricCommittedAt < result.answerCommittedAt || result.confidence !== state.submittedConfidence.value || result.confidenceCapturedAt !== state.submittedConfidence.capturedAt) throw new Error('Self-assessment snapshot identity mismatch');
  const payloadJson = JSON.stringify({
    format: 'devquiz.attempt.v1', kind: 'open', objective: false, fixture: state.fixture,
    contentSnapshot: state.content, questionSnapshot: state.question,
    submittedConfidenceSnapshot: state.submittedConfidence, resultSnapshot: result,
    modelAnswerExposure: 'not_captured', retryHistory: 'not_captured',
    publicationChecked: false, evidenceEligibility: 'not_evaluated'
  });
  return Object.freeze({ ...header(input, state.sessionId, state.content, state.fixture, state.question, result.rubricCommittedAt), kind: 'open' as const, objective: false as const, payloadJson });
}
