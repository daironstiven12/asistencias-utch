"use strict";

/* Autorización de acciones sobre UNA sesión: representante dueño (cookie JWT) o
   docente con el teacherCode de la sesión. Misma regla que aplica api/records.js.
   Si no está autorizado, escribe la respuesta y devuelve null. */

const crypto = require("crypto");
const { currentRep } = require("./repSession");

function codeMatches(given, expected) {
  if (typeof given !== "string" || typeof expected !== "string") return false;
  const g = given.trim().toUpperCase();
  const a = Buffer.from(g);
  const b = Buffer.from(expected);
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

function leerCodigo(req) {
  const fuentes = [req.body, req.query];
  for (const f of fuentes) {
    if (f && typeof f === "object" && typeof f.teacherCode === "string") return f.teacherCode;
  }
  return "";
}

/* Devuelve { row, rep } o null (respuesta ya escrita). */
async function autorizarSesion({ query, req, res, sessionId }) {
  const r = await query(
    "SELECT id, status, teacher_code, representative_id, course_offering_id" +
      " FROM attendance_runtime_sessions WHERE id = $1 LIMIT 1",
    [sessionId]
  );
  const row = r.rows[0];
  if (!row) {
    res.status(404).json({ ok: false, error: "SESSION_NOT_FOUND" });
    return null;
  }
  let rep = null;
  try {
    rep = await currentRep(req);
  } catch (e) {
    res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
    return null;
  }
  if (rep && row.representative_id === rep.id) return { row, rep };
  if (codeMatches(leerCodigo(req), row.teacher_code)) return { row, rep: null };
  res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  return null;
}

module.exports = { autorizarSesion, codeMatches };
