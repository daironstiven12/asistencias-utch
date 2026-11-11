"use strict";

/* Autorización administrativa vía ADMIN_SECRET (variable de entorno).
   Acepta header x-admin-secret o campo adminSecret en JSON. */

const crypto = require("crypto");

function readAdminSecret(req) {
  if (req.headers) {
    const h =
      req.headers["x-admin-secret"] !== undefined
        ? req.headers["x-admin-secret"]
        : req.headers["X-Admin-Secret"];
    if (typeof h === "string" && h !== "") return h;
  }
  const body = req.body;
  let obj = body;
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch (e) {
      obj = null;
    }
  }
  if (obj && typeof obj === "object" && typeof obj.adminSecret === "string") {
    return obj.adminSecret;
  }
  return "";
}

function getAdminSecret() {
  if (process.env.ADMIN_SECRET) return process.env.ADMIN_SECRET;
  try {
    const LOCAL_CONFIG = require("./localConfig");
    if (LOCAL_CONFIG && LOCAL_CONFIG.ADMIN_SECRET) return LOCAL_CONFIG.ADMIN_SECRET;
  } catch (e) {}
  return "";
}

/* Comparación timing-safe única del secreto (misma lógica de siempre). */
function secretOk(given, expected) {
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return true;
}

/* ¿La trae esta petición? Mismo mecanismo que requireAdmin (mismo header/campo
   y misma comparación), pero sin escribir respuesta: lo usan endpoints que
   también aceptan a otro rol (p. ej. /api/sessions/close). */
function isAdminRequest(req) {
  const expected = getAdminSecret();
  if (!expected) return false;
  return secretOk(readAdminSecret(req), expected);
}

function requireAdmin(req, res) {
  const expected = getAdminSecret();
  if (!expected) {
    res.status(500).json({ ok: false, error: "ADMIN_NOT_CONFIGURED" });
    return false;
  }
  if (!secretOk(readAdminSecret(req), expected)) {
    res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return false;
  }
  return true;
}

module.exports = { requireAdmin, isAdminRequest, readAdminSecret };
