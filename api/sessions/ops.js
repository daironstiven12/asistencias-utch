"use strict";

/* Dispatcher de sub-operaciones de /api/sessions/* (URLs públicas conservadas
   mediante rewrites en vercel.json). Agrupa varias funciones en una sola para
   cumplir el límite de funciones serverless del plan Hobby. */

const validate = require("./_validate");
const close = require("./_close");
const teacherSignature = require("./_teacher-signature");
const topics = require("./_topics");
const teacherSavedSignature = require("./_teacher-saved-signature");

const HANDLERS = {
  validate,
  close,
  "teacher-signature": teacherSignature,
  topics,
  "teacher-saved-signature": teacherSavedSignature,
};

module.exports = async function handler(req, res) {
  const op =
    req.query && typeof req.query.__op === "string"
      ? req.query.__op.trim()
      : "";
  const target = HANDLERS[op];
  if (!target) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }
  return target(req, res);
};
