"use strict";

/* POST /api/sessions/validate — valida un código temporal.
   STUDENT → { ok, role:'STUDENT', sessionId, status }
   TEACHER → { ok, role:'TEACHER', sessionId, status }
   Desconocido o sesión no abierta → { ok:false, error:'INVALID_OR_EXPIRED_CODE' }. */

const { query } = require("../../lib/db");

function readCode(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return undefined;
    }
  }
  if (!body || typeof body !== "object") return undefined;
  return body.code;
}

/* Datos académicos de la sesión vía course_offering_id.
   NULL si la sesión no tiene oferta vinculada. Sin secretos. */
async function loadSessionCfg(sessionId) {
  const empty = {
    facultad: null, programa: null, nivel: null, periodo: null,
    asignatura: null, codigo: null, docente: null, correo: null,
  };
  try {
    const r = await query(
      "SELECT f.name AS facultad, ap2.name AS programa, al.name AS nivel," +
        " ap.name AS periodo, s.name AS asignatura, s.code AS codigo," +
        " TRIM(COALESCE(p.first_name,'')||' '||COALESCE(p.middle_name||' ','')||COALESCE(p.last_name,'')||COALESCE(' '||p.second_last_name,'')) AS docente," +
        " p.email AS correo" +
        " FROM attendance_runtime_sessions rs" +
        " JOIN course_offerings co ON co.id = rs.course_offering_id" +
        " JOIN curriculum_subjects cs ON cs.id = co.curriculum_subject_id" +
        " JOIN subjects s ON s.id = cs.subject_id" +
        " JOIN academic_groups g ON g.id = co.group_id" +
        " JOIN academic_programs ap2 ON ap2.id = g.program_id" +
        " JOIN faculties f ON f.id = ap2.faculty_id" +
        " JOIN academic_periods ap ON ap.id = co.academic_period_id" +
        " LEFT JOIN academic_levels al ON al.id = cs.academic_level_id" +
        " LEFT JOIN teaching_assignments ta ON ta.course_offering_id = co.id AND ta.status = 'ACTIVE'" +
        " LEFT JOIN users u ON u.id = ta.user_id" +
        " LEFT JOIN persons p ON p.id = u.person_id" +
        " WHERE rs.id = $1 LIMIT 1",
      [sessionId]
    );
    const row = r.rows[0];
    if (!row) return empty;
    const docente = row.docente && row.docente.trim() !== "" ? row.docente.replace(/\s+/g, " ").trim() : null;
    return {
      facultad: row.facultad || null,
      programa: row.programa || null,
      nivel: row.nivel || null,
      periodo: row.periodo || null,
      asignatura: row.asignatura || null,
      codigo: row.codigo || null,
      docente,
      correo: row.correo || null,
    };
  } catch (err) {
    console.error("sessions validate cfg error:", err && err.message);
    return empty;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  const code = readCode(req);
  if (typeof code !== "string" || code.trim() === "") {
    return res.status(400).json({ ok: false, error: "INVALID_CODE" });
  }
  try {
    const normalized = code.trim().toUpperCase();
    const r = await query(
      "SELECT id, status," +
        " CASE WHEN student_code = $1 THEN 'STUDENT'" +
        " WHEN teacher_code = $1 THEN 'TEACHER' ELSE NULL END AS role" +
        " FROM attendance_runtime_sessions" +
        " WHERE student_code = $1 OR teacher_code = $1" +
        " LIMIT 1",
      [normalized]
    );
    const row = r.rows[0];
    if (!row || row.status !== "OPEN" || !row.role) {
      return res.status(200).json({ ok: false, error: "INVALID_OR_EXPIRED_CODE" });
    }
    const cfg = await loadSessionCfg(row.id);
    return res.status(200).json({
      ok: true,
      role: row.role,
      sessionId: row.id,
      status: row.status,
      cfg,
    });
  } catch (err) {
    console.error("sessions validate error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
};
