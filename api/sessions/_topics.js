"use strict";

/* POST /api/sessions/topics — "Temas tratados" con fuente única en el servidor.
   Lo usan el representante (cookie de la sesión) y el docente (teacherCode).
   Si la columna topics aún no existe (script 106 sin aplicar), responde
   TOPICS_UNAVAILABLE y el cliente lo oculta sin romper el flujo anterior. */

const { query } = require("../../lib/db");
const { columnaExiste } = require("../../lib/sessionSchema");
const { guardarTemas, LIMITE_TEMAS } = require("../../lib/sessionTopics");
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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  const body = readBody(req) || {};
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  let disponible = false;
  try {
    disponible = await columnaExiste(query, "attendance_runtime_sessions", "topics");
  } catch (e) {
    disponible = false;
  }
  if (!disponible) {
    return res.status(501).json({ ok: false, error: "TOPICS_UNAVAILABLE" });
  }
  const auth = await autorizarSesion({ query, req, res, sessionId });
  if (!auth) return;
  const tieneTemas = Object.prototype.hasOwnProperty.call(body, "topics");
  if (!tieneTemas && body.borrar !== true) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  if (tieneTemas && typeof body.topics !== "string") {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  try {
    const resultado = await guardarTemas({
      query,
      sessionId,
      topics: tieneTemas ? body.topics : undefined,
      borrar: body.borrar === true,
    });
    if (!resultado.fila) {
      if (resultado.sinCambios) {
        const s = await query(
          "SELECT topics, topics_updated_at FROM attendance_runtime_sessions WHERE id = $1 LIMIT 1",
          [sessionId]
        );
        const actual = s.rows[0];
        return res.status(200).json({
          ok: true,
          sinCambios: true,
          topics: actual ? actual.topics : null,
          topicsUpdatedAt: actual ? actual.topics_updated_at : null,
        });
      }
      return res.status(404).json({ ok: false, error: "SESSION_NOT_FOUND" });
    }
    return res.status(200).json({
      ok: true,
      topics: resultado.fila.topics,
      topicsUpdatedAt: resultado.fila.topics_updated_at,
      borrada: resultado.borrada,
    });
  } catch (err) {
    console.error("sessions topics error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
};

module.exports.LIMITE_TEMAS = LIMITE_TEMAS;
