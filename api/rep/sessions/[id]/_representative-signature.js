"use strict";

/* POST /api/rep/sessions/:id/representative-signature — firma del representante.
   Solo el representante propietario de la sesión puede guardar su firma.
   No toca teacher_signature/teacher_signed_at, registros, estado, cierre ni purga.
   Rechaza firmas vacías: una firma ya guardada nunca se borra desde aquí. */

const { query } = require("../../../../lib/db");
const { requireRep } = require("../../../../lib/repSession");

const MAX_SIGNATURE = 1000000;
const SIGNATURE_RE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;
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
  const representativeSignature = body && body.representativeSignature;
  if (
    typeof representativeSignature !== "string" ||
    representativeSignature.trim() === "" ||
    representativeSignature.trim().length > MAX_SIGNATURE ||
    !SIGNATURE_RE.test(representativeSignature.trim())
  ) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  const signature = representativeSignature.trim();
  try {
    const r = await query(
      "UPDATE attendance_runtime_sessions" +
        " SET representative_signature = $1, representative_signed_at = NOW()" +
        " WHERE id = $2 AND representative_id = $3" +
        " RETURNING id, status, representative_signed_at",
      [signature, sessionId, rep.id]
    );
    const row = r.rows[0];
    if (!row) {
      return res.status(404).json({ ok: false, error: "SESSION_NOT_FOUND" });
    }
    return res.status(200).json({
      ok: true,
      session: {
        id: row.id,
        status: row.status,
        representativeSignature: signature,
        representativeSignedAt: row.representative_signed_at,
      },
    });
  } catch (err) {
    console.error("rep representative-signature error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
};
