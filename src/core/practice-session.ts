import type { Question } from '../content/questions.ts';
import { scoreChoice } from './assessment.ts';
export type ChoiceQuestion = Exclude<Question, { type: 'open' }>;
export type ContentIdentity = Readonly<{ packId: string; contentVersion: string; language: 'en' | 'fr' }>;
export type PracticeAnswer = Readonly<{
  sessionId: string; questionId: string; questionRevision: number; questionFamilyId: string;
  selectedOptionIds: readonly string[]; correct: boolean; points: number; maxPoints: number;
  committedAt: number; fixture: boolean; scoringPolicy: 'choice-exact-v1';
}>;
export type PracticeSession = Readonly<{
  sessionId: string; content: ContentIdentity; fixture: boolean;
  questions: readonly ChoiceQuestion[]; index: number; selectedOptionIds: readonly string[];
  answers: readonly PracticeAnswer[]; phase: 'empty' | 'answering' | 'feedback' | 'finished';
}>;
export type PracticeAction =
  | { type: 'select'; questionId: string; questionRevision: number; optionId: string }
  | { type: 'submit'; questionId: string; questionRevision: number; at: number }
  | { type: 'next'; questionId: string; questionRevision: number }
  | { type: 'restart'; sessionId: string };
function grade(question: ChoiceQuestion, selected: readonly string[]) {
  return scoreChoice({ type: question.type, options: question.options.map(option => option.id), correctOptionIds: question.scoring.correctOptionIds }, selected);
}
export function createPracticeSession(input: {
  sessionId: string; content: ContentIdentity; fixture: boolean; questions: readonly Question[];
}): PracticeSession {
  if (!input.sessionId.trim() || !input.content.packId.trim() || !input.content.contentVersion.trim()) throw new Error('Session and content identities are required');
  if (typeof input.fixture !== 'boolean') throw new Error('Fixture context must be explicit');
  const seen = new Set<string>();
  const questions = input.questions.map(value => {
    const question = JSON.parse(JSON.stringify(value)) as Question;
    if (question.type === 'open') throw new Error('Open responses require the separate rubric session flow');
    if (!question.id || seen.has(question.id) || !Number.isInteger(question.revision) || question.revision < 1) throw new Error('Invalid or duplicate question identity');
    if (question.scoring.kind !== 'exact_match' || question.scoring.maxPoints !== 1 || question.scoring.negativeMarking !== false) throw new Error('Unsupported choice scoring policy');
    seen.add(question.id);
    grade(question, []);
    return question;
  });
  return {
    sessionId: input.sessionId, content: { ...input.content }, fixture: input.fixture,
    questions, index: 0, selectedOptionIds: [], answers: [], phase: questions.length ? 'answering' : 'empty'
  };
}
export function currentPracticeQuestion(session: PracticeSession): ChoiceQuestion | undefined {
  return session.phase === 'empty' || session.phase === 'finished' ? undefined : session.questions[session.index];
}
export function reducePracticeSession(session: PracticeSession, action: PracticeAction): PracticeSession {
  if (action.type === 'restart') {
    if (!action.sessionId.trim() || action.sessionId === session.sessionId) throw new Error('Restart requires a new session identity');
    return { ...session, sessionId: action.sessionId, index: 0, selectedOptionIds: [], answers: [], phase: session.questions.length ? 'answering' : 'empty' };
  }
  const question = currentPracticeQuestion(session);
  if (!question || question.id !== action.questionId || question.revision !== action.questionRevision) return session;
  if (action.type === 'select') {
    if (session.phase !== 'answering' || !question.options.some(option => option.id === action.optionId)) return session;
    const selected = question.type === 'multi'
      ? session.selectedOptionIds.includes(action.optionId) ? session.selectedOptionIds.filter(id => id !== action.optionId) : [...session.selectedOptionIds, action.optionId]
      : [action.optionId];
    return { ...session, selectedOptionIds: selected };
  }
  if (action.type === 'submit') {
    if (session.phase !== 'answering' || !session.selectedOptionIds.length) return session;
    if (!Number.isFinite(action.at) || action.at < 0) throw new Error('Invalid commit timestamp');
    const score = grade(question, session.selectedOptionIds);
    const answer: PracticeAnswer = {
      sessionId: session.sessionId, questionId: question.id, questionRevision: question.revision,
      questionFamilyId: question.questionFamilyId, selectedOptionIds: [...session.selectedOptionIds],
      correct: score.correct, points: score.points, maxPoints: score.maxPoints,
      committedAt: action.at, fixture: session.fixture, scoringPolicy: 'choice-exact-v1'
    };
    return { ...session, answers: [...session.answers, answer], phase: 'feedback' };
  }
  if (session.phase !== 'feedback') return session;
  const index = session.index + 1;
  return { ...session, index, selectedOptionIds: [], phase: index >= session.questions.length ? 'finished' : 'answering' };
}
export function practiceSummary(session: PracticeSession) {
  return {
    totalQuestions: session.questions.length, answered: session.answers.length,
    correct: session.answers.filter(answer => answer.correct).length,
    points: session.answers.reduce((sum, answer) => sum + answer.points, 0),
    complete: session.phase === 'finished', fixture: session.fixture
  };
}
