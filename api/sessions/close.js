"use strict";

/* POST /api/sessions/close — cierre definitivo del representante propietario.
   Atómico. Idempotente: no recalcula closed_at/purge_at.
   purge_at = +24h.

   Además persiste las firmas que el representante tenga en pantalla:
   - teacherSignature / representativeSignature: solo se aceptan data URLs
     PNG/JPG/WEBP válidas; vacías nunca pisan una firma existente.
   - clearTeacherSignature / clearRepresentativeSignature: borrado explícito
     (botón «Quitar»), para que una firma eliminada a propósito no reaparezca. */

const { query } = require("../../lib/db");
const { requireRep } = require("../../lib/repSession");

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

function cleanSignature(value) {
  if (typeof value !== "string") return "";
  const t = value.trim();
  if (t.length < 30 || t.length > 1000000) return "";
  if (!/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(t)) return "";
  return t;
}

/* Aplica firmas a una sesión ya cerrada (reintentos/idempotencia). */
async function persistSignatures(sessionId, repId, body, sigs) {
  const r = await query(
    "UPDATE attendance_runtime_sessions SET" +
      " teacher_signature = CASE WHEN $3::boolean THEN NULL" +
      "   ELSE COALESCE(NULLIF($4,''), teacher_signature) END," +
      " teacher_signed_at = CASE WHEN $3::boolean THEN NULL" +
      "   WHEN teacher_signature IS NULL AND NULLIF($4,'') IS NOT NULL THEN NOW()" +
      "   ELSE teacher_signed_at END," +
      " representative_signature = CASE WHEN $5::boolean THEN NULL" +
      "   ELSE COALESCE(NULLIF($6,''), representative_signature) END," +
      " representative_signed_at = CASE WHEN $5::boolean THEN NULL" +
      "   WHEN NULLIF($6,'') IS NOT NULL THEN NOW()" +
      "   ELSE representative_signed_at END" +
      " WHERE id = $1 AND representative_id = $2" +
      " RETURNING id, status, closed_at, purge_at",
    [
      sessionId,
      repId,
      !!sigs.clearTeacher,
      sigs.teacher,
      !!sigs.clearRepresentative,
      sigs.representative,
    ]
  );
  return r.rows[0] || null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  const rep = await requireRep(req, res);
  if (!rep) return;
  const body = readBody(req);
  const sessionId = body && body.sessionId;
  if (typeof sessionId !== "string" || sessionId.trim() === "") {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  const sigs = {
    teacher: cleanSignature(body && body.teacherSignature),
    representative: cleanSignature(body && body.representativeSignature),
    clearTeacher: !!(body && body.clearTeacherSignature === true),
    clearRepresentative: !!(body && body.clearRepresentativeSignature === true),
  };
  const id = sessionId.trim();
  try {
    const r = await query(
      "UPDATE attendance_runtime_sessions SET status = 'CLOSED'," +
        " registration_open = FALSE," +
        " closed_at = NOW(), purge_at = NOW() + INTERVAL '24 hours'," +
        " teacher_signature = CASE WHEN $5::boolean THEN NULL" +
        "   ELSE COALESCE(NULLIF($3,''), teacher_signature) END," +
        " teacher_signed_at = CASE WHEN $5::boolean THEN NULL" +
        "   WHEN teacher_signature IS NULL AND NULLIF($3,'') IS NOT NULL THEN NOW()" +
        "   ELSE teacher_signed_at END," +
        " representative_signature = CASE WHEN $6::boolean THEN NULL" +
        "   ELSE COALESCE(NULLIF($4,''), representative_signature) END," +
        " representative_signed_at = CASE WHEN $6::boolean THEN NULL" +
        "   WHEN NULLIF($4,'') IS NOT NULL THEN NOW()" +
        "   ELSE representative_signed_at END" +
        " WHERE id = $1 AND representative_id = $2 AND status = 'OPEN'" +
        " RETURNING id, status, closed_at, purge_at",
      [
        id,
        rep.id,
        sigs.teacher,
        sigs.representative,
        sigs.clearTeacher,
        sigs.clearRepresentative,
      ]
    );
    const row = r.rows[0];
    if (row) {
      return res.status(200).json({
        ok: true,
        session: {
          id: row.id,
          status: row.status,
          closedAt: row.closed_at,
          purgeAt: row.purge_at,
        },
      });
    }
    const s = await query(
      "SELECT id, status, closed_at, purge_at FROM attendance_runtime_sessions" +
        " WHERE id = $1 AND representative_id = $2 LIMIT 1",
      [id, rep.id]
    );
    const own = s.rows[0];
    if (own && own.status !== "OPEN") {
      /* Ya estaba cerrada: se guardan igualmente las firmas pendientes. */
      const updated = await persistSignatures(id, rep.id, body, sigs);
      return res.status(200).json({
        ok: true,
        session: {
          id: own.id,
          status: own.status,
          closedAt: (updated && updated.closed_at) || own.closed_at,
          purgeAt: (updated && updated.purge_at) || own.purge_at,
        },
      });
    }
    return res.status(404).json({ ok: false, error: "SESSION_NOT_FOUND" });
  } catch (err) {
    console.error("sessions close error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
};
