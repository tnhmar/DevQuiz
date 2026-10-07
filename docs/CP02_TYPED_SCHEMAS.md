# CP-02: typed schemas in small commits
## CP-02a — lesson blocks and inline content
Scope: eight block variants (paragraph, heading, list, code, table, callout, figure, plain-text formula) and four inline variants (text, emphasis, HTTPS/HTTP link, term reference). Unknown fields are rejected; text and collection sizes are bounded. Code whitespace is preserved. Figure alt text, table alternatives and formula alternatives are structurally required.
Files: schemas/lesson-blocks.v1.schema.json; src/content/blocks.ts; src/content/block-validator.mjs; scripts/lesson-blocks.test.mjs.
The wrapper compiles a trusted application schema, not one supplied by imported content. It returns publicationChecked=false. Structural success does not approve facts, rights, sources or safe activation. HTTP/HTTPS pattern checking is not URL-origin trust enforcement. Unicode/text meaning, global IDs, term/asset existence and equal table row widths belong to later gates. Formula is literal text, not executable math/HTML.
The TypeScript unions describe parsed trusted values; they are not runtime validation. Fixtures are original test material, not learning questions or book content. The envelope from CP-01 is unchanged and is not automatically upgraded into a complete pipeline.
Tests are provided but have not been run for this task. No syntax checks, schema checks, typechecking, CI inspection or device checks were performed before preparing the commit; none will be performed after pushing.
Future explicit test command (not run here): node --test scripts/lesson-blocks.test.mjs.
## Remaining CP-02 commits
CP-02b: single/multi/true_false/open question-response contracts and rubric schemas.
CP-02c: domain/track/concept/chapter/lesson/source/claim/asset/test/profile entity contracts.
CP-02d: composed typed-envelope integration and authoring fixtures/commands.
Semantic relationships are CP-03; factual verification and editorial publication are CP-04. No unverified content is activated by any CP-02 fragment.
