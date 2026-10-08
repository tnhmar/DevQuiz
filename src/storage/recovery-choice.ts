import type { ChoiceQuestion, ContentIdentity, HintExposure, PracticeAnswer, PracticeConfidence, PracticeHint, PracticeSession, PracticeSignals } from '../core/practice-session.ts';
import type { PracticeSelection } from '../core/practice-selection.ts';
import { array, boolean, id, ids, integer, object, oneOf, parseRecoveryJson, requireValue, text, time } from './recovery-guards.ts';
import { decodeExplanation, decodeQuestion } from './recovery-questions.ts';
export function freezeRecovery<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) freezeRecovery(item);
    Object.freeze(value);
  }
  return value;
}
export function sameRecoveryValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, index) => sameRecoveryValue(value, b[index]));
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null || Array.isArray(a) || Array.isArray(b)) return false;
  const left = a as Record<string, unknown>; const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.prototype.hasOwnProperty.call(right, key) && sameRecoveryValue(left[key], right[key]));
}
export function decodeRecoveryContent(value: unknown): ContentIdentity {
  const content = object(value, ['packId', 'contentVersion', 'language']);
  return { packId: id(content.packId), contentVersion: text(content.contentVersion), language: oneOf(content.language, ['en', 'fr']) };
}
export function decodeRecoveryConfidence(value: unknown, capturedAt: unknown, cutoff: number) {
  const confidence: PracticeConfidence | null = value === null ? null : oneOf(value, ['low', 'medium', 'high']);
  requireValue((confidence === null) === (capturedAt === null), 'Confidence and capture time disagree');
  const at = capturedAt === null ? null : time(capturedAt);
  requireValue(at === null || at <= cutoff, 'Confidence capture is after its snapshot');
  return { confidence, confidenceCapturedAt: at };
}
function exposures(value: unknown, available: readonly PracticeHint[], cutoff: number): HintExposure[] {
  let previous = 0;
  const result = array(value, 0, 20).map(value => {
    const entry = object(value, ['hintId', 'revealedAt']);
    const hintId = id(entry.hintId); const revealedAt = time(entry.revealedAt);
    requireValue(available.some(hint => hint.id === hintId) && revealedAt >= previous && revealedAt <= cutoff, 'Hint exposure identity/time mismatch');
    previous = revealedAt; return { hintId, revealedAt };
  });
  requireValue(new Set(result.map(item => item.hintId)).size === result.length, 'Duplicate hint exposures');
  return result;
}
function signals(value: unknown, available: readonly PracticeHint[], cutoff: number): PracticeSignals {
  const source = object(value, ['confidence', 'confidenceCapturedAt', 'hints', 'answerRevealedAt']);
  const confidence = decodeRecoveryConfidence(source.confidence, source.confidenceCapturedAt, cutoff);
  const hints = exposures(source.hints, available, cutoff);
  const answerRevealedAt = source.answerRevealedAt === null ? null : time(source.answerRevealedAt);
  requireValue(answerRevealedAt === null || answerRevealedAt <= cutoff, 'Answer reveal is after its snapshot');
  const helpTimes = [...hints.map(item => item.revealedAt), ...(answerRevealedAt === null ? [] : [answerRevealedAt])];
  requireValue(confidence.confidenceCapturedAt === null || helpTimes.every(at => confidence.confidenceCapturedAt! <= at), 'Confidence changed after help');
  return { ...confidence, hints, answerRevealedAt };
}
function selectionIds(value: unknown, question: ChoiceQuestion, submitted: boolean): string[] {
  const selected = ids(value, submitted ? 1 : 0, question.type === 'multi' ? question.options.length : 1);
  requireValue(selected.every(value => question.options.some(option => option.id === value)), 'Selected option does not exist');
  return selected;
}
function choiceSession(value: unknown, cutoff: number): PracticeSession {
  const source = object(value, ['sessionId', 'content', 'fixture', 'questions', 'index', 'selectedOptionIds', 'answers', 'phase', 'hintsByQuestion', 'signals', 'previouslyCommittedIds', 'previouslyMissedIds', 'retryOfSessionId']);
  const sessionId = id(source.sessionId); const content = decodeRecoveryContent(source.content); const fixture = boolean(source.fixture);
  const questions = array(source.questions, 0, 100).map(value => { const question = decodeQuestion(value); requireValue(question.type !== 'open', 'Open question in choice recovery'); return question; });
  const questionIds = questions.map(question => question.id);
  requireValue(new Set(questionIds).size === questionIds.length, 'Duplicate choice recovery questions');
  const phase = oneOf(source.phase, ['empty', 'answering', 'feedback', 'finished']);
  const index = integer(source.index, 0, questions.length);
  const previouslyCommittedIds = ids(source.previouslyCommittedIds, 0, 100); const previouslyMissedIds = ids(source.previouslyMissedIds, 0, 100);
  requireValue(previouslyCommittedIds.every(value => questionIds.includes(value)) && previouslyMissedIds.every(value => previouslyCommittedIds.includes(value)), 'Invalid local retry history');
  const retryOfSessionId = source.retryOfSessionId === null ? null : id(source.retryOfSessionId);
  requireValue(retryOfSessionId !== sessionId && (retryOfSessionId !== null || (!previouslyCommittedIds.length && !previouslyMissedIds.length)), 'Invalid restart lineage');
  const registry = object(source.hintsByQuestion, [], questionIds);
  const hintsByQuestion: Record<string, readonly PracticeHint[]> = Object.create(null);
  for (const [questionId, values] of Object.entries(registry)) {
    const hints = array(values, 0, 20).map(value => { const hint = object(value, ['id', 'label', 'content']); return { id: id(hint.id), label: text(hint.label), content: decodeExplanation(hint.content) }; });
    requireValue(new Set(hints.map(hint => hint.id)).size === hints.length, 'Duplicate registered hints');
    hintsByQuestion[questionId] = hints;
  }
  const rawAnswers = array(source.answers, 0, questions.length);
  requireValue(phase === 'empty' ? !questions.length && index === 0 && !rawAnswers.length : questions.length > 0 && (phase === 'finished' ? index === questions.length && rawAnswers.length === questions.length : index < questions.length && rawAnswers.length === index + (phase === 'feedback' ? 1 : 0)), 'Phase/index/answer count mismatch');
  let lastCommit = 0;
  const answers: PracticeAnswer[] = rawAnswers.map((value, position) => {
    const answer = object(value, ['sessionId', 'questionId', 'questionRevision', 'questionFamilyId', 'selectedOptionIds', 'correct', 'points', 'maxPoints', 'committedAt', 'fixture', 'scoringPolicy', 'objective', 'firstCommitted', 'missedRetry', 'retryOfSessionId', 'hintUsed', 'hintExposures', 'answerRevealed', 'answerRevealedAt', 'confidence', 'confidenceCapturedAt']);
    const question = questions[position];
    requireValue(answer.sessionId === sessionId && answer.questionId === question.id && answer.questionRevision === question.revision && answer.questionFamilyId === question.questionFamilyId && answer.fixture === fixture && answer.objective === true && answer.scoringPolicy === 'choice-exact-v1' && answer.retryOfSessionId === retryOfSessionId, 'Committed answer identity/policy mismatch');
    const committedAt = time(answer.committedAt);
    requireValue(committedAt >= lastCommit && committedAt <= cutoff, 'Committed answers are out of time order'); lastCommit = committedAt;
    const selectedOptionIds = selectionIds(answer.selectedOptionIds, question, true);
    const correct = boolean(answer.correct); const points = integer(answer.points, 0, 1);
    const matched = selectedOptionIds.length === question.scoring.correctOptionIds.length && selectedOptionIds.every(value => question.scoring.correctOptionIds.some(id => id === value));
    requireValue(correct === matched && points === (correct ? 1 : 0) && answer.maxPoints === 1, 'Stored exact-match outcome is inconsistent');
    const captured = signals({ confidence: answer.confidence, confidenceCapturedAt: answer.confidenceCapturedAt, hints: answer.hintExposures, answerRevealedAt: answer.answerRevealedAt }, hintsByQuestion[question.id] ?? [], committedAt);
    requireValue(answer.hintUsed === (captured.hints.length > 0) && answer.answerRevealed === (captured.answerRevealedAt !== null) && answer.firstCommitted === !previouslyCommittedIds.includes(question.id) && answer.missedRetry === previouslyMissedIds.includes(question.id), 'Committed assistance/retry flags mismatch');
    return { sessionId, questionId: question.id, questionRevision: question.revision, questionFamilyId: question.questionFamilyId, selectedOptionIds, correct, points, maxPoints: 1, committedAt, fixture, scoringPolicy: 'choice-exact-v1', objective: true, firstCommitted: answer.firstCommitted as boolean, missedRetry: answer.missedRetry as boolean, retryOfSessionId, hintUsed: captured.hints.length > 0, hintExposures: captured.hints, answerRevealed: captured.answerRevealedAt !== null, answerRevealedAt: captured.answerRevealedAt, confidence: captured.confidence, confidenceCapturedAt: captured.confidenceCapturedAt };
  });
  const current = phase === 'answering' || phase === 'feedback' ? questions[index] : null;
  const currentSignals = signals(source.signals, current ? hintsByQuestion[current.id] ?? [] : [], cutoff);
  const selectedOptionIds = current ? selectionIds(source.selectedOptionIds, current, phase === 'feedback') : ids(source.selectedOptionIds, 0, 0);
  if (!current) requireValue(currentSignals.confidence === null && !currentSignals.hints.length && currentSignals.answerRevealedAt === null, 'Inactive session retained current-question signals');
  if (phase === 'feedback') {
    const answer = answers[index];
    requireValue(sameRecoveryValue(selectedOptionIds, answer.selectedOptionIds) && sameRecoveryValue(currentSignals, { confidence: answer.confidence, confidenceCapturedAt: answer.confidenceCapturedAt, hints: answer.hintExposures, answerRevealedAt: answer.answerRevealedAt }), 'Feedback differs from the locked answer snapshot');
  }
  return { sessionId, content, fixture, questions, index, selectedOptionIds, answers, phase, hintsByQuestion, signals: currentSignals, previouslyCommittedIds, previouslyMissedIds, retryOfSessionId };
}
function choiceSelection(value: unknown, session: PracticeSession): PracticeSelection {
  const source = object(value, ['filters', 'matchingQuestions', 'availableFamilies', 'requested', 'selected', 'shortfall', 'excludedFamilyVariants', 'order', 'seed', 'policy']);
  requireValue(source.policy === 'choice-selection-v1', 'Unsupported choice selection policy');
  const rawFilters = object(source.filters, ['domainId', 'trackId', 'level', 'dimension', 'types']);
  const types = array(rawFilters.types, 1, 3).map(value => oneOf(value, ['single', 'multi', 'true_false']));
  requireValue(new Set(types).size === types.length, 'Duplicate question-type filters');
  const filters = { domainId: rawFilters.domainId === null ? null : id(rawFilters.domainId), trackId: rawFilters.trackId === null ? null : id(rawFilters.trackId), level: rawFilters.level === null ? null : oneOf(rawFilters.level, ['beginner', 'intermediate', 'advanced', 'expert']), dimension: rawFilters.dimension === null ? null : oneOf(rawFilters.dimension, ['recall', 'understanding', 'application', 'diagnosis', 'design_judgement']), types };
  const matchingQuestions = integer(source.matchingQuestions, 0); const availableFamilies = integer(source.availableFamilies, 0, matchingQuestions);
  const requested = integer(source.requested, 1, 100); const selected = integer(source.selected, 0, requested);
  const shortfall = integer(source.shortfall, 0, requested); const excludedFamilyVariants = integer(source.excludedFamilyVariants, 0, matchingQuestions);
  requireValue(selected === session.questions.length && selected === Math.min(requested, availableFamilies) && shortfall === requested - selected && excludedFamilyVariants === matchingQuestions - availableFamilies, 'Selection counts are inconsistent');
  requireValue(new Set(session.questions.map(question => question.questionFamilyId)).size === session.questions.length && session.questions.every(question => types.includes(question.type) && (filters.level === null || question.level === filters.level) && (filters.dimension === null || question.dimension === filters.dimension)), 'Selected questions violate captured filters/family uniqueness');
  const order = oneOf(source.order, ['source', 'shuffle']);
  const seed = order === 'source' ? null : integer(source.seed, 0, 4294967295);
  requireValue(order !== 'source' || source.seed === null, 'Source-order seed must be null');
  return { questions: session.questions, filters, matchingQuestions, availableFamilies, requested, selected, shortfall, excludedFamilyVariants, order, seed, policy: 'choice-selection-v1' };
}
export function decodeChoiceRecoveryPayload(payloadJson: unknown, capturedAt: unknown): Readonly<{ session: PracticeSession; selection: PracticeSelection }> {
  const cutoff = time(capturedAt);
  const payload = object(parseRecoveryJson(payloadJson), ['engineVersion', 'engineSnapshot', 'selectionSnapshot']);
  requireValue(payload.engineVersion === 'choice-session-v1', 'Unsupported choice recovery engine version');
  const session = choiceSession(payload.engineSnapshot, cutoff);
  const selection = choiceSelection(payload.selectionSnapshot, session);
  return freezeRecovery({ session, selection });
}
