"use strict";

/* /api/sessions/teacher-saved-signature — firma guardada del docente.
   Acciones: op=get | save | apply | delete (mismo sessionId + teacherCode).
   Autorización: el teacherCode de la sesión y que la oferta de esa sesión
   pertenezca al docente (teaching_assignments ACTIVE). Si la oferta no tiene
   docente asignado, las funciones no se ofrecen (TEACHER_NOT_ASSIGNED).
   Si la tabla docente_firmas aún no existe (script 106 sin aplicar), responde
   SAVED_SIGNATURE_UNAVAILABLE y el cliente lo oculta sin romper el flujo. */

const { query } = require("../../lib/db");
const { tablaExiste } = require("../../lib/sessionSchema");
const { validarFirma, aplicarFirmaSesion } = require("../../lib/teacherSignature");
const { autorizarSesion } = require("../../lib/sessionAccess");

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

function leerOp(req, body) {
  const fuentes = [req.query, body];
  for (const f of fuentes) {
    if (f && typeof f === "object" && typeof f.op === "string") return f.op.trim().toLowerCase();
  }
  return "";
}

/* Docente de la oferta de la sesión.
   - 0 activos: { docenteId: null, ambiguous: false }
   - 1 activo:  { docenteId, ambiguous: false }
   - >1 activos: { docenteId: null, ambiguous: true } (no se puede determinar
     sin ambigüedad cuál docente corresponde al código de sesión validado). */
async function docenteDeLaSesion(sessionRow) {
  if (!sessionRow || sessionRow.course_offering_id == null) {
    return { docenteId: null, ambiguous: false };
  }
  const r = await query(
    "SELECT user_id FROM teaching_assignments" +
      " WHERE course_offering_id = $1 AND status = 'ACTIVE'" +
      " ORDER BY id",
    [sessionRow.course_offering_id]
  );
  const rows = r.rows || [];
  if (rows.length === 0) return { docenteId: null, ambiguous: false };
  if (rows.length === 1) return { docenteId: rows[0].user_id, ambiguous: false };
  return { docenteId: null, ambiguous: true };
}

module.exports = async function handler(req, res) {
  const metodo = req.method;
  if (metodo !== "GET" && metodo !== "POST" && metodo !== "DELETE") {
    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  const body = readBody(req) || {};
  const op = leerOp(req, body) || (metodo === "GET" ? "get" : "");
  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.trim() !== ""
      ? body.sessionId.trim()
      : (typeof (req.query || {}).sessionId === "string" ? req.query.sessionId.trim() : "");
  if (!sessionId) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  if (!["get", "save", "apply", "delete"].includes(op)) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  let disponible = false;
  try {
    disponible = await tablaExiste(query, "docente_firmas");
  } catch (e) {
    disponible = false;
  }
  if (!disponible) {
    return res.status(501).json({ ok: false, error: "SAVED_SIGNATURE_UNAVAILABLE" });
  }
  const auth = await autorizarSesion({ query, req, res, sessionId });
  if (!auth) return;
  let infoDocente;
  try {
    infoDocente = await docenteDeLaSesion(auth.row);
  } catch (err) {
    console.error("saved-signature docente error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
  if (infoDocente.ambiguous) {
    return res.status(409).json({
      ok: false,
      error: "AMBIGUOUS_TEACHER",
      message: "La oferta tiene varios docentes activos y no es posible determinar cuál corresponde a esta sesión.",
    });
  }
  const docenteId = infoDocente.docenteId;
  if (docenteId == null) {
    return res.status(409).json({ ok: false, error: "TEACHER_NOT_ASSIGNED" });
  }
  try {
    if (op === "get") {
      const r = await query(
        "SELECT updated_at FROM docente_firmas WHERE docente_id = $1 LIMIT 1",
        [docenteId]
      );
      const fila = r.rows[0];
      return res.status(200).json({
        ok: true,
        has: !!fila,
        updatedAt: fila ? fila.updated_at : null,
      });
    }
    if (op === "save") {
      const firma = validarFirma(body.teacherSignature);
      if (!firma) {
        return res.status(400).json({ ok: false, error: "INVALID_SIGNATURE" });
      }
      const r = await query(
        "INSERT INTO docente_firmas (docente_id, signature, updated_at)" +
          " VALUES ($1, $2, NOW())" +
          " ON CONFLICT (docente_id) DO UPDATE SET signature = EXCLUDED.signature, updated_at = NOW()" +
          " RETURNING docente_id, updated_at",
        [docenteId, firma]
      );
      return res.status(200).json({
        ok: true,
        saved: true,
        updatedAt: r.rows[0] ? r.rows[0].updated_at : null,
      });
    }
    if (op === "apply") {
      const r = await query(
        "SELECT signature FROM docente_firmas WHERE docente_id = $1 LIMIT 1",
        [docenteId]
      );
      const fila = r.rows[0];
      if (!fila) {
        return res.status(404).json({ ok: false, error: "NO_SAVED_SIGNATURE" });
      }
      const firma = validarFirma(fila.signature);
      if (!firma) {
        return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
      }
      const aplicada = await aplicarFirmaSesion({ query, sessionId, signature: firma });
      if (!aplicada) {
        return res.status(400).json({ ok: false, error: "SESSION_NOT_AVAILABLE" });
      }
      return res.status(200).json({
        ok: true,
        applied: true,
        session: {
          id: aplicada.id,
          status: aplicada.status,
          teacherSigned: true,
          teacherSignedAt: aplicada.teacher_signed_at,
        },
      });
    }
    /* delete */
    const r = await query(
      "DELETE FROM docente_firmas WHERE docente_id = $1 RETURNING docente_id",
      [docenteId]
    );
    return res.status(200).json({ ok: true, removed: r.rows.length > 0 });
  } catch (err) {
    console.error("saved-signature error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
};
