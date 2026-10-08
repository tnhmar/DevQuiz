import type { Explanation, Question } from '../content/questions.ts';
import { scoreChoice } from './assessment.ts';
import type { EvidenceContext } from './assessment.ts';
export type ChoiceQuestion = Exclude<Question, { type: 'open' }>;
export type ContentIdentity = Readonly<{ packId: string; contentVersion: string; language: 'en' | 'fr' }>;
export type PracticeConfidence = 'low' | 'medium' | 'high';
export type PracticeHint = Readonly<{ id: string; label: string; content: Explanation }>;
export type HintExposure = Readonly<{ hintId: string; revealedAt: number }>;
export type PracticeSignals = Readonly<{
  confidence: PracticeConfidence | null; confidenceCapturedAt: number | null;
  hints: readonly HintExposure[]; answerRevealedAt: number | null;
}>;
export type PracticeAnswer = Readonly<{
  sessionId: string; questionId: string; questionRevision: number; questionFamilyId: string;
  selectedOptionIds: readonly string[]; correct: boolean; points: number; maxPoints: number;
  committedAt: number; fixture: boolean; scoringPolicy: 'choice-exact-v1';
  objective: true; firstCommitted: boolean; missedRetry: boolean; retryOfSessionId: string | null;
  hintUsed: boolean; hintExposures: readonly HintExposure[]; answerRevealed: boolean;
  answerRevealedAt: number | null; confidence: PracticeConfidence | null; confidenceCapturedAt: number | null;
}>;
export type PracticeSession = Readonly<{
  sessionId: string; content: ContentIdentity; fixture: boolean;
  questions: readonly ChoiceQuestion[]; index: number; selectedOptionIds: readonly string[];
  answers: readonly PracticeAnswer[]; phase: 'empty' | 'answering' | 'feedback' | 'finished';
  hintsByQuestion: Readonly<Record<string, readonly PracticeHint[]>>; signals: PracticeSignals;
  previouslyCommittedIds: readonly string[]; previouslyMissedIds: readonly string[]; retryOfSessionId: string | null;
}>;
type QuestionIdentity = { questionId: string; questionRevision: number };
export type PracticeAction =
  | (QuestionIdentity & { type: 'select'; optionId: string })
  | (QuestionIdentity & { type: 'confidence'; value: PracticeConfidence | null; at: number })
  | (QuestionIdentity & { type: 'hint'; hintId: string; at: number })
  | (QuestionIdentity & { type: 'reveal_answer'; at: number })
  | (QuestionIdentity & { type: 'submit'; at: number })
  | (QuestionIdentity & { type: 'next' })
  | { type: 'restart'; sessionId: string };
function freshSignals(): PracticeSignals {
  return { confidence: null, confidenceCapturedAt: null, hints: [], answerRevealedAt: null };
}
function validTime(at: number) {
  if (!Number.isFinite(at) || at < 0) throw new Error('Invalid capture timestamp');
}
function grade(question: ChoiceQuestion, selected: readonly string[]) {
  return scoreChoice({ type: question.type, options: question.options.map(option => option.id), correctOptionIds: question.scoring.correctOptionIds }, selected);
}
export function createPracticeSession(input: {
  sessionId: string; content: ContentIdentity; fixture: boolean; questions: readonly Question[];
  hintsByQuestion?: Readonly<Record<string, readonly PracticeHint[]>>;
}): PracticeSession {
  if (!input.sessionId.trim() || !input.content.packId.trim() || !input.content.contentVersion.trim()) throw new Error('Session and content identities are required');
  if (typeof input.fixture !== 'boolean') throw new Error('Fixture context must be explicit');
  const seen = new Set<string>();
  const questions = input.questions.map(value => {
    const question = JSON.parse(JSON.stringify(value)) as Question;
    if (question.type === 'open') throw new Error('Open responses require the separate rubric session flow');
    if (!question.id || seen.has(question.id) || !Number.isInteger(question.revision) || question.revision < 1) throw new Error('Invalid or duplicate question identity');
    if (question.scoring.kind !== 'exact_match' || question.scoring.maxPoints !== 1 || question.scoring.negativeMarking !== false) throw new Error('Unsupported choice scoring policy');
    seen.add(question.id); grade(question, []); return question;
  });
  const hintsByQuestion: Record<string, readonly PracticeHint[]> = Object.create(null);
  for (const [questionId, values] of Object.entries(input.hintsByQuestion ?? {})) {
    if (!seen.has(questionId) || values.length > 20) throw new Error('Invalid hint registry scope');
    const hints = JSON.parse(JSON.stringify(values)) as PracticeHint[];
    if (new Set(hints.map(hint => hint.id)).size !== hints.length || hints.some(hint => !hint.id.trim() || !hint.label.trim() || (typeof hint.content === 'string' ? !hint.content.trim() : !hint.content.length))) throw new Error('Invalid hint identities or content');
    hintsByQuestion[questionId] = hints;
  }
  return {
    sessionId: input.sessionId, content: { ...input.content }, fixture: input.fixture,
    questions, index: 0, selectedOptionIds: [], answers: [], phase: questions.length ? 'answering' : 'empty',
    hintsByQuestion, signals: freshSignals(), previouslyCommittedIds: [], previouslyMissedIds: [], retryOfSessionId: null
  };
}
export function currentPracticeQuestion(session: PracticeSession): ChoiceQuestion | undefined {
  return session.phase === 'empty' || session.phase === 'finished' ? undefined : session.questions[session.index];
}
export function currentPracticeHints(session: PracticeSession): readonly PracticeHint[] {
  const question = currentPracticeQuestion(session);
  return question ? session.hintsByQuestion[question.id] ?? [] : [];
}
export function reducePracticeSession(session: PracticeSession, action: PracticeAction): PracticeSession {
  if (action.type === 'restart') {
    if (!action.sessionId.trim() || action.sessionId === session.sessionId) throw new Error('Restart requires a new session identity');
    return {
      ...session, sessionId: action.sessionId, index: 0, selectedOptionIds: [], answers: [], signals: freshSignals(),
      phase: session.questions.length ? 'answering' : 'empty', retryOfSessionId: session.sessionId,
      previouslyCommittedIds: [...new Set([...session.previouslyCommittedIds, ...session.answers.map(answer => answer.questionId)])],
      previouslyMissedIds: [...new Set([...session.previouslyMissedIds, ...session.answers.filter(answer => !answer.correct).map(answer => answer.questionId)])]
    };
  }
  const question = currentPracticeQuestion(session);
  if (!question || question.id !== action.questionId || question.revision !== action.questionRevision) return session;
  if (action.type === 'confidence') {
    if (session.phase !== 'answering' || session.signals.hints.length || session.signals.answerRevealedAt !== null) return session;
    if (action.value !== null && !['low', 'medium', 'high'].includes(action.value)) throw new Error('Invalid confidence value');
    validTime(action.at);
    return { ...session, signals: { ...session.signals, confidence: action.value, confidenceCapturedAt: action.value === null ? null : action.at } };
  }
  if (action.type === 'hint') {
    if (session.phase !== 'answering' || !currentPracticeHints(session).some(hint => hint.id === action.hintId) || session.signals.hints.some(hint => hint.hintId === action.hintId)) return session;
    validTime(action.at);
    return { ...session, signals: { ...session.signals, hints: [...session.signals.hints, { hintId: action.hintId, revealedAt: action.at }] } };
  }
  if (action.type === 'reveal_answer') {
    if (session.phase !== 'answering' || session.signals.answerRevealedAt !== null) return session;
    validTime(action.at);
    return { ...session, signals: { ...session.signals, answerRevealedAt: action.at } };
  }
  if (action.type === 'select') {
    if (session.phase !== 'answering' || !question.options.some(option => option.id === action.optionId)) return session;
    const selected = question.type === 'multi'
      ? session.selectedOptionIds.includes(action.optionId) ? session.selectedOptionIds.filter(id => id !== action.optionId) : [...session.selectedOptionIds, action.optionId]
      : [action.optionId];
    return { ...session, selectedOptionIds: selected };
  }
  if (action.type === 'submit') {
    if (session.phase !== 'answering' || !session.selectedOptionIds.length) return session;
    validTime(action.at);
    const captures = [session.signals.confidenceCapturedAt, session.signals.answerRevealedAt, ...session.signals.hints.map(hint => hint.revealedAt)].filter((at): at is number => at !== null);
    if (captures.some(at => at > action.at)) throw new Error('Submission cannot precede its captured signals');
    const score = grade(question, session.selectedOptionIds);
    const answer: PracticeAnswer = {
      sessionId: session.sessionId, questionId: question.id, questionRevision: question.revision,
      questionFamilyId: question.questionFamilyId, selectedOptionIds: [...session.selectedOptionIds],
      correct: score.correct, points: score.points, maxPoints: score.maxPoints,
      committedAt: action.at, fixture: session.fixture, scoringPolicy: 'choice-exact-v1', objective: true,
      firstCommitted: !session.previouslyCommittedIds.includes(question.id), missedRetry: session.previouslyMissedIds.includes(question.id),
      retryOfSessionId: session.retryOfSessionId, hintUsed: session.signals.hints.length > 0,
      hintExposures: session.signals.hints.map(hint => ({ ...hint })), answerRevealed: session.signals.answerRevealedAt !== null,
      answerRevealedAt: session.signals.answerRevealedAt, confidence: session.signals.confidence, confidenceCapturedAt: session.signals.confidenceCapturedAt
    };
    return { ...session, answers: [...session.answers, answer], phase: 'feedback' };
  }
  if (session.phase !== 'feedback') return session;
  const index = session.index + 1;
  return { ...session, index, selectedOptionIds: [], signals: freshSignals(), phase: index >= session.questions.length ? 'finished' : 'answering' };
}
export function practiceAnswerEvidence(answer: PracticeAnswer): EvidenceContext {
  return { fixture: answer.fixture, objective: answer.objective, firstCommitted: answer.firstCommitted, hintUsed: answer.hintUsed, answerRevealed: answer.answerRevealed, missedRetry: answer.missedRetry, at: answer.committedAt };
}
export function practiceSummary(session: PracticeSession) {
  return {
    totalQuestions: session.questions.length, answered: session.answers.length,
    correct: session.answers.filter(answer => answer.correct).length,
    points: session.answers.reduce((sum, answer) => sum + answer.points, 0),
    assisted: session.answers.filter(answer => answer.hintUsed || answer.answerRevealed).length,
    repeatedCommits: session.answers.filter(answer => !answer.firstCommitted).length,
    complete: session.phase === 'finished', fixture: session.fixture
  };
}
