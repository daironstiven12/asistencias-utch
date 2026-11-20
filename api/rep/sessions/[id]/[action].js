"use strict";

/* Dispatcher para acciones sobre una sesión del representante (mismo prefijo
   de URL pública): /api/rep/sessions/:id/{action}
   Conserva las rutas existentes agrupando en una sola función serverless. */

const blockRegistration = require("./_block-registration");
const representativeSignature = require("./_representative-signature");
const teacherSignature = require("./_teacher-signature");

const HANDLERS = {
  "block-registration": blockRegistration,
  "representative-signature": representativeSignature,
  "teacher-signature": teacherSignature,
};

module.exports = async function handler(req, res) {
  const action =
    req.query && typeof req.query.action === "string"
      ? req.query.action.trim()
      : "";
  const target = HANDLERS[action];
  if (!target) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }
  return target(req, res);
};
