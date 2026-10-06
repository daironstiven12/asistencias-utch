"use strict";

/* GET /api/cron/purge — elimina sesiones CLOSED con purge_at vencido.
   El ON DELETE CASCADE borra sus attendance_runtime_records.
   Si CRON_SECRET está configurado, exige Authorization: Bearer. */

const { query } = require("../../lib/db");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  try {
    if (process.env.CRON_SECRET) {
      const auth = req.headers && req.headers.authorization;
      if (auth !== "Bearer " + process.env.CRON_SECRET) {
        return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
      }
    }
    const r = await query(
      "DELETE FROM attendance_runtime_sessions" +
        " WHERE status = 'CLOSED' AND purge_at IS NOT NULL AND purge_at <= NOW()" +
        " RETURNING id"
    );
    return res.status(200).json({ ok: true, deletedSessions: r.rowCount });
  } catch (err) {
    console.error("cron purge error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
};
