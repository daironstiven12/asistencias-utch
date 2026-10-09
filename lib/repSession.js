"use strict";

/* Resuelve el representante autenticado desde la cookie JWT.
   Uso: const rep = await requireRep(req, res); if (!rep) return; */

const { query } = require("./db");
const repAuth = require("./repAuth");

async function currentRep(req) {
  const cookies = repAuth.readCookies(req);
  const session = repAuth.verifySession(cookies[repAuth.COOKIE_NAME]);
  if (!session) return null;
  const r = await query(
    "SELECT id, name, username, active FROM attendance_representatives WHERE id = $1 LIMIT 1",
    [session.representativeId]
  );
  const row = r.rows[0];
  if (!row || row.active !== true) return null;
  return { id: row.id, name: row.name, username: row.username };
}

async function requireRep(req, res) {
  try {
    const rep = await currentRep(req);
    if (!rep) {
      res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
      return null;
    }
    return rep;
  } catch (err) {
    console.error("rep auth error:", err && err.message);
    res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
    return null;
  }
}

module.exports = { currentRep, requireRep };
