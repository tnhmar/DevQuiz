# UI-03 retry: smaller commits
The owner reported a generic error with no details and requested a smaller retry. This is a source retry/refactor, not a diagnosed or verified error fix.
1. reader-text.tsx: plain text helpers, inline text/emphasis, explicit HTTP/HTTPS reference confirmation and optional term callbacks.
2. reader-figure.tsx: local registered figure rendering and zoom controls.
3. content-renderer.tsx: assemble the smaller helpers for the eight typed block variants and glossary sheets.
4. lesson screen wiring and final task notes.
The first helper commit does not modify the active renderer or lesson screen; integration follows after the helper files are written. Keep demo JSON, questions, package dependencies, workflows and progress storage unchanged. No book content or automated content pipeline is introduced.
No repository inspection, verification, syntax/schema checks, typechecking, tests, builds or CI runs will be performed before or after these pushes. Each commit is a small source change; runtime behaviour remains unverified.
