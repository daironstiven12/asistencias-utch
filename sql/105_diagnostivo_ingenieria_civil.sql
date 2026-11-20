-- 105_diagnostivo_ingenieria_civil.sql (SOLO SELECT — NO se ejecuta)
/*
  Diagnóstico: Ángela (Representante de Ingeniería Civil, V semestre).
  Señala dónde aparece Telecomunicaciones e Informática y qué falta de
  Ingeniería Civil (programa, plan, grupos, materias de su área).
*/

-- (1) Chaîne completa de la(s) oferta(s) de Ángela:
--     oferta → asignatura → grupo/semestre → programa(oferta) → plan(curricula)
--     → programa del plan → periodo. Si aparece Telecom = dato de la oferta mal calzado.
SELECT DISTINCT
  r.id            AS rep_id,
  r.name          AS rep_nombre,
  r.username      AS rep_username,
  o.id            AS oferta_id,
  sub.name        AS asignatura,
  sub.code        AS codigo,
  g.id            AS grupo_id,
  g.name          AS grupo,
  al.number       AS semestre,
  gp.id           AS programa_oferta_id,
  gp.name         AS programa_oferta,
  cur.id          AS plan_id,
  app.id          AS programa_plan_id,
  app.name        AS programa_plan,
  ap.id           AS periodo_id,
  ap.name         AS periodo,
  f.name          AS facultad,
  CASE
    WHEN gp.name ILIKE '%telem%' OR g.name ILIKE '%telem%' THEN '** APARECE TELECOMUNICACIONES (oferta) **'
    WHEN gp.name IS NULL THEN '** Oferta sin programa definido (feo en calzada) **'
    ELSE ''
  END AS alarma
FROM attendance_representatives r
JOIN attendance_representative_offerings ro ON ro.representative_id = r.id
JOIN course_offerings o                   ON o.id = ro.course_offering_id
LEFT JOIN curriculum_subjects cs          ON cs.id = o.curriculum_subject_id
LEFT JOIN subjects sub                   ON sub.id = cs.subject_id
LEFT JOIN academic_groups g              ON g.id = o.group_id
LEFT JOIN academic_levels al             ON al.id = g.academic_level_id
LEFT JOIN academic_programs gp           ON gp.id = g.program_id
LEFT JOIN curricula cur                  ON cur.id = cs.curriculum_id
LEFT JOIN academic_programs app          ON app.id = cur.program_id
LEFT JOIN academic_periods ap            ON ap.id = o.academic_period_id
LEFT JOIN faculties f                    ON f.id = gp.faculty_id
WHERE r.name ILIKE '%ngela%';

-- (2) Programas Civiles
SELECT id, name, faculty_id
FROM academic_programs
WHERE name ILIKE '%civil%';

-- (3) Planes (curricula) que apuntan a un programa Civil y su programa
SELECT c.id AS plan_id, c.program_id, ap.name AS programa_nombre
FROM curricula c
JOIN academic_programs ap ON ap.id = c.program_id
WHERE ap.name ILIKE '%civil%'
ORDER BY c.id;

-- (4) Grupos de ofertas de Civil (programa Civil del grupo): semestre y
--     ofertas sin representante asignado.
SELECT g.id AS grupo_id,
       g.name AS grupo,
       al.number AS semestre,
       EXISTS (SELECT 1 FROM attendance_representative_offerings ro
               JOIN attendance_representatives rr ON rr.id = ro.representative_id
               WHERE ro.course_offering_id = o.id) AS tiene_representante
FROM academic_groups g
JOIN academic_levels al ON al.id = g.academic_level_id
JOIN academic_programs ap ON ap.id = g.program_id
LEFT JOIN course_offerings o ON o.group_id = g.id AND o.status = 'ACTIVE'
WHERE ap.name ILIKE '%civil%'
ORDER BY g.id;

-- (5) Grupos de la oferta Ángela: programa/semestre/periodo real (para
--     comparar con la cadena del ítem 1 y detectar otras ofertas Civil).
SELECT DISTINCT
  g.id AS grupo_id, g.name AS grupo,
  al.number AS semestre,
  gp.name AS programa,
  ap.name AS periodo
FROM academic_groups g
LEFT JOIN academic_levels al ON al.id = g.academic_level_id
LEFT JOIN academic_programs gp ON gp.id = g.program_id
LEFT JOIN academic_periods ap ON ap.id = g.academic_period_id
WHERE g.id IN (
  SELECT o.group_id FROM course_offerings o
  WHERE o.group_id IS NOT NULL AND o.status = 'ACTIVE'
    AND EXISTS (SELECT 1 FROM attendance_representative_offerings ro
                JOIN attendance_representatives r ON r.id = ro.representative_id
                WHERE ro.course_offering_id = o.id AND r.name ILIKE '%ngela%')
);
