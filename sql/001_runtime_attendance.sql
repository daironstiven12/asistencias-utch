-- 001_runtime_attendance.sql — PostgreSQL puro.
-- Tablas temporales del flujo de asistencia. No toca tablas existentes.

CREATE TABLE IF NOT EXISTS attendance_runtime_sessions (
  id UUID PRIMARY KEY,
  student_code TEXT NOT NULL UNIQUE,
  teacher_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  teacher_signature TEXT NULL,
  teacher_signed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ NULL,
  purge_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS attendance_runtime_records (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES attendance_runtime_sessions(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  identification TEXT NOT NULL,
  student_signature TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_runtime_session_ident UNIQUE (session_id, identification)
);

CREATE INDEX IF NOT EXISTS idx_runtime_records_session
  ON attendance_runtime_records(session_id);

CREATE INDEX IF NOT EXISTS idx_runtime_sessions_purge
  ON attendance_runtime_sessions(purge_at);

CREATE INDEX IF NOT EXISTS idx_runtime_sessions_status
  ON attendance_runtime_sessions(status);
