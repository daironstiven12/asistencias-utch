-- sql/107_diagnostico_firma_docente_espuria.sql
-- DIAGNÓSTICO (solo SELECT, sin aplicar): asistencias posiblemente firmadas por el
-- docente de forma espuria (firma heredada/automática, no una acción explícita
-- esperada en ese momento). NO genera ningún UPDATE ni modifica datos.
--
-- Contexto: se reportó que algunas asistencias aparecen con "FIRMA DEL DOCENTE"
-- al abrirse, sin que nadie la haya firmado. Sospecha: herencia de firma local
-- (navegador/borrador) mostrada en cliente. Estas consultas ayudan a ver cuántas
-- sesiones en BD tienen firma de docente sospechosa por tiempo o por repetición.

-- 1) Sesiones con firma de docente registrada muy cerca de la creación (< 10 s).
--    Una firma legítima confirmada durante la clase suele ocurrir después; un
--    intervalo muy corto puede indicar carga/arrastre anómalo.
SELECT
  s.id,
  s.course_offering_id,
  s.status,
  s.created_at,
  s.opened_at,
  s.teacher_signed_at,
  ROUND(EXTRACT(EPOCH FROM (s.teacher_signed_at - s.created_at))::numeric, 3) AS segundos_desde_creacion,
  s.created_by_representative_id
FROM attendance_runtime_sessions s
WHERE s.teacher_signature IS NOT NULL
  AND s.teacher_signed_at IS NOT NULL
  AND s.created_at IS NOT NULL
  AND ABS(EXTRACT(EPOCH FROM (s.teacher_signed_at - s.created_at))) < 10
ORDER BY s.created_at DESC;

-- 2) Resumen de cuántas sesiones cumplen el criterio anterior.
SELECT
  COUNT(*) AS sesiones_firma_muy_cercana_a_creacion
FROM attendance_runtime_sessions s
WHERE s.teacher_signature IS NOT NULL
  AND s.teacher_signed_at IS NOT NULL
  AND s.created_at IS NOT NULL
  AND ABS(EXTRACT(EPOCH FROM (s.teacher_signed_at - s.created_at))) < 10;

-- 3) Firmas de docente idénticas (misma imagen/hash) repetidas en sesiones
--    DISTINTAS de OFERTAS DISTINTAS. Una misma firma puede ser legítima en
--    varias sesiones de la misma oferta; repetirla en ofertas diferentes puede
--    indicar reutilización/arrastre indebido (revisar caso a caso).
SELECT
  md5(s.teacher_signature) AS firma_md5,
  COUNT(*) AS sesiones,
  COUNT(DISTINCT s.id) AS sesiones_distintas,
  COUNT(DISTINCT s.course_offering_id) AS ofertas_distintas,
  MIN(s.created_at) AS primera,
  MAX(s.created_at) AS ultima
FROM attendance_runtime_sessions s
WHERE s.teacher_signature IS NOT NULL
GROUP BY md5(s.teacher_signature)
HAVING COUNT(DISTINCT s.course_offering_id) > 1
   AND COUNT(DISTINCT s.id) > 1
ORDER BY ofertas_distintas DESC, sesiones DESC;

-- 4) Detalle de las sesiones cuyas firmas se repiten en ofertas distintas (del #3).
WITH repetidas AS (
  SELECT md5(teacher_signature) AS firma_md5
  FROM attendance_runtime_sessions
  WHERE teacher_signature IS NOT NULL
  GROUP BY md5(teacher_signature)
  HAVING COUNT(DISTINCT course_offering_id) > 1 AND COUNT(DISTINCT id) > 1
)
SELECT
  md5(s.teacher_signature) AS firma_md5,
  s.id,
  s.course_offering_id,
  s.status,
  s.created_at,
  s.teacher_signed_at,
  s.created_by_representative_id
FROM attendance_runtime_sessions s
JOIN repetidas r ON md5(s.teacher_signature) = r.firma_md5
ORDER BY firma_md5, s.created_at DESC;
