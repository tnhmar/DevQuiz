# Content pipeline milestone — 12 tasks
Baseline: DevQuiz PRD v2.1; repository base 8e52aa74f410335b1f9dee3227f5fdacb5a45026.
Each task is a small reviewable commit with fixtures/tests. No task may enable unverified draft material as learning content.

| Task | Deliverable | Depends on | Completion gate |
|---|---|---|---|
| CP-01 | Versioned envelope/manifest schema, draft/invalid fixtures, reusable structural validator, CLI and tests | Foundation | Schema/fixture checks; explicit publicationUnchecked |
| CP-02 | Typed entity/block/response schemas and TypeScript contracts | CP-01 | Correct type-specific fields; all v1 question/block forms |
| CP-03 | Semantic reference/ID/dependency/answer validation | CP-02 | Duplicate IDs, broken refs, cycles and invalid answers rejected |
| CP-04 | Claim verification and revision-bound editorial publication gate | CP-03 | Approved-but-unverified content remains staged |
| CP-05 | CitizenshipExam JSON/XML legacy adapter and stable-ID migration | CP-02/03 | Identical duplicates normalize; conflicting definitions reject |
| CP-06 | SQLite content registry, migrations and indexed revision storage | CP-03 | Registry/snapshot preservation and migration tests |
| CP-07 | OS file picker and staged bounded runtime import | CP-03/04/06 | JSON/TXT import with progress and no active-data mutation |
| CP-08 | Atomic activation, disable/delete and content rollback | CP-07 | Interrupted activation cannot damage progress or active packs |
| CP-09 | ZIP assets, hashes, safe paths and offline media | CP-07/08 | Corrupt/traversal/executable/oversized archives rejected |
| CP-10 | French revision compatibility and explicit fallback | CP-04/08 | No duplicate mastery/unseen-family inflation |
| CP-11 | Author packaging, coverage/verification/translation reports | CP-04/05/09/10 | Useful diagnostics; draft-only packs cannot pass release gates |
| CP-12 | Device/offline/forced-kill/restore/performance integration gates | All | PRD acceptance cases for pipeline pass on supported devices |

## Task CP-01 scope
Implemented source in this change: Draft-07 JSON Schema for the envelope, pack manifest, entity identifiers/revisions/status and collection shapes. Root/data/manifest unknown fields are rejected. Schema version is exactly 1.0.0; contentVersion/minAppVersion use three-part versions; language is en/fr; capability/dependency/source lists are structurally checked.
Entity bodies remain intentionally open beyond identity: CP-02 adds type-specific schemas, CP-03 references/scoring/dependency graph checks, CP-04 publication. The envelope validator must never be the final activation decision. Even a successful result includes publicationChecked=false. Existing core contentPreflight is not replaced or promoted to a full validator by this task.
Calendar date correctness, global ID uniqueness, existence of source IDs, app-version/capability availability, license authenticity and alias compatibility are later semantic/security gates. The createdAt pattern checks YYYY-MM-DD shape only. Claims of published status in a record do not constitute publication approval.
The empty fixture is original test data, not a study pack or book-derived content. It deliberately has no questions and cannot satisfy production bank/coverage/publication requirements. Invalid fixtures are mutations of it rather than copied real content.

## Files and commands
- schemas/content-envelope.v1.schema.json — authoritative envelope/manifest contract.
- fixtures/content/envelope-draft.en.json — valid empty authoring fixture.
- fixtures/content/envelope-invalid-cases.json — negative mutation cases.
- src/content/envelope-validator.mjs — reusable Ajv wrapper; caller supplies the trusted application schema, never a schema from the pack.
- scripts/validate-content-envelope.mjs — file validation, 20 MB cap, one JSON diagnostic report per input; does not log private input content.
- scripts/content-envelope.test.mjs — 22 Node/Ajv tests.
- package.json — pins Ajv 8.17.1, includes content tests in npm test and adds CLI commands; existing app commands preserved.

After npm install: npm run test:content; npm run validate:content-envelope -- fixtures/content/envelope-draft.en.json.
Exit codes: 0 structurally valid; 1 invalid/unreadable/oversized input; 2 missing CLI arguments. A zero exit is not publication permission.
The validator does not coerce types, insert defaults or strip additional fields. Diagnostic arrays are snapshots, not references to mutable Ajv error state.

## Validation evidence at preparation
Python jsonschema Draft7Validator: schema self-validation and 20 positive/negative contract assertions passed. JavaScript syntax checks: all three .mjs files passed node --check. Node/Ajv test execution was attempted but stopped at module loading because ajv is not installed in the preparation environment; none of its 22 cases ran. CLI execution and CI remain unverified pending dependency installation. Existing Expo build/typecheck status remains unverified.
No app/UI/SQLite importer changes in CP-01. CP-02 is the next task, not silently bundled into this commit.
