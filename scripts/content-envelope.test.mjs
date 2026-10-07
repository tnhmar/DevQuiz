import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createEnvelopeValidator } from '../src/content/envelope-validator.mjs';
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const schema = await read('../schemas/content-envelope.v1.schema.json');
const fixture = await read('../fixtures/content/envelope-draft.en.json');
const invalidCases = await read('../fixtures/content/envelope-invalid-cases.json');
const validate = createEnvelopeValidator(schema);
test('empty draft envelope passes structure, not publication', () => {
  const report = validate(fixture);
  assert.equal(report.envelopeValid, true);
  assert.equal(report.publicationChecked, false);
});
test('French uses the same locale-neutral pack identity', () => {
  const value = structuredClone(fixture);
  value.data.pack.language = 'fr';
  assert.equal(validate(value).envelopeValid, true);
});
test('identified draft entities pass; entity bodies are a later validation stage', () => {
  const value = structuredClone(fixture);
  value.data.content.push({ id: 'fixture.lesson', revision: 1, status: 'draft' });
  assert.equal(validate(value).envelopeValid, true);
});
for (const example of invalidCases) {
  test('rejects ' + example.name, () => {
    const value = structuredClone(fixture);
    let cursor = value;
    for (const key of example.path.slice(0, -1)) cursor = cursor[key];
    cursor[example.path.at(-1)] = example.value;
    const report = validate(value);
    assert.equal(report.envelopeValid, false);
    assert.ok(report.diagnostics.length > 0);
  });
}
test('missing manifest is rejected', () => {
  const value = structuredClone(fixture);
  delete value.data.pack;
  assert.equal(validate(value).envelopeValid, false);
});
test('null root is rejected', () => assert.equal(validate(null).envelopeValid, false));
test('validation never mutates input', () => {
  const before = JSON.stringify(fixture);
  validate(fixture);
  assert.equal(JSON.stringify(fixture), before);
});
test('diagnostic snapshots survive subsequent calls', () => {
  const failed = validate({ result: false, data: fixture.data });
  const before = JSON.stringify(failed);
  validate(fixture);
  assert.equal(JSON.stringify(failed), before);
});
