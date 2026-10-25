-- sql/003_ident_norm_duplicados.sql — PROMPT 3
-- Control de registros duplicados por identificación normalizada.
-- REVERSIBLE. NO borra ni modifica registros existentes.
--
-- Ejecutar contra una base de desarrollo/copia. Antes, pg_dump de la base real.
-- Paso 4 (reporte) es SOLO LECTURA. Paso 5 (índice) fallará si existen
-- duplicados tras la normalización: revisar el reporte del paso 4 y decidir.

-- ============================================================
-- 1. Función de normalización de identificación (solo para comparar)
--    Quita espacios, puntos, guiones, guiones bajos y comas; mayúsculas.
-- ============================================================
CREATE OR REPLACE FUNCTION normalize_ident(ident text) RETURNS text AS $$
DECLARE
  v text;
BEGIN
  v := coalesce(ident, '');
  v := regexp_replace(v, '\s', '', 'g');      -- todos los espacios en blanco
  v := regexp_replace(v, '[.\-_,]', '', 'g'); -- puntos, guiones, _ y comas
  RETURN upper(v);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- 2. Columna de control (no altera lo que se muestra en la planilla)
-- ============================================================
ALTER TABLE attendance_runtime_records
  ADD COLUMN IF NOT EXISTS ident_norm TEXT;

-- ============================================================
-- 3. Backfill: normaliza los registros ya existentes
-- ============================================================
UPDATE attendance_runtime_records
SET ident_norm = normalize_ident(identification)
WHERE ident_norm IS NULL;

-- ============================================================
-- 4. REPORTE de duplicados existentes (SOLO LECTURA, enmascarado)
--    Muestra asistencia + ident normalizada + cuántos registros hay.
--    No se borra nada. Revisar antes del paso 5.
-- ============================================================
SELECT
  session_id,
  ident_norm,
  count(*) AS total_registros,
  count(*) - 1 AS posibles_duplicados,
  -- UUID del registro que se conservaría (el más antiguo)
  min(id) AS registro_mas_antiguo
FROM attendance_runtime_records
WHERE ident_norm IS NOT NULL
GROUP BY session_id, ident_norm
HAVING count(*) > 1
ORDER BY session_id, ident_norm;

-- ============================================================
-- 5. Índice único para impedir duplicados en adelante
--    FALLA si el paso 4 devolvió filas (hay duplicados antiguos).
--    En ese caso: decidir qué hacer con los duplicados y luego crear
--    el índice manualmente. No se borran registros.
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_runtime_records_session_ident_norm
  ON attendance_runtime_records(session_id, ident_norm);

-- ============================================================
-- REVERSIBILIDAD (ejecutar solo si se desea deshacer):
-- DROP INDEX IF EXISTS idx_runtime_records_session_ident_norm;
-- ALTER TABLE attendance_runtime_records DROP COLUMN IF EXISTS ident_norm;
-- DROP FUNCTION IF EXISTS normalize_ident(text);
-- ============================================================
