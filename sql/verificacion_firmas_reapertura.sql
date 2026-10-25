-- verificacion_firmas_reapertura.sql — SOLO LECTURA.
-- No modifica nada. Ejecutar con:
--   psql "$DATABASE_URL" -f sql/verificacion_firmas_reapertura.sql
-- o pegarlo en el editor SQL del proveedor. Reemplace los UUID de ejemplo.

-- 1) Estado y tamaño real de las firmas de una asistencia concreta.
--    length() en NULL o 0 indica firma ausente/vacía.
SELECT
  id,
  status,
  registration_open,
  length(teacher_signature)          AS bytes_firma_docente,
  teacher_signed_at,
  length(representative_signature)   AS bytes_firma_representante,
  representative_signed_at,
  created_at,
  closed_at,
  purge_at
FROM attendance_runtime_sessions
WHERE id = '00000000-0000-0000-0000-000000000000';

-- 2) Anomalías: firmas guardadas como cadena vacía (deben ser NULL).
SELECT count(*) AS firmas_vacias
FROM attendance_runtime_sessions
WHERE teacher_signature = '' OR representative_signature = '';

-- 3) Asistencias con más de una sesión abierta por representante
--    (debe devolver 0 filas tras aplicar la reapertura con confirmación).
SELECT representative_id, count(*) AS abiertas
FROM attendance_runtime_sessions
WHERE status = 'OPEN' AND representative_id IS NOT NULL
GROUP BY representative_id
HAVING count(*) > 1;

-- 4) Integridad de los registros de una asistencia reabierta: estudiantes
--    conservados y sin duplicados por identificación.
SELECT session_id, count(*) AS estudiantes,
       count(DISTINCT identification) AS identificaciones_distintas
FROM attendance_runtime_records
WHERE session_id = '00000000-0000-0000-0000-000000000000'
GROUP BY session_id;
