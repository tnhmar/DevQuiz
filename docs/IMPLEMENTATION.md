# Implementation status — Foundation 0.1
This is source prepared for the first commit, not a completed app or validated production build.

Included: Expo Router phone/tablet entry screen; SQLite demo-event persistence; pure choice-scoring and unassisted-evidence guards; a minimal content-envelope preflight; Node TypeScript tests; Expo dependency-alignment bootstrap; CI instructions.
The demo is original UI text, not book-derived learning content. fixture=true prevents demo responses becoming learning evidence. Existing README is intentionally preserved.

Setup (Node >=22.13): npm install; npm run setup; npm run typecheck; npm test; npm start.
Setup aligns Expo modules and generates/updates package-lock.json. Review and commit the resolved manifest/lockfile in the next dependency-validation commit. This initial bootstrap is not yet a reproducible, validated build. CI runs setup and checks but does not push generated files or trigger paid EAS builds.

Not run in the preparation environment: npm dependency installation, TypeScript compilation, Expo builds, device tests. Tests are committed, not claimed passed. The preparation environment has Node 20; the project targets Node 22.13+.

Next: versioned JSON Schema/Ajv and full semantic validation; native/legacy adapters; staged import and atomic activation; content registry and typed-block reader; assessment snapshot migrations; review/evidence engines; exam deadline engine; verified seed packs; backup and accessibility/device checks.
No placeholders enter a production learning bank. No secrets or uploaded books are committed.
