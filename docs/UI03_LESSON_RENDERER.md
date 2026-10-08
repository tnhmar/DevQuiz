# UI-03 — modular typed lesson renderer
UI-03 was retried as four small source commits after a generic error report. The retry is not a diagnosis or a verified runtime fix.
Modules:
- src/ui/reader-text.tsx: plain explanations, inline text/emphasis, explicit external-link confirmation and term callbacks.
- src/ui/reader-figure.tsx: caller-registered local figures, alt text/captions and button-based zoom.
- src/ui/content-renderer.tsx: paragraph/heading/list/code/table/callout/formula/figure composition and term-definition sheets.
- app/lesson/[id].tsx: schema-backed lesson lookup, unknown-ID state, navigation and renderer integration keyed by lesson ID/revision.
Code and formulas are literal text, never executed. Tables retain text alternatives. Remote media is not turned into a source by the renderer. Figure rights, containment and integrity remain the caller's responsibility. Missing glossary/assets produce unavailable states; the tiny current demo has no glossary or figures.
Syntax highlighting, large-document virtualization, gesture zoom, normal-content activation and real asset/glossary registries are not completed by this retry. Practice rendering and persistent progress remain unchanged. No books or vendor questions are authored; demo JSON/questions, dependencies and workflows are unchanged. Automated content processing stays paused.
No repository inspection, verification, schema/syntax checks, typechecking, tests, builds or CI runs were performed before or after these source pushes. No claim is made that the generic error has been resolved or that a production build works.
