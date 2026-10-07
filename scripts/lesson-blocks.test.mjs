import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBlockValidator } from '../src/content/block-validator.mjs';
const schema = JSON.parse(await readFile(new URL('../schemas/lesson-blocks.v1.schema.json', import.meta.url), 'utf8'));
const validate = createBlockValidator(schema);
const text = [{ type: 'text', text: 'Original fixture text' }];
const valid = [
  { type: 'paragraph', content: text },
  { type: 'heading', level: 2, content: text },
  { type: 'list', ordered: false, items: [text] },
  { type: 'code', language: 'java', text: '  return 1;\n' },
  { type: 'table', columns: ['Label'], rows: [['Value']], alternativeText: 'Label: Value' },
  { type: 'callout', tone: 'warning', content: text },
  { type: 'figure', assetId: 'fixture.figure', altText: 'Original test figure' },
  { type: 'formula', text: 'a + b', alternativeText: 'a plus b' }
];
for (const block of valid) test('accepts ' + block.type, () => assert.equal(validate(block).structureValid, true));
for (const inline of [
  { type: 'text', text: 'Plain text' },
  { type: 'emphasis', style: 'bold', text: 'Emphasized text' },
  { type: 'link', label: 'Reference', url: 'https://example.com/reference' },
  { type: 'term_ref', label: 'Term', termId: 'fixture.term' }
]) test('accepts inline ' + inline.type, () => assert.equal(validate({ type: 'paragraph', content: [inline] }).structureValid, true));
const invalid = [
  { type: 'html', text: '<script>not permitted</script>' },
  { type: 'paragraph', content: [] },
  { type: 'heading', level: 7, content: text },
  { type: 'list', ordered: 'yes', items: [text] },
  { type: 'code', language: 'java', text: '', execute: true },
  { type: 'figure', assetId: 'fixture.figure' },
  { type: 'callout', tone: 'execute', content: text },
  { type: 'table', columns: ['Label'], rows: [['Value']] },
  { type: 'paragraph', content: [{ type: 'link', label: 'Unsafe', url: 'javascript:run()' }] },
  { type: 'paragraph', content: [{ type: 'term_ref', label: 'Term', termId: 7 }] }
];
invalid.forEach((block, index) => test('rejects invalid fixture ' + index, () => assert.equal(validate(block).structureValid, false)));
test('code whitespace is preserved and publication stays unchecked', () => {
  const block = structuredClone(valid[3]);
  const before = JSON.stringify(block);
  const result = validate(block);
  assert.equal(JSON.stringify(block), before);
  assert.equal(result.publicationChecked, false);
});
test('diagnostics are snapshots across calls', () => {
  const result = validate(null);
  const before = JSON.stringify(result);
  validate(valid[0]);
  assert.equal(JSON.stringify(result), before);
});
