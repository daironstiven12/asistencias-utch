"use strict";

/* POST /api/sessions/close — cierre definitivo del representante propietario.
   Atómico. Idempotente: no recalcula closed_at/purge_at. purge_at = +24h. */

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
  try {
    const r = await query(
      "UPDATE attendance_runtime_sessions SET status = 'CLOSED'," +
        " registration_open = FALSE," +
        " closed_at = NOW(), purge_at = NOW() + INTERVAL '24 hours'" +
        " WHERE id = $1 AND representative_id = $2 AND status = 'OPEN'" +
        " RETURNING id, status, closed_at, purge_at",
      [sessionId.trim(), rep.id]
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
      [sessionId.trim(), rep.id]
    );
    const own = s.rows[0];
    if (own && own.status !== "OPEN") {
      return res.status(200).json({
        ok: true,
        session: {
          id: own.id,
          status: own.status,
          closedAt: own.closed_at,
          purgeAt: own.purge_at,
        },
      });
    }
    return res.status(404).json({ ok: false, error: "SESSION_NOT_FOUND" });
  } catch (err) {
    console.error("sessions close error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
};
