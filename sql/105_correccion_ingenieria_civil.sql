-- sql/105_correccion_ingenieria_civil.sql
-- Corrección de datos: Ingeniería Civil / representante Ángela / nivel V.
-- PROPÓSITO: dejar las ofertas y asignaciones del caso Civil/Ángela con el
-- programa/facultad/nivel correctos cuando hoy salen vacíos o cruzados.
-- NO APLICAR AUTOMÁTICAMENTE. Ejecutar solo tras revisar los SELECT previos
-- con una persona que conozca el dato correcto.
-- Reversible: crea respaldo _respaldo_20261119_* y la sección REVERSA al final
-- restaura los valores previos desde ese respaldo.
--
-- Requisitos/compatibilidad:
--   - No cambia el esquema.
--   - Requiere que existan las tablas/columnas consultadas (attendance_*,
--     course_offerings, academic_groups, academic_programs, faculties, etc.).
--   - Si algún identificador no existe en la BD objetivo, ajustar los WHERE
--     (id/nombre/código) antes de ejecutar.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) DIAGNÓSTICO PREVIO (SELECT) — revisar antes de cualquier UPDATE
-- ---------------------------------------------------------------------------
-- 0.1 Representante(s) Ángela y sus ofertas asignadas
SELECT r.id AS representante_id, r.name, r.username, ro.course_offering_id,
       o.group_id, o.status AS oferta_status,
       sub.code AS codigo, sub.name AS asignatura,
       g.program_id, apr.name AS programa, f.name AS facultad,
       al.name AS nivel
  FROM attendance_representatives r
  JOIN attendance_representative_offerings ro ON ro.representative_id = r.id
  JOIN course_offerings o ON o.id = ro.course_offering_id
  JOIN curriculum_subjects cs ON cs.id = o.curriculum_subject_id
  JOIN subjects sub ON sub.id = cs.subject_id
  LEFT JOIN academic_groups g ON g.id = o.group_id
  LEFT JOIN academic_programs apr ON apr.id = g.program_id
  LEFT JOIN faculties f ON f.id = apr.faculty_id
  LEFT JOIN academic_levels al ON al.id = cs.academic_level_id
 WHERE r.name ILIKE '%ngela%'
 ORDER BY r.id, o.id;

-- 0.2 Programa/facultad objetivo para Ingeniería Civil (ajustar nombre si difiere)
SELECT apr.id AS programa_id, apr.name AS programa, apr.faculty_id, f.name AS facultad
  FROM academic_programs apr
  LEFT JOIN faculties f ON f.id = apr.faculty_id
 WHERE apr.name ILIKE '%ingenier%civil%';

-- 0.3 Nivel V
SELECT id AS nivel_id, number, name FROM academic_levels WHERE number = 5 OR name ILIKE '%V%';

-- 0.4 Grupos candidatos de Ingeniería Civil, nivel V, periodo activo (ajustar filtros)
SELECT ag.id AS grupo_id, ag.name, ag.code, ag.program_id, apr.name AS programa,
       ag.academic_period_id, ap.name AS periodo, ag.academic_level_id, al.name AS nivel
  FROM academic_groups ag
  JOIN academic_programs apr ON apr.id = ag.program_id
  LEFT JOIN faculties f ON f.id = apr.faculty_id
  JOIN academic_periods ap ON ap.id = ag.academic_period_id
  LEFT JOIN academic_levels al ON al.id = ag.academic_level_id
 WHERE apr.name ILIKE '%ingenier%civil%'
   AND (al.number = 5 OR al.name ILIKE '%V%')
 ORDER BY ap.year DESC NULLS LAST, ap.term DESC NULLS LAST, ag.name;

-- 0.5 Plan de estudios (curriculum) activo del programa Civil (requisito para crear ofertas)
SELECT c.id AS curriculum_id, c.program_id, apr.name AS programa, c.status, c.name
  FROM curriculums c
  JOIN academic_programs apr ON apr.id = c.program_id
 WHERE apr.name ILIKE '%ingenier%civil%' AND c.status = 'ACTIVE';

-- 0.6 Ofertas de Civil/Ángela sin grupo o con programa/nivel inconsistente (filas a corregir)
SELECT o.id AS course_offering_id, o.group_id, o.curriculum_subject_id,
       sub.code, sub.name AS asignatura,
       cs.academic_level_id, al.name AS nivel_en_plan,
       g.program_id AS grupo_programa_id, apr.name AS grupo_programa, f.name AS facultad
  FROM attendance_representative_offerings ro
  JOIN attendance_representatives r ON r.id = ro.representative_id
  JOIN course_offerings o ON o.id = ro.course_offering_id
  JOIN curriculum_subjects cs ON cs.id = o.curriculum_subject_id
  JOIN subjects sub ON sub.id = cs.subject_id
  LEFT JOIN academic_levels al ON al.id = cs.academic_level_id
  LEFT JOIN academic_groups g ON g.id = o.group_id
  LEFT JOIN academic_programs apr ON apr.id = g.program_id
  LEFT JOIN faculties f ON f.id = apr.faculty_id
 WHERE r.name ILIKE '%ngela%'
   AND (o.group_id IS NULL OR apr.name IS DISTINCT FROM (SELECT name FROM academic_programs WHERE name ILIKE '%ingenier%civil%' LIMIT 1));

-- ---------------------------------------------------------------------------
-- 1) RESPALDO de filas afectadas (antes de modificar)
-- ---------------------------------------------------------------------------
-- Ajustar el criterio de "afectadas" para que coincida exactamente con los
-- UPDATE de la sección 2. Aquí se respalda el group_id previo de las ofertas
-- asignadas a Ángela que hoy no apuntan a un grupo de Ingeniería Civil.
DROP TABLE IF EXISTS _respaldo_20261119_angela_offerings;
CREATE TABLE _respaldo_20261119_angela_offerings AS
SELECT o.id AS course_offering_id, o.group_id AS group_id_anterior,
       g.program_id AS programa_id_anterior, apr.name AS programa_anterior,
       now() AS respaldado_en
  FROM attendance_representative_offerings ro
  JOIN attendance_representatives r ON r.id = ro.representative_id
  JOIN course_offerings o ON o.id = ro.course_offering_id
  LEFT JOIN academic_groups g ON g.id = o.group_id
  LEFT JOIN academic_programs apr ON apr.id = g.program_id
 WHERE r.name ILIKE '%ngela%'
   AND (o.group_id IS NULL OR apr.name NOT ILIKE '%ingenier%civil%');

-- Verificar respaldo
SELECT * FROM _respaldo_20261119_angela_offerings;

-- ---------------------------------------------------------------------------
-- 2) CORRECCIÓN (ejemplo/plantilla) — AJUSTAR IDs/CONDICIONES ANTES DE EJECUTAR
-- ---------------------------------------------------------------------------
-- Estrategia propuesta (elegir la que corresponda al dato real):
--   A) Si la oferta debe pertenecer a un grupo existente correcto de Civil V:
--      UPDATE course_offerings SET group_id = <GRUPO_CIVIL_V_ID>
--       WHERE id IN (SELECT course_offering_id FROM _respaldo_20261119_angela_offerings);
--   B) Si además falta asignar la oferta a Ángela como representante:
--      INSERT INTO attendance_representative_offerings (representative_id, course_offering_id)
--      SELECT <REPRESENTANTE_ID>, <OFFERING_ID>
--       WHERE NOT EXISTS (
--         SELECT 1 FROM attendance_representative_offerings
--          WHERE representative_id = <REPRESENTANTE_ID> AND course_offering_id = <OFFERING_ID>);
--      (respaldar inserts en otra tabla _respaldo_20261119_angela_ro_inserts si se usan)
--   C) Si la oferta no existe y debe crearse: usar el flujo normal de
--      administración (/api/admin/offerings) una vez exista el plan activo del
--      programa Civil; NO crear ofertas a mano sin validar curriculum_subject.

-- EJEMPLO (comentado): reasignar group_id al grupo correcto identificado en 0.4
-- UPDATE course_offerings o
--    SET group_id = <GRUPO_CIVIL_V_ID_CORRECTO>
--   FROM _respaldo_20261119_angela_offerings b
--  WHERE o.id = b.course_offering_id
--    AND <GRUPO_CIVIL_V_ID_CORRECTO> IS NOT NULL;

-- Verificación post-corrección
-- SELECT o.id, o.group_id, apr.name AS programa, f.name AS facultad, al.name AS nivel
--   FROM course_offerings o
--   LEFT JOIN academic_groups g ON g.id = o.group_id
--   LEFT JOIN academic_programs apr ON apr.id = g.program_id
--   LEFT JOIN faculties f ON f.id = apr.faculty_id
--   JOIN curriculum_subjects cs ON cs.id = o.curriculum_subject_id
--   LEFT JOIN academic_levels al ON al.id = cs.academic_level_id
--  WHERE o.id IN (SELECT course_offering_id FROM _respaldo_20261119_angela_offerings);

-- Confirmar solo cuando los SELECT muestren el resultado esperado.
-- COMMIT;

-- Por seguridad este script termina en ROLLBACK para no aplicar cambios por accidente.
ROLLBACK;

-- ---------------------------------------------------------------------------
-- REVERSA (ejecutar en una transacción nueva si la corrección ya fue aplicada)
-- ---------------------------------------------------------------------------
-- BEGIN;
-- UPDATE course_offerings o
--    SET group_id = b.group_id_anterior
--   FROM _respaldo_20261119_angela_offerings b
--  WHERE o.id = b.course_offering_id;
-- -- Si se insertaron filas en attendance_representative_offerings, eliminarlas
-- -- usando el respaldo de inserts correspondiente.
-- COMMIT;
--
-- NOTAS:
-- - Si no existe programa "Ingeniería Civil", facultad o grupo/nivel V en el
--   catálogo, deben crearse primero por administración/datos maestros; este
--   script no los inventa.
-- - Si el programa Civil no tiene curriculum ACTIVO, no se pueden crear ofertas
--   nuevas (api/admin/offerings responde NO_ACTIVE_CURRICULUM_FOR_PROGRAM).
-- - Sin acceso a la BD real no se pudo confirmar la causa exacta; usar los
--   SELECT de la sección 0 (y sql/105_diagnostivo_ingenieria_civil.sql) para
--   determinarla antes de aplicar.
