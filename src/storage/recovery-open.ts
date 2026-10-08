import type { OpenConfidenceSnapshot, OpenPractice, OpenPracticeResult, OpenQuestion, RubricRating } from '../core/open-practice.ts';
import { array, boolean, id, integer, object, oneOf, parseRecoveryJson, requireValue, text, time } from './recovery-guards.ts';
import { decodeQuestion } from './recovery-questions.ts';
import { decodeRecoveryConfidence, decodeRecoveryContent, freezeRecovery, sameRecoveryValue } from './recovery-choice.ts';
function rubricRatings(value: unknown, question: OpenQuestion, complete: boolean): Readonly<Record<string, RubricRating>> {
  const criterionIds = question.rubric.map(criterion => criterion.id);
  const source = object(value, complete ? criterionIds : [], complete ? [] : criterionIds);
  const result: Record<string, RubricRating> = Object.create(null);
  for (const [criterionId, rating] of Object.entries(source)) result[criterionId] = integer(rating, 0, 2) as RubricRating;
  return result;
}
function resultSnapshot(value: unknown, state: Omit<OpenPractice, 'result'>, cutoff: number): OpenPracticeResult {
  const result = object(value, ['sessionId', 'questionFamilyId', 'content', 'fixture', 'response', 'answerCommittedAt', 'rubricCommittedAt', 'objective', 'confidence', 'confidenceCapturedAt', 'subjectivePoints', 'maxSubjectivePoints', 'criticalRatings', 'scoringPolicy']);
  requireValue(state.answerCommittedAt !== null && state.submittedConfidence !== null, 'Finished open state lacks a committed answer');
  requireValue(result.sessionId === state.sessionId && result.questionFamilyId === state.question.questionFamilyId && result.fixture === state.fixture && result.objective === false && result.scoringPolicy === 'self-rubric-v1', 'Open result identity/method mismatch');
  const content = decodeRecoveryContent(result.content);
  requireValue(sameRecoveryValue(content, state.content), 'Open result content version changed');
  const answerCommittedAt = time(result.answerCommittedAt); const rubricCommittedAt = time(result.rubricCommittedAt);
  requireValue(answerCommittedAt === state.answerCommittedAt && rubricCommittedAt >= answerCommittedAt && rubricCommittedAt <= cutoff, 'Open result commit times disagree');
  const confidence = decodeRecoveryConfidence(result.confidence, result.confidenceCapturedAt, answerCommittedAt);
  requireValue(confidence.confidence === state.submittedConfidence.value && confidence.confidenceCapturedAt === state.submittedConfidence.capturedAt, 'Open result changed submitted confidence');
  const response = object(result.response, ['type', 'questionId', 'questionRevision', 'text', 'criterionRatings', 'objective']);
  requireValue(response.type === 'open' && response.questionId === state.question.id && response.questionRevision === state.question.revision && response.objective === false && text(response.text, 0) === state.text, 'Open result changed the locked written response');
  const criterionRatings = rubricRatings(response.criterionRatings, state.question, true);
  requireValue(sameRecoveryValue(criterionRatings, state.ratings), 'Open result changed criterion ratings');
  const subjectivePoints = integer(result.subjectivePoints, 0, state.question.rubric.length * 2);
  const maxSubjectivePoints = integer(result.maxSubjectivePoints, 1, 40);
  requireValue(subjectivePoints === Object.values(criterionRatings).reduce<number>((sum, rating) => sum + rating, 0) && maxSubjectivePoints === state.question.rubric.length * 2, 'Stored rubric totals are inconsistent');
  const critical = state.question.rubric.filter(criterion => criterion.critical);
  const criticalRatings = array(result.criticalRatings, critical.length, critical.length).map((value, index) => {
    const entry = object(value, ['criterionId', 'rating']);
    const criterionId = id(entry.criterionId); const rating = integer(entry.rating, 0, 2) as RubricRating;
    requireValue(criterionId === critical[index].id && rating === criterionRatings[criterionId], 'Critical criterion result changed');
    return { criterionId, rating };
  });
  return {
    sessionId: state.sessionId, questionFamilyId: state.question.questionFamilyId, content, fixture: state.fixture,
    response: { type: 'open', questionId: state.question.id, questionRevision: state.question.revision, text: state.text, criterionRatings, objective: false },
    answerCommittedAt, rubricCommittedAt, objective: false, confidence: confidence.confidence, confidenceCapturedAt: confidence.confidenceCapturedAt,
    subjectivePoints, maxSubjectivePoints, criticalRatings, scoringPolicy: 'self-rubric-v1'
  };
}
function openState(value: unknown, cutoff: number): OpenPractice {
  const source = object(value, ['sessionId', 'content', 'fixture', 'question', 'phase', 'text', 'confidence', 'confidenceCapturedAt', 'submittedConfidence', 'ratings', 'answerCommittedAt', 'result']);
  const sessionId = id(source.sessionId); const content = decodeRecoveryContent(source.content); const fixture = boolean(source.fixture);
  const question = decodeQuestion(source.question);
  requireValue(question.type === 'open', 'Choice question in open recovery');
  const phase = oneOf(source.phase, ['writing', 'rating', 'finished']);
  const responseText = text(source.text, 0);
  const confidence = decodeRecoveryConfidence(source.confidence, source.confidenceCapturedAt, cutoff);
  const ratings = rubricRatings(source.ratings, question, phase === 'finished');
  const answerCommittedAt = source.answerCommittedAt === null ? null : time(source.answerCommittedAt);
  requireValue(answerCommittedAt === null || answerCommittedAt <= cutoff, 'Written submission is after the snapshot');
  let submittedConfidence: OpenConfidenceSnapshot | null = null;
  if (source.submittedConfidence !== null) {
    const snapshot = object(source.submittedConfidence, ['value', 'capturedAt']);
    const submitted = decodeRecoveryConfidence(snapshot.value, snapshot.capturedAt, answerCommittedAt ?? cutoff);
    submittedConfidence = { value: submitted.confidence, capturedAt: submitted.confidenceCapturedAt };
  }
  if (phase === 'writing') {
    requireValue(answerCommittedAt === null && submittedConfidence === null && source.result === null && Object.keys(ratings).length === 0, 'Writing state already contains submission/rubric outcomes');
  } else {
    requireValue(responseText.trim().length > 0 && answerCommittedAt !== null && submittedConfidence !== null, 'Submitted open state lacks a locked nonblank answer/confidence snapshot');
    requireValue(confidence.confidence === submittedConfidence.value && confidence.confidenceCapturedAt === submittedConfidence.capturedAt && (confidence.confidenceCapturedAt === null || confidence.confidenceCapturedAt <= answerCommittedAt), 'Confidence changed after submission');
    if (phase === 'rating') requireValue(source.result === null, 'Rating state already contains a finalized result');
    else requireValue(source.result !== null, 'Finished open state lacks its finalized result');
  }
  const state: Omit<OpenPractice, 'result'> = { sessionId, content, fixture, question, phase, text: responseText, confidence: confidence.confidence, confidenceCapturedAt: confidence.confidenceCapturedAt, submittedConfidence, ratings, answerCommittedAt };
  return { ...state, result: phase === 'finished' ? resultSnapshot(source.result, state, cutoff) : null };
}
export function decodeOpenRecoveryPayload(payloadJson: unknown, capturedAt: unknown): Readonly<{ state: OpenPractice }> {
  const cutoff = time(capturedAt);
  const payload = object(parseRecoveryJson(payloadJson), ['engineVersion', 'engineSnapshot', 'modelAnswerExposure', 'retryHistory']);
  requireValue(payload.engineVersion === 'open-session-v1', 'Unsupported open recovery engine version');
  requireValue(payload.modelAnswerExposure === 'not_captured' && payload.retryHistory === 'not_captured', 'Unsupported open exposure/retry metadata');
  return freezeRecovery({ state: openState(payload.engineSnapshot, cutoff) });
}
