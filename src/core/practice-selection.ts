import type { Dimension, Level, Question } from '../content/questions.ts';
import type { ChoiceQuestion } from './practice-session.ts';
export type ChoiceType = ChoiceQuestion['type'];
export type PracticeCandidate = Readonly<{ question: Question; domainId: string; trackIds: readonly string[] }>;
type ChoiceCandidate = PracticeCandidate & { question: ChoiceQuestion };
export type PracticeFilters = Readonly<{
  domainId: string | null; trackId: string | null; level: Level | null;
  dimension: Dimension | null; types: readonly ChoiceType[];
}>;
export const DEFAULT_PRACTICE_FILTERS: PracticeFilters = {
  domainId: null, trackId: null, level: null, dimension: null, types: ['single', 'multi', 'true_false']
};
export type PracticeSelectionRequest = Readonly<{
  filters: PracticeFilters; count: number; order: 'source' | 'shuffle'; seed: number;
}>;
export type PracticeSelection = Readonly<{
  questions: readonly ChoiceQuestion[]; filters: PracticeFilters;
  matchingQuestions: number; availableFamilies: number; requested: number; selected: number;
  shortfall: number; excludedFamilyVariants: number;
  order: 'source' | 'shuffle'; seed: number | null; policy: 'choice-selection-v1';
}>;
function shuffled<T>(values: readonly T[], seed: number): T[] {
  const result = [...values];
  let state = seed >>> 0;
  function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
export function selectPracticeQuestions(pool: readonly PracticeCandidate[], request: PracticeSelectionRequest): PracticeSelection {
  if (!Number.isInteger(request.count) || request.count < 1 || request.count > 100) throw new Error('Choose a session size from 1 to 100');
  if (request.order !== 'source' && request.order !== 'shuffle') throw new Error('Unsupported question order');
  if (!Number.isInteger(request.seed) || request.seed < 0 || request.seed > 4294967295) throw new Error('Use an unsigned 32-bit selection seed');
  const filters: PracticeFilters = { ...request.filters, types: [...request.filters.types] };
  const allowedTypes: readonly ChoiceType[] = ['single', 'multi', 'true_false'];
  if (filters.types.some(type => !allowedTypes.includes(type))) throw new Error('Unsupported choice-question type');
  const ids = new Set<string>();
  for (const candidate of pool) {
    const question = candidate.question;
    if (!question.id || ids.has(question.id) || !question.questionFamilyId || !candidate.domainId) throw new Error('Question-pool identities must be unique and complete');
    ids.add(question.id);
  }
  const matching = pool.filter((candidate): candidate is ChoiceCandidate => {
    const question = candidate.question;
    return question.type !== 'open'
      && filters.types.includes(question.type)
      && (filters.domainId === null || candidate.domainId === filters.domainId)
      && (filters.trackId === null || candidate.trackIds.includes(filters.trackId))
      && (filters.level === null || question.level === filters.level)
      && (filters.dimension === null || question.dimension === filters.dimension);
  });
  const ordered = request.order === 'shuffle' ? shuffled(matching, request.seed) : matching;
  const families = new Set<string>();
  const distinct: ChoiceQuestion[] = [];
  for (const candidate of ordered) {
    if (families.has(candidate.question.questionFamilyId)) continue;
    families.add(candidate.question.questionFamilyId);
    distinct.push(candidate.question);
  }
  const questions = distinct.slice(0, request.count);
  return {
    questions, filters, matchingQuestions: matching.length, availableFamilies: distinct.length,
    requested: request.count, selected: questions.length, shortfall: request.count - questions.length,
    excludedFamilyVariants: matching.length - distinct.length,
    order: request.order, seed: request.order === 'shuffle' ? request.seed : null, policy: 'choice-selection-v1'
  };
}
