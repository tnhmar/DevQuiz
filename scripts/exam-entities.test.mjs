import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createExamValidators } from '../src/content/exam-entity-validator.mjs';
const read = async file => JSON.parse(await readFile(new URL('../schemas/' + file, import.meta.url), 'utf8'));
const validators = createExamValidators({ blocks: await read('lesson-blocks.v1.schema.json'), questions: await read('questions.v1.schema.json'), learning: await read('learning-entities.v1.schema.json'), provenance: await read('provenance-entities.v1.schema.json'), exams: await read('exam-entities.v1.schema.json') });
const base = { revision: 1, status: 'draft', sourceRefs: [], claimRefs: [], approval: { state: 'awaiting_review', reviewer: null, approvedAt: null, approvedRevision: null } };
const benchmark = { kind: 'percentage', thresholdPercent: 80, label: 'app_practice_benchmark' };
const profile = { ...base, id: 'fixture.profile', kind: 'exam_profile', provider: 'Original contract fixture', credentialTitle: 'Not a real credential', examCode: null, examVariant: 'unknown', lifecycle: 'unknown', profileStage: 'catalogued', verification: { state: 'not_checked', verifiedAt: null, reviewer: null }, officialSourceRefs: [], prerequisites: [], languages: null, objectives: [], objectiveWeighting: 'unknown', questionCount: null, durationSeconds: null, questionTypes: null, requiredCapabilities: [], navigation: { canRevisit: null, canChangeAnswers: null, canPause: null }, officialScoring: { kind: 'unknown' }, practiceBenchmark: benchmark, reviewBy: null, retiresOn: null };
const scoringPolicy = { choicePolicy: 'exact_match', openPolicy: 'self_rubric', negativeMarking: false, practiceBenchmark: benchmark };
const fixed = { ...base, id: 'fixture.test', kind: 'test', title: 'Original practice fixture', mode: 'practice', examProfileId: null, examProfileRevision: null, timing: { kind: 'untimed' }, scoringPolicy, questionRefs: ['fixture.question'] };
const rule = { ...fixed, selectionRule: { count: 2, domainRefs: [], trackRefs: [], conceptRefs: [], levels: ['beginner'], dimensions: ['understanding'], technologyScopes: [{ technology: 'fixture', version: '1' }], objectiveWeights: [] } };
delete rule.questionRefs;
const simulation = { ...fixed, mode: 'simulation', examProfileId: profile.id, examProfileRevision: 1, timing: { kind: 'timed', durationSeconds: 60, pauseAllowed: false } };
test('unknown official metadata can be catalogued without invented values', () => assert.equal(validators.profile(profile).structureValid, true));
for (const officialScoring of [
  { kind: 'percentage', passingPercent: null },
  { kind: 'points', maxPoints: null, passingPoints: null },
  { kind: 'scaled', minimum: 0, maximum: 200, passingScore: 120 },
  { kind: 'unknown' }
]) test('accepts official scoring metadata ' + officialScoring.kind, () => assert.equal(validators.profile({ ...profile, officialScoring }).structureValid, true));
for (const [name, value] of [['fixed', fixed], ['rule', rule], ['simulation', simulation]]) test('accepts ' + name + ' shape only', () => assert.equal(validators.test(value).structureValid, true));
const invalid = [
  { ...fixed, selectionRule: rule.selectionRule },
  { ...fixed, questionRefs: [] },
  { ...rule, selectionRule: { ...rule.selectionRule, count: 0 } },
  { ...simulation, timing: { kind: 'untimed' } },
  { ...simulation, timing: { kind: 'timed', durationSeconds: 60, pauseAllowed: true } },
  { ...simulation, examProfileId: null },
  { ...simulation, examProfileRevision: null },
  { ...fixed, scoringPolicy: { ...scoringPolicy, negativeMarking: true } }
];
invalid.forEach((value, index) => test('rejects invalid test ' + index, () => assert.equal(validators.test(value).structureValid, false)));
test('scaled score cannot contain an invented raw percentage threshold', () => assert.equal(validators.profile({ ...profile, officialScoring: { kind: 'scaled', minimum: 0, maximum: 200, passingScore: 120, passingPercent: 60 } }).structureValid, false));
test('unknown score is not replaced by a practice benchmark', () => assert.equal(validators.profile({ ...profile, officialScoring: { kind: 'unknown', passingPercent: 80 } }).structureValid, false));
test('readiness label does not validate official metadata or bank sufficiency', () => {
  const result = validators.profile({ ...profile, profileStage: 'simulation_ready' });
  assert.equal(result.structureValid, true);
  assert.equal(result.profileMetadataChecked, false);
  assert.equal(result.simulationReadinessChecked, false);
  assert.equal(result.publicationChecked, false);
});
test('unresolved question reference remains unchecked', () => {
  const result = validators.test(fixed);
  assert.equal(result.referencesChecked, false);
});
test('inputs and diagnostic snapshots remain unchanged', () => {
  const before = JSON.stringify(fixed);
  const failed = validators.test(null);
  const snapshot = JSON.stringify(failed);
  validators.test(fixed);
  assert.equal(JSON.stringify(fixed), before);
  assert.equal(JSON.stringify(failed), snapshot);
});
