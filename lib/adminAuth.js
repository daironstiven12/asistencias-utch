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

function requireAdmin(req, res) {
  const expected = getAdminSecret();
  const given = readAdminSecret(req);
  if (!expected) {
    res.status(500).json({ ok: false, error: "ADMIN_NOT_CONFIGURED" });
    return false;
  }
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return false;
  }
  return true;
}

module.exports = { requireAdmin, readAdminSecret };
