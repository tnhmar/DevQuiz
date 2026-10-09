import type { Question, QuestionResponse } from '../content/questions.ts';
import type { ContentIdentity, PracticeConfidence } from './practice-session.ts';
export type OpenQuestion = Extract<Question, { type: 'open' }>;
export type RubricRating = 0 | 1 | 2;
export type OpenConfidenceSnapshot = Readonly<{ value: PracticeConfidence | null; capturedAt: number | null }>;
export type OpenPracticeResult = Readonly<{ sessionId: string; questionFamilyId: string; content: ContentIdentity; fixture: boolean; response: Extract<QuestionResponse, { type: 'open' }>; answerCommittedAt: number; rubricCommittedAt: number; objective: false; confidence: PracticeConfidence | null; confidenceCapturedAt: number | null; subjectivePoints: number; maxSubjectivePoints: number; criticalRatings: readonly { criterionId: string; rating: RubricRating }[]; scoringPolicy: 'self-rubric-v1' }>;
export type OpenPractice = Readonly<{ sessionId: string; content: ContentIdentity; fixture: boolean; question: OpenQuestion; phase: 'writing' | 'rating' | 'finished'; text: string; confidence: PracticeConfidence | null; confidenceCapturedAt: number | null; submittedConfidence: OpenConfidenceSnapshot | null; ratings: Readonly<Record<string, RubricRating>>; answerCommittedAt: number | null; result: OpenPracticeResult | null }>;
type ActionIdentity = { sessionId: string; questionId: string; questionRevision: number };
export type OpenPracticeAction = ActionIdentity & ({ type: 'edit'; text: string } | { type: 'confidence'; value: PracticeConfidence | null; at: number } | { type: 'submit'; at: number } | { type: 'rate'; criterionId: string; rating: RubricRating } | { type: 'finish'; at: number } | { type: 'restart'; nextSessionId: string });
function isRating(value: unknown): value is RubricRating { return value === 0 || value === 1 || value === 2; }
function validTime(at: number) { if (!Number.isFinite(at) || at < 0) throw new Error('Invalid commit timestamp'); }
export function createOpenPractice(input: { sessionId: string; content: ContentIdentity; fixture: boolean; question: OpenQuestion }): OpenPractice {
  if (!input.sessionId.trim() || !input.content.packId.trim() || !input.content.contentVersion.trim()) throw new Error('Session and content identities are required');
  if (typeof input.fixture !== 'boolean') throw new Error('Fixture context must be explicit');
  const question = JSON.parse(JSON.stringify(input.question)) as OpenQuestion;
  if (question.type !== 'open' || !question.id || !Number.isInteger(question.revision) || question.revision < 1) throw new Error('Invalid open-question identity');
  if (question.scoring.kind !== 'self_rubric' || question.scoring.objective !== false || question.scoring.pointsPerCriterion.join(',') !== '0,1,2') throw new Error('Unsupported self-rubric policy');
  const ids = question.rubric.map(item => item.id);
  if (!ids.length || ids.length > 20 || new Set(ids).size !== ids.length || ids.some(id => !id.trim())) throw new Error('Invalid rubric identities');
  if (!question.modelAnswer.length || question.rubric.some(item => !item.criterion.trim() || [item.anchors['0'], item.anchors['1'], item.anchors['2']].some(value => typeof value !== 'string' || !value.trim()))) throw new Error('Model answer and rubric anchors are required');
  return { sessionId: input.sessionId, content: { ...input.content }, fixture: input.fixture, question, phase: 'writing', text: '', confidence: null, confidenceCapturedAt: null, submittedConfidence: null, ratings: {}, answerCommittedAt: null, result: null };
}
export function canFinishOpenPractice(state: OpenPractice): boolean { return state.phase === 'rating' && state.question.rubric.every(item => isRating(state.ratings[item.id])); }
export function reduceOpenPractice(state: OpenPractice, action: OpenPracticeAction): OpenPractice {
  if (action.sessionId !== state.sessionId || action.questionId !== state.question.id || action.questionRevision !== state.question.revision) return state;
  if (action.type === 'restart') { if (!action.nextSessionId.trim() || action.nextSessionId === state.sessionId) throw new Error('Restart requires a new session identity'); return { ...state, sessionId: action.nextSessionId, phase: 'writing', text: '', confidence: null, confidenceCapturedAt: null, submittedConfidence: null, ratings: {}, answerCommittedAt: null, result: null }; }
  if (action.type === 'confidence') { if (state.phase !== 'writing') return state; if (action.value !== null && !['low', 'medium', 'high'].includes(action.value)) throw new Error('Invalid confidence value'); validTime(action.at); return { ...state, confidence: action.value, confidenceCapturedAt: action.value === null ? null : action.at }; }
  if (action.type === 'edit') { if (state.phase !== 'writing') return state; if (action.text.length > 100000) throw new Error('Response exceeds the text limit'); return { ...state, text: action.text }; }
  if (action.type === 'submit') { if (state.phase !== 'writing' || !state.text.trim()) return state; validTime(action.at); if (state.confidenceCapturedAt !== null && state.confidenceCapturedAt > action.at) throw new Error('Submission cannot precede confidence capture'); return { ...state, phase: 'rating', answerCommittedAt: action.at, submittedConfidence: { value: state.confidence, capturedAt: state.confidenceCapturedAt } }; }
  if (action.type === 'rate') { if (state.phase !== 'rating' || !isRating(action.rating) || !state.question.rubric.some(item => item.id === action.criterionId)) return state; return { ...state, ratings: { ...state.ratings, [action.criterionId]: action.rating } }; }
  if (!canFinishOpenPractice(state) || state.answerCommittedAt === null || state.submittedConfidence === null) return state;
  validTime(action.at); if (action.at < state.answerCommittedAt) throw new Error('Rubric commit cannot precede the answer');
  const ratings = Object.fromEntries(state.question.rubric.map(item => [item.id, state.ratings[item.id]])) as Record<string, RubricRating>;
  const result: OpenPracticeResult = { sessionId: state.sessionId, questionFamilyId: state.question.questionFamilyId, content: { ...state.content }, fixture: state.fixture, response: { type: 'open', questionId: state.question.id, questionRevision: state.question.revision, text: state.text, criterionRatings: ratings, objective: false }, answerCommittedAt: state.answerCommittedAt, rubricCommittedAt: action.at, objective: false, confidence: state.submittedConfidence.value, confidenceCapturedAt: state.submittedConfidence.capturedAt, subjectivePoints: Object.values(ratings).reduce<number>((sum, rating) => sum + rating, 0), maxSubjectivePoints: state.question.rubric.length * 2, criticalRatings: state.question.rubric.filter(item => item.critical).map(item => ({ criterionId: item.id, rating: ratings[item.id] })), scoringPolicy: 'self-rubric-v1' };
  return { ...state, phase: 'finished', result };
}
export function restoreOpenPractice(state: OpenPractice): OpenPractice {
  const restored = JSON.parse(JSON.stringify(state)) as OpenPractice;
  if (!restored.sessionId.trim() || !restored.content.packId.trim() || !restored.content.contentVersion.trim() || (restored.content.language !== 'en' && restored.content.language !== 'fr') || typeof restored.fixture !== 'boolean' || restored.question.type !== 'open') throw new Error('Invalid restored open session identity');
  const rubricIds = restored.question.rubric.map(item => item.id);
  if (!rubricIds.length || new Set(rubricIds).size !== rubricIds.length || Object.keys(restored.ratings).some(id => !rubricIds.includes(id)) || Object.values(restored.ratings).some(value => value !== 0 && value !== 1 && value !== 2)) throw new Error('Invalid restored open rubric map');
  const submitted = restored.phase !== 'writing';
  if (!submitted && (restored.answerCommittedAt !== null || restored.submittedConfidence !== null || Object.keys(restored.ratings).length !== 0 || restored.result !== null)) throw new Error('Writing state contains submitted open outcomes');
  if (submitted && (!restored.text.trim() || restored.answerCommittedAt === null || restored.submittedConfidence === null || restored.submittedConfidence.value !== restored.confidence || restored.submittedConfidence.capturedAt !== restored.confidenceCapturedAt || (restored.confidenceCapturedAt !== null && restored.confidenceCapturedAt > restored.answerCommittedAt))) throw new Error('Open submitted response/confidence mismatch');
  if (restored.phase === 'rating' && restored.result !== null) throw new Error('Open rating phase already has a finalized result');
  if (restored.phase === 'finished') { const result = restored.result; if (!result || Object.keys(restored.ratings).length !== rubricIds.length || result.sessionId !== restored.sessionId || result.fixture !== restored.fixture || result.objective !== false || result.scoringPolicy !== 'self-rubric-v1' || result.response.questionId !== restored.question.id || result.response.questionRevision !== restored.question.revision || result.response.text !== restored.text || result.answerCommittedAt !== restored.answerCommittedAt || result.confidence !== restored.submittedConfidence?.value || result.confidenceCapturedAt !== restored.submittedConfidence?.capturedAt || result.subjectivePoints !== Object.values(restored.ratings).reduce<number>((sum, rating) => sum + rating, 0) || result.maxSubjectivePoints !== restored.question.rubric.length * 2) throw new Error('Open finalized result mismatch'); } else if (restored.result !== null) throw new Error('Unfinished open state retained a finalized result');
  return restored;
}
