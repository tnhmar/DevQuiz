import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createProvenanceValidators } from '../src/content/provenance-validator.mjs';
const read = async name => JSON.parse(await readFile(new URL('../schemas/' + name, import.meta.url), 'utf8'));
const validators = createProvenanceValidators(await read('provenance-entities.v1.schema.json'), await read('questions.v1.schema.json'), await read('lesson-blocks.v1.schema.json'));
const rights = { distribution: 'private', licence: 'Original contract fixture, not learning material.', evidenceRefs: [] };
const identity = { revision: 1, status: 'draft' };
const source = { ...identity, id: 'fixture.source', type: 'own', title: 'Original source fixture', locator: 'Fixture section 1', url: null, retrievedAt: '2026-10-07', version: null, rights };
const claim = { ...identity, id: 'fixture.claim', sourceRef: source.id, locator: 'Fixture section 1', claim: 'Placeholder for a claim under review', scope: { technology: 'fixture', version: '1' }, evidenceRefs: [], verification: { state: 'not_checked', verifiedAt: null, reviewer: null }, qualifiers: [], approvedDependentRevisions: [], reviewBy: null };
const assetBase = { ...identity, byteLength: 1, hash: { algorithm: 'sha256', value: '0'.repeat(64) }, rights, sourceRefs: [] };
const image = { ...assetBase, id: 'fixture.image', kind: 'image', path: 'assets/fixture.png', mediaType: 'image/png', width: 1, height: 1, altText: 'Original declared fixture image' };
const audio = { ...assetBase, id: 'fixture.audio', kind: 'audio', path: 'audio/fixture.mp3', mediaType: 'audio/mpeg', language: 'en', transcriptAssetId: null, timingAssetId: null, durationSeconds: null };
const text = { ...assetBase, id: 'fixture.transcript', kind: 'text', path: 'text/fixture.txt', mediaType: 'text/plain', role: 'transcript', language: 'en' };
for (const [kind, value] of [['source', source], ['claim', claim], ['asset', image], ['asset', audio], ['asset', text]]) test('accepts draft ' + kind + ' ' + value.id, () => assert.equal(validators[kind](value).structureValid, true));
const invalid = [
  ['source', { ...source, type: 'trusted_by_default' }],
  ['source', { ...source, url: 'javascript:run()' }],
  ['source', { ...source, rights: { ...rights, distribution: 'automatically_licensed' } }],
  ['claim', { ...claim, verification: { ...claim.verification, state: 'owner_approval_equals_truth' } }],
  ['claim', { ...claim, approvedDependentRevisions: [{ entityId: 'fixture.question', revision: 0 }] }],
  ['asset', { ...image, path: '../fixture.png' }],
  ['asset', { ...image, path: '/absolute/fixture.png' }],
  ['asset', { ...image, path: 'assets/fixture.svg', mediaType: 'image/svg+xml' }],
  ['asset', { ...image, hash: { algorithm: 'sha256', value: 'short' } }],
  ['asset', { ...image, byteLength: 10 * 1024 * 1024 + 1 }],
  ['asset', { ...audio, language: 'ar' }],
  ['asset', { ...text, mediaType: 'text/html' }]
];
invalid.forEach(([kind, value], index) => test('rejects invalid ' + kind + ' ' + index, () => assert.equal(validators[kind](value).structureValid, false)));
test('self-declared verified state does not establish factual verification', () => {
  const result = validators.claim({ ...claim, verification: { state: 'verified', verifiedAt: '2026-10-07', reviewer: 'fixture' } });
  assert.equal(result.structureValid, true);
  assert.equal(result.factualVerificationChecked, false);
  assert.equal(result.publicationChecked, false);
});
test('redistributable declaration is not licence proof', () => {
  const result = validators.source({ ...source, rights: { ...rights, distribution: 'redistributable' } });
  assert.equal(result.structureValid, true);
  assert.equal(result.rightsChecked, false);
});
test('hash-shaped metadata is not a byte-integrity check', () => {
  const result = validators.asset(image);
  assert.equal(result.structureValid, true);
  assert.equal(result.referencesChecked, false);
  assert.equal(result.publicationChecked, false);
});
test('input and diagnostic snapshots remain unchanged', () => {
  const before = JSON.stringify(claim);
  const failed = validators.claim(null);
  const snapshot = JSON.stringify(failed);
  validators.claim(claim);
  assert.equal(JSON.stringify(claim), before);
  assert.equal(JSON.stringify(failed), snapshot);
});
