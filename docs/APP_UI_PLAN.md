# App-first pivot and UI-01
Decision: pause the automated book/content-authoring pipeline and separate CI content job. Build UI and study logic first using the contracts already authored. Later the owner supplies materials; the assistant prepares schema-conformant content and externally verifies AI-book claims before publication. No material is automatically treated as verified because it was extracted or AI-written.
UI-01 is a small navigation/layout commit, not a complete study app. It adds Home/Learn/Practice/Exams/Progress tabs, shared light/dark surfaces, responsive one/two-column cards, readable empty states and minimum-48-unit navigation actions. It uses existing Expo Router/React Native/safe-area dependencies; no package changes. React Native Paper/Zustand/localization remain planned stack components, not replaced as a product decision by this shell.
The root demo entry is replaced by a redirect to the study tabs. Existing core assessment modules, test source and SQLite files are not deleted or migrated. No original demo answer is promoted to learning evidence. There is no learning catalogue, quiz session, computed dashboard, exam deadline or file importer in UI-01. Cards adapt to viewport/font scale, but device/accessibility behaviour has not been verified.
Small follow-up tasks:
UI-02: schema-backed catalogue loading and domain/track/chapter browsing, with explicit draft/preview/approved states.
UI-03: lesson reader using typed blocks and glossary links.
UI-04: single/multi/Boolean practice sessions and open-answer rubrics.
UI-05: immutable SQLite responses, assistance/retry flags and recovery.
UI-06: review queue and level/dimension/version-specific evidence.
UI-07: profile-based exams, timing and historical snapshots.
UI-08: truthful progress views, settings, reminders and backup.
AUTHOR-01: materials-to-content authoring against the app's actual contracts, external fact checking and approved JSON handoff. Runtime JSON updates stay a requirement; pausing CI authoring does not mean hard-coding future books into screens.
The pending CP-02c3 commit is not authorized or pushed by this pivot. Remaining schema composition can be addressed as needed for catalogue integration; this commit does not silently include it. Existing content schemas and source records remain in place.
No checks, tests, repository reads, CI inspections or device verification were run for UI-01. No verification will run after the push. This commit does not assert a successful Expo build or working production app.
