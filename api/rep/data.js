"use strict";

/* Dispatch datos del representante (una sola función serverless).
   Rutas públicas intactas vía rewrites en vercel.json:
   GET /api/rep/offerings          (op=offerings)
   GET /api/rep/sessions           (op=sessions)
   GET /api/rep/session?sessionId= (op=session)
   Lógica movida verbatim desde offerings.js / sessions.js / session.js. */

const { query } = require("../../lib/db");
const { requireRep } = require("../../lib/repSession");

function cleanDocente(v) {
  const t = String(v || "").replace(/\s+/g, " ").trim();
  return t ? t : null;
}

async function handleOfferings(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  const rep = await requireRep(req, res);
  if (!rep) return;
  try {
    const r = await query(
      "SELECT co.id AS \"courseOfferingId\", s.name AS asignatura, s.code AS codigo," +
        " TRIM(COALESCE(p.first_name,'')||' '||COALESCE(p.middle_name||' ','')||COALESCE(p.last_name,'')||COALESCE(' '||p.second_last_name,'')) AS docente," +
        " p.email AS correo, f.name AS facultad, ap2.name AS programa, al.name AS nivel, ap.name AS periodo" +
        " FROM attendance_representative_offerings ro" +
        " JOIN course_offerings co ON co.id = ro.course_offering_id" +
        " JOIN curriculum_subjects cs ON cs.id = co.curriculum_subject_id" +
        " JOIN subjects s ON s.id = cs.subject_id" +
        " JOIN academic_groups g ON g.id = co.group_id" +
        " JOIN academic_programs ap2 ON ap2.id = g.program_id" +
        " JOIN faculties f ON f.id = ap2.faculty_id" +
        " JOIN academic_periods ap ON ap.id = co.academic_period_id" +
        " LEFT JOIN academic_levels al ON al.id = cs.academic_level_id" +
        " LEFT JOIN teaching_assignments ta ON ta.course_offering_id = co.id AND ta.status = 'ACTIVE'" +
        " LEFT JOIN \"users\" u ON u.id = ta.user_id" +
        " LEFT JOIN persons p ON p.id = u.person_id" +
        " WHERE ro.representative_id = $1" +
        " ORDER BY s.code",
      [rep.id]
    );
    return res.status(200).json({
      ok: true,
      offerings: r.rows.map((row) => ({
        courseOfferingId: Number(row.courseOfferingId),
        asignatura: row.asignatura || null,
        codigo: row.codigo || null,
        docente: cleanDocente(row.docente),
        correo: row.correo || null,
        facultad: row.facultad || null,
        programa: row.programa || null,
        nivel: row.nivel || null,
        periodo: row.periodo || null,
      })),
    });
  } catch (err) {
    console.error("rep offerings error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}

const SESS_JOINS =
  " FROM attendance_runtime_sessions s" +
  " LEFT JOIN course_offerings co ON co.id = s.course_offering_id" +
  " LEFT JOIN curriculum_subjects cs ON cs.id = co.curriculum_subject_id" +
  " LEFT JOIN subjects sub ON sub.id = cs.subject_id" +
  " LEFT JOIN academic_groups g ON g.id = co.group_id" +
  " LEFT JOIN academic_programs ap2 ON ap2.id = g.program_id" +
  " LEFT JOIN faculties f ON f.id = ap2.faculty_id" +
  " LEFT JOIN academic_periods ap ON ap.id = co.academic_period_id" +
  " LEFT JOIN academic_levels al ON al.id = cs.academic_level_id" +
  " LEFT JOIN teaching_assignments ta ON ta.course_offering_id = co.id AND ta.status = 'ACTIVE'" +
  " LEFT JOIN \"users\" u ON u.id = ta.user_id" +
  " LEFT JOIN persons p ON p.id = u.person_id";

const SESS_FIELDS =
  "s.id AS \"sessionId\", s.status, s.registration_open AS \"registrationOpen\"," +
  " s.student_code AS \"studentCode\", s.teacher_code AS \"teacherCode\"," +
  " s.created_at AS \"createdAt\", s.closed_at AS \"closedAt\", s.purge_at AS \"purgeAt\"," +
  " f.name AS facultad, ap2.name AS programa, al.name AS nivel, ap.name AS periodo," +
  " sub.name AS asignatura, sub.code AS codigo," +
  " TRIM(COALESCE(p.first_name,'')||' '||COALESCE(p.middle_name||' ','')||COALESCE(p.last_name,'')||COALESCE(' '||p.second_last_name,'')) AS docente," +
  " (s.teacher_signature IS NOT NULL) AS \"hasTeacherSignature\"," +
  " (s.representative_signature IS NOT NULL) AS \"hasRepresentativeSignature\"," +
  " COUNT(r.id)::int AS \"recordCount\"";

const SESS_GROUP =
  " GROUP BY s.id, f.name, ap2.name, al.name, ap.name, sub.name, sub.code," +
  " p.first_name, p.middle_name, p.last_name, p.second_last_name";

async function handleSessions(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  const rep = await requireRep(req, res);
  if (!rep) return;
  try {
    const r = await query(
      "SELECT " + SESS_FIELDS + SESS_JOINS +
        " LEFT JOIN attendance_runtime_records r ON r.session_id = s.id" +
        " WHERE s.representative_id = $1" +
        SESS_GROUP +
        " ORDER BY s.created_at DESC",
      [rep.id]
    );
    return res.status(200).json({
      ok: true,
      sessions: r.rows.map((row) => ({
        sessionId: row.sessionId,
        status: row.status,
        registrationOpen: row.registrationOpen,
        studentCode: row.studentCode,
        teacherCode: row.teacherCode,
        createdAt: row.createdAt,
        closedAt: row.closedAt,
        purgeAt: row.purgeAt,
        facultad: row.facultad || null,
        programa: row.programa || null,
        nivel: row.nivel || null,
        periodo: row.periodo || null,
        asignatura: row.asignatura || null,
        codigo: row.codigo || null,
        docente: cleanDocente(row.docente),
        hasTeacherSignature: !!row.hasTeacherSignature,
        hasRepresentativeSignature: !!row.hasRepresentativeSignature,
        recordCount: row.recordCount,
      })),
    });
  } catch (err) {
    console.error("rep sessions error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}

async function handleSession(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  const rep = await requireRep(req, res);
  if (!rep) return;
  const sessionId =
    req.query && typeof req.query.sessionId === "string" ? req.query.sessionId.trim() : "";
  if (!sessionId) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  try {
    const s = await query(
      "SELECT s.id AS \"sessionId\", s.status, s.registration_open AS \"registrationOpen\"," +
        " s.student_code AS \"studentCode\", s.teacher_code AS \"teacherCode\"," +
        " s.created_at AS \"createdAt\", s.closed_at AS \"closedAt\", s.purge_at AS \"purgeAt\"," +
        " s.teacher_signature AS \"teacherSignature\"," +
        " s.representative_signature AS \"representativeSignature\"," +
        " f.name AS facultad, ap2.name AS programa, al.name AS nivel, ap.name AS periodo," +
        " sub.name AS asignatura, sub.code AS codigo," +
        " TRIM(COALESCE(p.first_name,'')||' '||COALESCE(p.middle_name||' ','')||COALESCE(p.last_name,'')||COALESCE(' '||p.second_last_name,'')) AS docente" +
        " FROM attendance_runtime_sessions s" +
        " LEFT JOIN course_offerings co ON co.id = s.course_offering_id" +
        " LEFT JOIN curriculum_subjects cs ON cs.id = co.curriculum_subject_id" +
        " LEFT JOIN subjects sub ON sub.id = cs.subject_id" +
        " LEFT JOIN academic_groups g ON g.id = co.group_id" +
        " LEFT JOIN academic_programs ap2 ON ap2.id = g.program_id" +
        " LEFT JOIN faculties f ON f.id = ap2.faculty_id" +
        " LEFT JOIN academic_periods ap ON ap.id = co.academic_period_id" +
        " LEFT JOIN academic_levels al ON al.id = cs.academic_level_id" +
        " LEFT JOIN teaching_assignments ta ON ta.course_offering_id = co.id AND ta.status = 'ACTIVE'" +
        " LEFT JOIN \"users\" u ON u.id = ta.user_id" +
        " LEFT JOIN persons p ON p.id = u.person_id" +
        " WHERE s.id = $1 AND s.representative_id = $2 LIMIT 1",
      [sessionId, rep.id]
    );
    const row = s.rows[0];
    if (!row) {
      return res.status(404).json({ ok: false, error: "SESSION_NOT_FOUND" });
    }
    const r = await query(
      "SELECT id, session_id, full_name, identification, student_signature, created_at" +
        " FROM attendance_runtime_records WHERE session_id = $1 ORDER BY created_at ASC",
      [sessionId]
    );
    return res.status(200).json({
      ok: true,
      session: {
        sessionId: row.sessionId,
        status: row.status,
        registrationOpen: row.registrationOpen,
        studentCode: row.studentCode,
        teacherCode: row.teacherCode,
        createdAt: row.createdAt,
        closedAt: row.closedAt,
        purgeAt: row.purgeAt,
        facultad: row.facultad || null,
        programa: row.programa || null,
        nivel: row.nivel || null,
        periodo: row.periodo || null,
        asignatura: row.asignatura || null,
        codigo: row.codigo || null,
        docente: cleanDocente(row.docente),
        teacherSignature: row.teacherSignature || null,
        representativeSignature: row.representativeSignature || null,
      },
      records: r.rows.map((rec) => ({
        id: rec.id,
        sessionId: rec.session_id,
        fullName: rec.full_name,
        identification: rec.identification,
        studentSignature: rec.student_signature,
        createdAt: rec.created_at,
      })),
    });
  } catch (err) {
    console.error("rep session error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}

module.exports = async function handler(req, res) {
  const op = req.query && typeof req.query.op === "string" ? req.query.op : "";
  if (op === "offerings") return handleOfferings(req, res);
  if (op === "sessions") return handleSessions(req, res);
  if (op === "session") return handleSession(req, res);
  return res.status(404).json({ ok: false, error: "NOT_FOUND" });
};
