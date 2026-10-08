import type { ChoiceQuestion, PracticeHint } from '../core/practice-session.ts';
const hints: Readonly<Record<string, readonly PracticeHint[]>> = {
  'demo.single': [{ id: 'demo.single.read-label', label: 'Demo hint: read the label', content: 'Match the option label requested by the prompt, not the option position.' }],
  'demo.multi': [{ id: 'demo.multi.check-set', label: 'Demo hint: check the whole set', content: 'Read both the requested and excluded labels. Check the complete selected set before submitting.' }]
};
export function demoPracticeHints(questions: readonly ChoiceQuestion[]): Readonly<Record<string, readonly PracticeHint[]>> {
  return Object.fromEntries(questions.map(question => [question.id, question.revision === 1 && Object.prototype.hasOwnProperty.call(hints, question.id) ? hints[question.id] : []]));
}
