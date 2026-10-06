"use strict";

/* GET /api/health — comprueba función + conexión PostgreSQL.
   Nunca expone DATABASE_URL ni detalles sensibles. */

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, database: false });
  }
  try {
    const { query } = require("../lib/db");
    await query("SELECT 1 AS ok");
    return res.status(200).json({ ok: true, database: true });
  } catch (err) {
    console.error("health db error:", err && err.message);
    return res.status(500).json({ ok: false, database: false });
  }
};
