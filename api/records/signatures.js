"use strict";

/* GET /api/records/signatures?sessionId=...&ids=1,2,3
   Devuelve SOLO las firmas de los registros pedidos (máximo 50 ids).
   Autorización igual que GET /api/records: representante dueño (cookie)
   o docente con teacherCode. */

const { query } = require("../../lib/db");
const { currentRep } = require("../../lib/repSession");
const crypto = require("crypto");

function readParam(req, name) {
  if (typeof req.url === "string") {
    const qi = req.url.indexOf("?");
    if (qi >= 0) {
      const v = new URLSearchParams(req.url.slice(qi + 1)).get(name);
      if (v !== null) return v;
    }
  }
  return undefined;
}

function codeMatches(given, expected) {
  if (typeof given !== "string" || typeof expected !== "string") return false;
  const a = Buffer.from(given.trim().toUpperCase());
  const b = Buffer.from(expected);
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  const sessionId = readParam(req, "sessionId");
  if (typeof sessionId !== "string" || sessionId.trim() === "") {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  const idsRaw = readParam(req, "ids") || "";
  const ids = idsRaw.split(",").map(s => s.trim()).filter(Boolean).slice(0, 50);
  if (ids.length === 0) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  try {
    const s = await query(
      "SELECT id, teacher_code, representative_id FROM attendance_runtime_sessions WHERE id = $1 LIMIT 1",
      [sessionId.trim()]
    );
    if (!s.rows[0]) {
      return res.status(404).json({ ok: false, error: "SESSION_NOT_FOUND" });
    }
    let autorizado = false;
    try {
      const rep = await currentRep(req);
      if (rep && s.rows[0].representative_id === rep.id) autorizado = true;
    } catch (e) {
      return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
    }
    if (!autorizado) {
      const teacherCode = readParam(req, "teacherCode");
      if (teacherCode !== undefined && codeMatches(teacherCode, s.rows[0].teacher_code)) {
        autorizado = true;
      }
    }
    if (!autorizado) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }
    const r = await query(
      "SELECT id, student_signature FROM attendance_runtime_records WHERE session_id = $1 AND id = ANY($2)",
      [sessionId.trim(), ids]
    );
    const map = {};
    for (const row of r.rows) {
      map[row.id] = row.student_signature || null;
    }
    const etag = '"' + crypto.createHash('sha1').update(JSON.stringify(map)).digest('hex') + '"';
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.status(200).json({ ok: true, signatures: map });
  } catch (err) {
    console.error("records signatures error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
};