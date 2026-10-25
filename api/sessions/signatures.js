"use strict";

/* POST /api/sessions/signatures — guarda/borra firmas de una asistencia.
   Solo el representante autenticado dueño de la sesión (requireRep).
   Funciona con la asistencia ABIERTA o CERRADA sin tocar su estado
   (status, closed_at, purge_at, registration_open permanecen iguales).
   Reglas de firma:
   - valor vacío nunca pisa una firma existente;
   - borrado solo con clear*=true;
   - *_signed_at se actualiza al firmar o borrar;
   - formato data URL de imagen (PNG/JPG/WEBP) y tamaño ≤ 1 MB. */

const { query } = require("../../lib/db");
const { requireRep } = require("../../lib/repSession");

const MAX_SIGNATURE = 1000000; // ~1 MB (una firma de canvas rara vez supera ~200 KB)

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
  if (t.length < 30 || t.length > MAX_SIGNATURE) return "";
  if (!/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(t)) return "";
  return t;
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
    const row = await query(
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
        " RETURNING id, status, registration_open, closed_at, purge_at," +
        " teacher_signature, representative_signature",
      [id, rep.id, sigs.clearTeacher, sigs.teacher,
        sigs.clearRepresentative, sigs.representative]
    );
    const updated = row.rows[0];
    if (!updated) {
      return res.status(404).json({ ok: false, error: "SESSION_NOT_FOUND" });
    }
    return res.status(200).json({
      ok: true,
      session: {
        id: updated.id,
        status: updated.status,
        registrationOpen: updated.registration_open,
        teacherSignature: updated.teacher_signature || null,
        representativeSignature: updated.representative_signature || null,
        teacherSignedAt: updated.teacher_signed_at,
        representativeSignedAt: updated.representative_signed_at,
      },
    });
  } catch (err) {
    console.error("sessions signatures error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
};
