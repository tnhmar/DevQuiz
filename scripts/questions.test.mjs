import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createQuestionValidators } from '../src/content/question-validator.mjs';
const read = async name => JSON.parse(await readFile(new URL('../schemas/' + name, import.meta.url), 'utf8'));
const validators = createQuestionValidators(await read('questions.v1.schema.json'), await read('lesson-blocks.v1.schema.json'));
const blocks = [{ type: 'paragraph', content: [{ type: 'text', text: 'Original UI contract fixture' }] }];
const base = {
  id: 'fixture.question', revision: 1, questionFamilyId: 'fixture.family', primaryConceptId: 'fixture.concept',
  supportingConceptIds: [], level: 'beginner', dimension: 'understanding', presentation: 'direct',
  prompt: blocks, explanation: 'Original fixture explanation', sourceRefs: [], claimRefs: [], status: 'draft',
  approval: { state: 'awaiting_review', reviewer: null, approvedAt: null, approvedRevision: null },
  technologyScopes: [{ technology: 'fixture', version: '1' }], reviewBy: null
};
const exact = ids => ({ kind: 'exact_match', correctOptionIds: ids, maxPoints: 1, negativeMarking: false });
const single = { ...base, type: 'single', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], scoring: exact(['a']), optionExplanations: { a: 'A fixture', b: 'B fixture' } };
const multi = { ...single, type: 'multi', scoring: exact(['a', 'b']) };
const boolean = { ...base, type: 'true_false', options: [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }], scoring: exact(['true']), optionExplanations: { true: 'True fixture', false: 'False fixture' } };
const open = { ...base, type: 'open', modelAnswer: blocks, rubric: [{ id: 'fixture.criterion', criterion: 'Explain the choice', critical: false, anchors: { '0': 'Missing', '1': 'Partial', '2': 'Adequate' } }], scoring: { kind: 'self_rubric', objective: false, pointsPerCriterion: [0, 1, 2] } };
for (const value of [single, multi, boolean, open]) test('accepts draft ' + value.type, () => assert.equal(validators.question(value).structureValid, true));
const invalid = [
  { ...single, scoring: exact(['a', 'b']) }, { ...multi, scoring: exact([]) },
  { ...single, scoring: { ...exact(['a']), negativeMarking: true } },
  { ...single, type: 'execute_script' }, { ...single, prompt: [] },
  { ...boolean, options: [{ id: 'yes', text: 'Yes' }, { id: 'no', text: 'No' }] },
  { ...open, scoring: { ...open.scoring, objective: true } }, { ...open, rubric: [] },
  { ...open, rubric: [{ ...open.rubric[0], anchors: { '0': 'Missing', '2': 'Adequate' } }] },
  { ...single, modelAnswer: blocks }
];
invalid.forEach((value, index) => test('rejects invalid question ' + index, () => assert.equal(validators.question(value).structureValid, false)));
for (const value of [
  { type: 'single', questionId: base.id, questionRevision: 1, selectedOptionIds: [] },
  { type: 'multi', questionId: base.id, questionRevision: 1, selectedOptionIds: ['a', 'b'] },
  { type: 'true_false', questionId: base.id, questionRevision: 1, selectedOptionIds: ['false'] },
  { type: 'open', questionId: base.id, questionRevision: 1, text: '', criterionRatings: {}, objective: false }
]) test('accepts response ' + value.type, () => assert.equal(validators.response(value).structureValid, true));
test('rejects duplicate selected IDs', () => assert.equal(validators.response({ type: 'multi', questionId: base.id, questionRevision: 1, selectedOptionIds: ['a', 'a'] }).structureValid, false));
test('rejects objective open-response claim', () => assert.equal(validators.response({ type: 'open', questionId: base.id, questionRevision: 1, text: 'Draft', criterionRatings: {}, objective: true }).structureValid, false));
test('editorial status alone never becomes publication permission', () => {
  const report = validators.question({ ...single, status: 'published', approval: { state: 'approved', reviewer: 'fixture', approvedAt: '2026-10-07', approvedRevision: 1 } });
  assert.equal(report.structureValid, true);
  assert.equal(report.publicationChecked, false);
});
test('input and diagnostic snapshots are preserved', () => {
  const before = JSON.stringify(single);
  const failed = validators.question(null);
  const snapshot = JSON.stringify(failed);
  validators.question(single);
  assert.equal(JSON.stringify(single), before);
  assert.equal(JSON.stringify(failed), snapshot);
});
