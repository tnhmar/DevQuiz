import { readFile, stat } from 'node:fs/promises';
import { createEnvelopeValidator } from '../src/content/envelope-validator.mjs';
const schema = JSON.parse(await readFile(new URL('../schemas/content-envelope.v1.schema.json', import.meta.url), 'utf8'));
const validate = createEnvelopeValidator(schema);
const paths = process.argv.slice(2);
if (!paths.length) {
  console.error('Usage: npm run validate:content-envelope -- <file.json|file.txt> [...]');
  process.exitCode = 2;
}
for (const file of paths) {
  let report;
  try {
    const info = await stat(file);
    if (!info.isFile() || info.size > 20 * 1024 * 1024) {
      report = { stage: 'envelope', envelopeValid: false, publicationChecked: false, diagnostics: [{ path: '/', keyword: 'file', message: 'Input must be a file of at most 20 MB', params: {} }] };
    } else {
      const text = await readFile(file, 'utf8');
      try { report = validate(JSON.parse(text)); }
      catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        report = { stage: 'envelope', envelopeValid: false, publicationChecked: false, diagnostics: [{ path: '/', keyword: 'json', message: 'Invalid JSON; input content omitted', params: {} }] };
      }
    }
  } catch {
    report = { stage: 'envelope', envelopeValid: false, publicationChecked: false, diagnostics: [{ path: '/', keyword: 'io', message: 'Cannot read or validate input', params: {} }] };
  }
  console.log(JSON.stringify({ file, ...report }));
  if (!report.envelopeValid) process.exitCode = 1;
}
