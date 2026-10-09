"use strict";

/* POST /api/rep/sessions/:id/block-registration — cierra registros.
   Idempotente. No toca status/closed_at/purge_at/firmas. */

const { query } = require("../../../../lib/db");
const { requireRep } = require("../../../../lib/repSession");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  const rep = await requireRep(req, res);
  if (!rep) return;
  const sessionId =
    req.query && typeof req.query.id === "string" ? req.query.id.trim() : "";
  if (!sessionId) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  try {
    const s = await query(
      "SELECT id, status, registration_open FROM attendance_runtime_sessions" +
        " WHERE id = $1 AND representative_id = $2 LIMIT 1",
      [sessionId, rep.id]
    );
    const row = s.rows[0];
    if (!row) {
      return res.status(404).json({ ok: false, error: "SESSION_NOT_FOUND" });
    }
    if (row.status !== "OPEN") {
      return res.status(400).json({ ok: false, error: "SESSION_NOT_AVAILABLE" });
    }
    if (row.registration_open === false) {
      return res.status(200).json({
        ok: true,
        session: { id: row.id, status: row.status, registrationOpen: false },
      });
    }
    const u = await query(
      "UPDATE attendance_runtime_sessions SET registration_open = FALSE" +
        " WHERE id = $1 AND representative_id = $2 AND status = 'OPEN'" +
        " RETURNING id, status, registration_open",
      [sessionId, rep.id]
    );
    const updated = u.rows[0];
    if (!updated) {
      return res.status(400).json({ ok: false, error: "SESSION_NOT_AVAILABLE" });
    }
    return res.status(200).json({
      ok: true,
      session: { id: updated.id, status: updated.status, registrationOpen: updated.registration_open },
    });
  } catch (err) {
    console.error("rep block error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
};
