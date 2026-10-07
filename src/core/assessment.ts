export type Choice = { type: 'single' | 'multi' | 'true_false'; options: readonly string[]; correctOptionIds: readonly string[] };
export function scoreChoice(question: Choice, selected: readonly string[]) {
  const options = new Set(question.options);
  const correct = new Set(question.correctOptionIds);
  if (options.size < 2 || options.size !== question.options.length || correct.size === 0 || correct.size !== question.correctOptionIds.length || [...correct].some(id => !options.has(id))) throw new Error('Invalid choice definition');
  if (question.type !== 'multi' && correct.size !== 1) throw new Error('Single answer required');
  if (question.type === 'true_false' && options.size !== 2) throw new Error('Boolean choice requires two options');
  const answers = new Set(selected);
  const matched = selected.length === answers.size && answers.size === correct.size && [...answers].every(id => correct.has(id));
  return { correct: matched, points: matched ? 1 : 0, maxPoints: 1 };
}
export type EvidenceContext = { fixture: boolean; objective: boolean; firstCommitted: boolean; hintUsed: boolean; answerRevealed: boolean; missedRetry: boolean; at: number };
export function eligibleUnassisted(context: EvidenceContext, now: number) {
  return Number.isFinite(context.at) && context.at >= 0 && context.at <= now && !context.fixture && context.objective && context.firstCommitted && !context.hintUsed && !context.answerRevealed && !context.missedRetry;
}
export function outcomeCell(concept: string, level: string, dimension: string, scope: string) {
  if (![concept, level, dimension, scope].every(value => value.length > 0)) throw new Error('Outcome scope required');
  return JSON.stringify([concept, level, dimension, scope]);
}
export function contentPreflight(value: unknown): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return ['Root must be an object'];
  const root = value as Record<string, unknown>;
  if (root.result !== true) return ['result must be true'];
  if (typeof root.data !== 'object' || root.data === null || Array.isArray(root.data)) return ['data must be an object'];
  const data = root.data as Record<string, unknown>;
  return ['content', 'questions', 'tests', 'glossary'].filter(key => !Array.isArray(data[key])).map(key => 'data.' + key + ' must be an array');
}
