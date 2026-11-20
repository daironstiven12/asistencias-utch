-- 106_docente_temas_firmas.sql — PROMPT 15. PostgreSQL puro. NO APLICAR.
-- Dos adiciones para la pantalla del docente:
--   1) Temas tratados con fuente única en el servidor (attendance_runtime_sessions.topics).
--   2) Firma guardada del docente (docente_firmas), vinculada al docente de la oferta.
-- Reversible: cada bloque tiene su DROP/ALTER inverso comentado al final.
-- Las funciones nuevas quedan ocultas (sin error) si este script aún no se aplicó.

-- ============================================================
-- 1) TEMAS TRATADOS
-- ============================================================
-- Texto plano del tema de la clase. Lo escribe el representante o el docente;
-- el último guardado gana. NULL = sin tema.
ALTER TABLE attendance_runtime_sessions
  ADD COLUMN IF NOT EXISTS topics TEXT NULL;

-- Versión del tema: permite que el polling liviano detecte cambios sin
-- descargar firmas. Se actualiza sola con el tema.
ALTER TABLE attendance_runtime_sessions
  ADD COLUMN IF NOT EXISTS topics_updated_at TIMESTAMPTZ NULL;

-- Índice no necesario (solo se lee por id de sesión, que ya es PK).

-- ============================================================
-- 2) FIRMA GUARDADA DEL DOCENTE
-- ============================================================
-- docente_id usa EXACTAMENTE el tipo de teaching_assignments.user_id
-- (la columna con la que la oferta apunta al docente). Se resuelve en
-- tiempo de ejecución para no hardcodear bigint/uuid.
-- Sin FK: la firma guardada no debe impedir borrados de catálogo y su DROP
-- es limpio. La autorización sigue validando que la oferta sea del docente.
DO $$
DECLARE
  tipo text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO tipo
    FROM pg_attribute a
    JOIN pg_class c      ON c.oid = a.attrelid
    JOIN pg_namespace n  ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname  = 'teaching_assignments'
     AND a.attname  = 'user_id'
     AND a.attnum > 0
     AND NOT a.attisdropped;

  IF tipo IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar el tipo de teaching_assignments.user_id';
  END IF;

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS docente_firmas (
       docente_id %s PRIMARY KEY,
       signature  TEXT NOT NULL,
       updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )',
    tipo
  );
END $$;

-- ============================================================
-- REVERSA (comentada — ejecutar solo para deshacer)
-- ============================================================
-- DROP TABLE IF EXISTS docente_firmas;
-- ALTER TABLE attendance_runtime_sessions DROP COLUMN IF EXISTS topics_updated_at;
-- ALTER TABLE attendance_runtime_sessions DROP COLUMN IF EXISTS topics;

-- Nota: al quitar las columnas, las funciones del docente vuelven a quedar
-- ocultas (los endpoints responden "no disponible") y el flujo anterior
-- (firma manual por clase, temas solo en el navegador del representante)
-- sigue funcionando exactamente igual.
