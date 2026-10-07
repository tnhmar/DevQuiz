import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreChoice, eligibleUnassisted, outcomeCell, contentPreflight } from './assessment.ts';
test('single choice is scored by ID rather than position', () => {
  assert.equal(scoreChoice({ type: 'single', options: ['b', 'a'], correctOptionIds: ['a'] }, ['a']).points, 1);
});
test('multi-select is exact; extras, omissions and duplicate submissions fail', () => {
  const q = { type: 'multi' as const, options: ['a', 'b', 'c'], correctOptionIds: ['a', 'c'] };
  assert.equal(scoreChoice(q, ['c', 'a']).correct, true);
  for (const selection of [['a'], ['a', 'b', 'c'], ['a', 'c', 'c'], [], ['unknown']]) assert.equal(scoreChoice(q, selection).correct, false);
});
test('invalid definitions fail instead of guessing a correct option', () => {
  assert.throws(() => scoreChoice({ type: 'single', options: ['a', 'b'], correctOptionIds: ['unknown'] }, ['a']));
});
test('fixtures, assistance, retries, self-report and future events never qualify', () => {
  const baseline = { fixture: false, objective: true, firstCommitted: true, hintUsed: false, answerRevealed: false, missedRetry: false, at: 100 };
  assert.equal(eligibleUnassisted(baseline, 100), true);
  for (const patch of [{ fixture: true }, { hintUsed: true }, { answerRevealed: true }, { missedRetry: true }, { objective: false }, { firstCommitted: false }, { at: 101 }]) assert.equal(eligibleUnassisted({ ...baseline, ...patch }, 100), false);
});
test('levels, dimensions and versions do not share outcome cells', () => {
  assert.notEqual(outcomeCell('c', 'beginner', 'recall', 'v1'), outcomeCell('c', 'expert', 'recall', 'v1'));
});
test('preflight rejects malformed envelopes but is not a publication validator', () => {
  assert.ok(contentPreflight(null).length);
  assert.deepEqual(contentPreflight({ result: true, data: { content: [], questions: [], tests: [], glossary: [] } }), []);
});
