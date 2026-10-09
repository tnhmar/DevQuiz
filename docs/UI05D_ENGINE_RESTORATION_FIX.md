# UI-05d engine restoration correction
The commit c08e035 accidentally replaced the complete choice engine, open engine, and recovery loader with fragments. This correction restores the full pre-restore implementations, appends the reviewed choice/open restore helpers, and restores the loader from c29e5f1. No practice screens, checkpoint capture, automatic resume, repository/schema or fixture code is changed.

Choice restore validates the persisted phase, pinned question order/revisions, captured answers, selections, score consistency, assistance/confidence captures and retry lineage without dispatching submit. Open restore preserves writing/rating/finished phase, original text, locked confidence, rubric ratings and finalized subjective result without replaying submit, finish, rating or reveal. The loader is returned to its complete pre-truncation implementation; active-open candidate adjustment is deferred.

This source correction has not been typechecked or tested. Compatibility and runtime behaviour remain unverified. No tests, builds, database operations or recovery actions were performed in preparation or after push.
