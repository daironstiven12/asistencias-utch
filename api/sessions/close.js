"use strict";

/* POST /api/sessions/close — cierre definitivo de la asistencia.
   Atómico. Idempotente: no recalcula closed_at/purge_at. purge_at = +24h.
   Lo puede hacer el representante propietario (cookie JWT + comprobación de
   dueño) o el administrador (mismo ADMIN_SECRET del resto de api/admin/*),
   en cuyo caso se omite la comprobación de dueño. Un solo SQL de cierre. */

const { query } = require("../../lib/db");
const { requireRep } = require("../../lib/repSession");
const { isAdminRequest } = require("../../lib/adminAuth");

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
  /* Credenciales de administrador válidas → se omite la comprobación de dueño.
     En cualquier otra caso sigue el flujo del representante, sin cambios. */
  const esAdmin = isAdminRequest(req);
  let rep = null;
  if (!esAdmin) {
    rep = await requireRep(req, res);
    if (!rep) return;
  }
  const body = readBody(req);
  const sessionId = body && body.sessionId;
  if (typeof sessionId !== "string" || sessionId.trim() === "") {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  const sid = sessionId.trim();
  /* El filtro de dueño solo aplica al representante (el admin cierra cualquiera). */
  const dueno = esAdmin ? "" : " AND representative_id = $2";
  const args = esAdmin ? [sid] : [sid, rep.id];
  try {
    const r = await query(
      "UPDATE attendance_runtime_sessions SET status = 'CLOSED'," +
        " registration_open = FALSE," +
        " closed_at = NOW(), purge_at = NOW() + INTERVAL '24 hours'" +
        " WHERE id = $1" + dueno + " AND status = 'OPEN'" +
        " RETURNING id, status, closed_at, purge_at",
      args
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
        " WHERE id = $1" + dueno + " LIMIT 1",
      args
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
