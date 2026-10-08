export const ATTEMPT_DATABASE_NAME = 'devquiz-attempts.db';
export const ATTEMPT_SCHEMA_VERSION = 2;
export const ATTEMPT_SCHEMA_V1 = `
CREATE TABLE attempt_records (
  record_id TEXT PRIMARY KEY NOT NULL CHECK(length(trim(record_id)) BETWEEN 1 AND 128),
  session_id TEXT NOT NULL CHECK(length(trim(session_id)) > 0),
  pack_id TEXT NOT NULL CHECK(length(trim(pack_id)) > 0),
  content_version TEXT NOT NULL CHECK(length(trim(content_version)) > 0),
  language TEXT NOT NULL CHECK(language IN ('en', 'fr')),
  question_id TEXT NOT NULL CHECK(length(question_id) > 0),
  question_revision INTEGER NOT NULL CHECK(question_revision >= 1),
  kind TEXT NOT NULL CHECK(kind IN ('choice', 'open')),
  objective INTEGER NOT NULL CHECK(objective IN (0, 1)),
  fixture INTEGER NOT NULL CHECK(fixture IN (0, 1)),
  committed_at REAL NOT NULL CHECK(committed_at >= 0),
  recorded_at REAL NOT NULL CHECK(recorded_at >= committed_at),
  record_json TEXT NOT NULL CHECK(json_valid(record_json)),
  CHECK((kind = 'choice' AND objective = 1) OR (kind = 'open' AND objective = 0)),
  UNIQUE(session_id, pack_id, content_version, language, question_id, question_revision, kind)
);
CREATE INDEX attempt_records_session_time ON attempt_records(session_id, committed_at, record_id);
CREATE INDEX attempt_records_fixture_kind_time ON attempt_records(fixture, kind, committed_at);
CREATE TRIGGER attempt_records_no_update BEFORE UPDATE ON attempt_records BEGIN
  SELECT RAISE(ABORT, 'Attempt records cannot be updated');
END;
CREATE TRIGGER attempt_records_no_delete BEFORE DELETE ON attempt_records BEGIN
  SELECT RAISE(ABORT, 'Attempt records cannot be deleted through ordinary SQL');
END;
CREATE TRIGGER attempt_records_no_replace BEFORE INSERT ON attempt_records
WHEN EXISTS (
  SELECT 1 FROM attempt_records WHERE record_id = NEW.record_id
    OR (session_id = NEW.session_id AND pack_id = NEW.pack_id
      AND content_version = NEW.content_version AND language = NEW.language
      AND question_id = NEW.question_id AND question_revision = NEW.question_revision AND kind = NEW.kind)
) BEGIN
  SELECT RAISE(ABORT, 'Existing attempts cannot be replaced');
END;
PRAGMA user_version = 1;
`;
export const ATTEMPT_SCHEMA_V2 = `
CREATE TABLE session_checkpoints (
  session_id TEXT PRIMARY KEY NOT NULL CHECK(length(trim(session_id)) > 0),
  kind TEXT NOT NULL CHECK(kind IN ('choice', 'open')),
  revision INTEGER NOT NULL CHECK(revision >= 1),
  fixture INTEGER NOT NULL CHECK(fixture IN (0, 1)),
  status TEXT NOT NULL CHECK(status IN ('active', 'completed')),
  updated_at REAL NOT NULL CHECK(updated_at >= 0),
  pending_count INTEGER NOT NULL CHECK(pending_count >= 0),
  discarded INTEGER NOT NULL DEFAULT 0 CHECK(discarded IN (0, 1)),
  checkpoint_json TEXT NOT NULL CHECK(json_valid(checkpoint_json))
);
CREATE INDEX session_checkpoints_resume ON session_checkpoints(discarded, status, updated_at, session_id);
CREATE INDEX session_checkpoints_pending ON session_checkpoints(pending_count, updated_at, session_id);
PRAGMA user_version = 2;
`;
