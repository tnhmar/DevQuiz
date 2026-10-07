import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createLearningValidators } from '../src/content/learning-entity-validator.mjs';
const read = async name => JSON.parse(await readFile(new URL('../schemas/' + name, import.meta.url), 'utf8'));
const validators = createLearningValidators(await read('learning-entities.v1.schema.json'), await read('questions.v1.schema.json'), await read('lesson-blocks.v1.schema.json'));
const approval = { state: 'awaiting_review', reviewer: null, approvedAt: null, approvedRevision: null };
const base = { revision: 1, status: 'draft', sourceRefs: [], claimRefs: [], approval };
const context = { domainId: 'fixture.domain', trackIds: ['fixture.track'] };
const body = [{ type: 'paragraph', content: [{ type: 'text', text: 'Original contract fixture, not learning material.' }] }];
const fixtures = {
  domain: { ...base, id: 'fixture.domain', title: 'Fixture domain', order: 0, description: 'Draft fixture' },
  track: { ...base, id: 'fixture.track', title: 'Fixture track', order: 0, description: 'Draft fixture', domainId: 'fixture.domain' },
  concept: { ...base, id: 'fixture.concept', title: 'Fixture objective', objective: 'Describe a fixture', domainId: 'fixture.domain', trackIds: ['fixture.track'], prerequisites: [], assessedDimensions: ['understanding'], technologyScopes: [{ technology: 'fixture', version: '1' }] },
  chapter: { ...base, id: 'fixture.chapter', kind: 'chapter', parentId: null, index: 0, title: 'Fixture chapter', context },
  lesson: { ...base, id: 'fixture.lesson', kind: 'lesson', parentId: 'fixture.chapter', index: 0, title: 'Fixture lesson', objective: 'Read fixture text', context, conceptRefs: [], body, questionRefs: [] },
  glossary: { ...base, id: 'fixture.term', term: 'Fixture term', definition: 'Original test definition', domainId: 'fixture.domain', conceptRefs: [], synonyms: [] }
};
for (const [kind, value] of Object.entries(fixtures)) test('accepts draft ' + kind, () => assert.equal(validators[kind](value).structureValid, true));
const invalid = [
  ['domain', { ...fixtures.domain, order: -1 }],
  ['track', { ...fixtures.track, domainId: 7 }],
  ['concept', { ...fixtures.concept, level: 'expert' }],
  ['concept', { ...fixtures.concept, assessedDimensions: ['magic'] }],
  ['chapter', { ...fixtures.chapter, parentId: 'fixture.other' }],
  ['lesson', { ...fixtures.lesson, parentId: null }],
  ['lesson', { ...fixtures.lesson, body: [] }],
  ['lesson', { ...fixtures.lesson, audio: { assetId: 'fixture.audio', revision: 0 } }],
  ['glossary', { ...fixtures.glossary, definition: '' }],
  ['glossary', { ...fixtures.glossary, backend: {} }]
];
invalid.forEach(([kind, value], index) => test('rejects invalid ' + kind + ' ' + index, () => assert.equal(validators[kind](value).structureValid, false)));
test('question-free lesson is structurally allowed, not assessment validated', () => {
  const result = validators.lesson(fixtures.lesson);
  assert.equal(result.structureValid, true);
  assert.equal(result.publicationChecked, false);
});
test('unknown target identifiers are not silently reference-validated', () => {
  const result = validators.track({ ...fixtures.track, domainId: 'fixture.missing' });
  assert.equal(result.structureValid, true);
  assert.equal(result.referencesChecked, false);
});
test('published status alone gives no publication permission', () => {
  const result = validators.domain({ ...fixtures.domain, status: 'published' });
  assert.equal(result.structureValid, true);
  assert.equal(result.publicationChecked, false);
});
test('inputs and diagnostic snapshots are not mutated', () => {
  const before = JSON.stringify(fixtures.lesson);
  const failed = validators.lesson(null);
  const snapshot = JSON.stringify(failed);
  validators.lesson(fixtures.lesson);
  assert.equal(JSON.stringify(fixtures.lesson), before);
  assert.equal(JSON.stringify(failed), snapshot);
});
