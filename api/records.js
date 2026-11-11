"use strict";


const crypto = require("crypto");
const { query, getPool } = require("../lib/db");
const { currentRep } = require("../lib/repSession");

const LIMITS = {
  fullName: 120,
  identification: 30,
  studentSignature: 1000000,
};


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

function invalidField(value, max) {
  if (typeof value !== "string") return true;
  const t = value.trim();
  if (t === "") return true;
  if (t.length > max) return true;
  return false;
}

async function handlePost(req, res) {
  const body = readBody(req);
  const sessionId = body && body.sessionId;
  const fullName = body && body.fullName;
  const identification = body && body.identification;
  const studentSignature = body && body.studentSignature;
  if (
    typeof sessionId !== "string" ||
    sessionId.trim() === "" ||
    invalidField(fullName, LIMITS.fullName) ||
    invalidField(identification, LIMITS.identification) ||
    invalidField(studentSignature, LIMITS.studentSignature)
  ) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const st = await client.query(
      "SELECT status, registration_open FROM attendance_runtime_sessions WHERE id = $1 FOR UPDATE",
      [sessionId.trim()]
    );
    const srow = st.rows[0];
    if (!srow) {
      try { await client.query("ROLLBACK"); } catch (e) {}
      return res.status(400).json({ ok: false, error: "SESSION_NOT_AVAILABLE" });
    }
    const dup = await client.query(
      "SELECT 1 FROM attendance_runtime_records WHERE session_id = $1 AND identification = $2 LIMIT 1",
      [sessionId.trim(), identification.trim()]
    );
    if (dup.rows[0]) {
      try { await client.query("ROLLBACK"); } catch (e) {}
      return res.status(409).json({ ok: false, error: "DUPLICATE_IDENTIFICATION" });
    }
    if (srow.status !== "OPEN") {
      try { await client.query("ROLLBACK"); } catch (e) {}
      return res.status(400).json({ ok: false, error: "SESSION_NOT_AVAILABLE" });
    }
    if (srow.registration_open === false) {
      try { await client.query("ROLLBACK"); } catch (e) {}
      return res.status(409).json({ ok: false, code: "REGISTRATION_CLOSED", message: "Los registros de estudiantes ya fueron cerrados." });
    }
    const id = crypto.randomUUID();
    let row;
    try {
      const r = await client.query(
        "INSERT INTO attendance_runtime_records" +
          " (id, session_id, full_name, identification, student_signature)" +
          " VALUES ($1, $2, $3, $4, $5)" +
          " RETURNING id, session_id, full_name, identification, student_signature, created_at",
        [id, sessionId.trim(), fullName.trim(), identification.trim(), studentSignature.trim()]
      );
      row = r.rows[0];
    } catch (err) {
      try { await client.query("ROLLBACK"); } catch (e) {}
      if (err && err.code === "23505") {
        return res.status(409).json({ ok: false, error: "DUPLICATE_IDENTIFICATION" });
      }
      throw err;
    }
    if (!row) {
      try { await client.query("ROLLBACK"); } catch (e) {}
      return res.status(400).json({ ok: false, error: "SESSION_NOT_AVAILABLE" });
    }
    await client.query("COMMIT");
    return res.status(201).json({
      ok: true,
      record: {
        id: row.id,
        sessionId: row.session_id,
        fullName: row.full_name,
        identification: row.identification,
        studentSignature: row.student_signature,
        createdAt: row.created_at,
      },
    });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch (e) {}
    console.error("records post error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  } finally {
    client.release();
  }
}

function readParam(req, name) {
  if (req.query && typeof req.query[name] === "string") return req.query[name];
  if (typeof req.url === "string") {
    const qi = req.url.indexOf("?");
    if (qi >= 0) {
      const v = new URLSearchParams(req.url.slice(qi + 1)).get(name);
      if (v !== null) return v;
    }
  }
  return undefined;
}

function readSessionId(req) {
  return readParam(req, "sessionId");
}

function codeMatches(given, expected) {
  if (typeof given !== "string" || typeof expected !== "string") return false;
  const a = Buffer.from(given.trim().toUpperCase());
  const b = Buffer.from(expected);
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

async function handleGet(req, res) {
  const sessionId = readSessionId(req);
  if (typeof sessionId !== "string" || sessionId.trim() === "") {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  /* light=1: metadatos ligeros (conteo + última modificación) sin firmas.
     Permite al frontend detectar cambios sin transferir firmas Base64 en cada
     ciclo de polling; las firmas se descargan con el detalle completo. */
  const light = String(readParam(req, "light") || "").trim() === "1";
  try {
    const s = await query(
      (light
        ? "SELECT id, status, teacher_code, teacher_signed_at, registration_open, representative_id FROM attendance_runtime_sessions WHERE id = $1 LIMIT 1"
        : "SELECT id, status, teacher_code, teacher_signature, teacher_signed_at, registration_open, representative_id FROM attendance_runtime_sessions WHERE id = $1 LIMIT 1"),
      [sessionId.trim()]
    );
    if (!s.rows[0]) {
      return res.status(404).json({ ok: false, error: "SESSION_NOT_FOUND" });
    }
    // Representante dueño (cookie) o docente con su código. Nada más.
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
    if (light) {
      const cnt = await query(
        "SELECT COUNT(*)::int AS \"count\", MAX(created_at) AS \"latestChangeAt\" FROM attendance_runtime_records WHERE session_id = $1",
        [sessionId.trim()]
      );
      return res.status(200).json({
        ok: true,
        light: true,
        status: s.rows[0].status,
        registrationOpen: s.rows[0].registration_open,
        count: cnt.rows[0].count,
        latestChangeAt: cnt.rows[0].latestChangeAt || null,
        teacherSignedAt: s.rows[0].teacher_signed_at || null,
      });
    }
    const r = await query(
      "SELECT id, session_id, full_name, identification, student_signature, created_at" +
        " FROM attendance_runtime_records WHERE session_id = $1 ORDER BY created_at ASC",
      [sessionId.trim()]
    );
    const ultimo = r.rows.length ? r.rows[r.rows.length - 1] : null;
    return res.status(200).json({
      ok: true,
      status: s.rows[0].status,
      teacherSignature: s.rows[0].teacher_signature || null,
      teacherSignedAt: s.rows[0].teacher_signed_at || null,
      registrationOpen: s.rows[0].registration_open,
      count: r.rows.length,
      latestChangeAt: ultimo ? ultimo.created_at : null,
      records: r.rows.map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        fullName: row.full_name,
        identification: row.identification,
        studentSignature: row.student_signature,
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    console.error("records get error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}

module.exports = async function handler(req, res) {
  if (req.method === "POST") return handlePost(req, res);
  if (req.method === "GET") return handleGet(req, res);
  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
};
