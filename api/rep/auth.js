"use strict";

/* Dispatch autenticación del representante (una sola función serverless).
   Rutas públicas intactas vía rewrites en vercel.json:
   POST /api/rep/login   (op=login)
   POST /api/rep/logout  (op=logout)
   GET  /api/rep/me      (op=me)
   Lógica movida verbatim desde login.js / logout.js / me.js. */

const { query } = require("../../lib/db");
const repAuth = require("../../lib/repAuth");

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

async function handleLogin(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  const body = readBody(req);
  const username = body && body.username;
  const password = body && body.password;
  if (
    typeof username !== "string" ||
    username.trim() === "" ||
    typeof password !== "string" ||
    password === ""
  ) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  try {
    const r = await query(
      "SELECT id, name, username, password_hash, active" +
        " FROM attendance_representatives WHERE username = $1 LIMIT 1",
      [username.trim()]
    );
    const row = r.rows[0];
    if (!row || row.active !== true || !repAuth.verifyPassword(password, row.password_hash)) {
      return res.status(401).json({ ok: false, error: "INVALID_CREDENTIALS" });
    }
    repAuth.setSessionCookie(res, repAuth.signSession(row.id));
    return res.status(200).json({
      ok: true,
      representative: { id: row.id, name: row.name, username: row.username },
    });
  } catch (err) {
    console.error("rep login error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}

async function handleLogout(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  repAuth.clearSessionCookie(res);
  return res.status(200).json({ ok: true });
}

async function handleMe(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  try {
    const cookies = repAuth.readCookies(req);
    const session = repAuth.verifySession(cookies[repAuth.COOKIE_NAME]);
    if (!session) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }
    const r = await query(
      "SELECT id, name, username, active FROM attendance_representatives WHERE id = $1 LIMIT 1",
      [session.representativeId]
    );
    const row = r.rows[0];
    if (!row || row.active !== true) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }
    return res.status(200).json({
      ok: true,
      representative: { id: row.id, name: row.name, username: row.username },
    });
  } catch (err) {
    console.error("rep me error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}

module.exports = async function handler(req, res) {
  const op = req.query && typeof req.query.op === "string" ? req.query.op : "";
  if (op === "login") return handleLogin(req, res);
  if (op === "logout") return handleLogout(req, res);
  if (op === "me") return handleMe(req, res);
  return res.status(404).json({ ok: false, error: "NOT_FOUND" });
};
