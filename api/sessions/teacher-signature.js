"use strict";

/* POST /api/sessions/teacher-signature — firma del docente en sesión OPEN. */

const { query } = require("../../lib/db");

const MAX_SIGNATURE = 1000000;

function readBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return undefined;
    }
  }
  return body && typeof body === "object" ? body : undefined;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  const body = readBody(req);
  const sessionId = body && body.sessionId;
  const teacherSignature = body && body.teacherSignature;
  if (
    typeof sessionId !== "string" ||
    sessionId.trim() === "" ||
    typeof teacherSignature !== "string" ||
    teacherSignature.trim() === "" ||
    teacherSignature.trim().length > MAX_SIGNATURE
  ) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  try {
    const s = await query(
      "SELECT id, status FROM attendance_runtime_sessions WHERE id = $1 LIMIT 1",
      [sessionId.trim()]
    );
    const row = s.rows[0];
    if (!row) {
      return res.status(404).json({ ok: false, error: "SESSION_NOT_FOUND" });
    }
    if (row.status !== "OPEN") {
      return res.status(400).json({ ok: false, error: "SESSION_NOT_AVAILABLE" });
    }
    const r = await query(
      "UPDATE attendance_runtime_sessions SET teacher_signature = $1, teacher_signed_at = NOW()" +
        " WHERE id = $2 AND status = 'OPEN'" +
        " RETURNING id, status, teacher_signed_at",
      [teacherSignature.trim(), sessionId.trim()]
    );
    const updated = r.rows[0];
    if (!updated) {
      return res.status(400).json({ ok: false, error: "SESSION_NOT_AVAILABLE" });
    }
    return res.status(200).json({
      ok: true,
      session: {
        id: updated.id,
        status: updated.status,
        teacherSigned: true,
        teacherSignedAt: updated.teacher_signed_at,
      },
    });
  } catch (err) {
    console.error("teacher-signature error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
};
