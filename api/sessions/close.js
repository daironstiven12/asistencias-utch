"use strict";

/* POST /api/sessions/close — cierra una sesión OPEN.
   Fija status, closed_at y purge_at = closed_at + 2 horas. */

const { query } = require("../../lib/db");

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
  if (typeof sessionId !== "string" || sessionId.trim() === "") {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  try {
    const r = await query(
      "UPDATE attendance_runtime_sessions SET status = 'CLOSED'," +
        " closed_at = NOW(), purge_at = NOW() + INTERVAL '2 hours'" +
        " WHERE id = $1 AND status = 'OPEN'" +
        " RETURNING id, status, closed_at, purge_at",
      [sessionId.trim()]
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
      "SELECT id, status FROM attendance_runtime_sessions WHERE id = $1 LIMIT 1",
      [sessionId.trim()]
    );
    if (!s.rows[0]) {
      return res.status(404).json({ ok: false, error: "SESSION_NOT_FOUND" });
    }
    return res.status(400).json({ ok: false, error: "SESSION_ALREADY_CLOSED" });
  } catch (err) {
    console.error("sessions close error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
};
