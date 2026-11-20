"use strict";

/* POST /api/rep/sessions/:id/teacher-signature — firma del docente cargada por
   el representante propietario de la sesión (acción explícita). Solo toca
   teacher_signature/teacher_signed_at; no modifica representative_*,
   registros, estado, cierre ni purga. */

const { query } = require("../../../../lib/db");
const { requireRep } = require("../../../../lib/repSession");
const { validarFirma, aplicarFirmaSesion } = require("../../../../lib/teacherSignature");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const rep = await requireRep(req, res);
  if (!rep) return;
  const sessionId =
    req.query && typeof req.query.id === "string" ? req.query.id.trim() : "";
  if (!sessionId || !UUID_RE.test(sessionId)) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  const body = readBody(req);
  const firma = validarFirma(body && body.teacherSignature);
  if (!firma) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  try {
    const s = await query(
      "SELECT id, status, created_by_representative_id FROM attendance_runtime_sessions WHERE id = $1 LIMIT 1",
      [sessionId]
    );
    const row = s.rows[0];
    if (!row || String(row.created_by_representative_id) !== String(rep.id)) {
      return res.status(404).json({ ok: false, error: "SESSION_NOT_FOUND" });
    }
    if (row.status !== "OPEN") {
      return res.status(400).json({ ok: false, error: "SESSION_NOT_AVAILABLE" });
    }
    const updated = await aplicarFirmaSesion({ query, sessionId, signature: firma });
    if (!updated) {
      return res.status(400).json({ ok: false, error: "SESSION_NOT_AVAILABLE" });
    }
    return res.status(200).json({
      ok: true,
      session: {
        id: updated.id,
        status: updated.status,
        teacherSignature: firma,
        teacherSignedAt: updated.teacher_signed_at,
        teacherSigned: true,
      },
    });
  } catch (err) {
    console.error("rep teacher-signature error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
};
