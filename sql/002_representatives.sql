-- 002_representatives.sql — PostgreSQL puro.
-- Representantes runtime, asignación de ofertas y propiedad/bloqueo/firma
-- en attendance_runtime_sessions. No toca tablas académicas ni datos.

CREATE TABLE IF NOT EXISTS attendance_representatives (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_representative_offerings (
  representative_id UUID NOT NULL REFERENCES attendance_representatives(id) ON DELETE CASCADE,
  course_offering_id BIGINT NOT NULL REFERENCES course_offerings(id),
  PRIMARY KEY (representative_id, course_offering_id)
);

ALTER TABLE attendance_runtime_sessions
  ADD COLUMN IF NOT EXISTS representative_id UUID NULL
  REFERENCES attendance_representatives(id) ON DELETE SET NULL;

ALTER TABLE attendance_runtime_sessions
  ADD COLUMN IF NOT EXISTS registration_open BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE attendance_runtime_sessions
  ADD COLUMN IF NOT EXISTS representative_signature TEXT NULL;

ALTER TABLE attendance_runtime_sessions
  ADD COLUMN IF NOT EXISTS representative_signed_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_runtime_sessions_representative
  ON attendance_runtime_sessions(representative_id);

CREATE INDEX IF NOT EXISTS idx_representative_offerings_offering
  ON attendance_representative_offerings(course_offering_id);
