"use strict";

/* /api/records
   POST — registra un estudiante en una sesión OPEN.
   GET ?sessionId=... — lista registros de esa sesión. */

const crypto = require("crypto");
const { query } = require("../lib/db");

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

async function getOpenSession(sessionId) {
  const r = await query(
    "SELECT id, status FROM attendance_runtime_sessions WHERE id = $1 LIMIT 1",
    [sessionId]
  );
  const row = r.rows[0];
  if (!row || row.status !== "OPEN") return null;
  return row;
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
  try {
    const session = await getOpenSession(sessionId.trim());
    if (!session) {
      return res.status(400).json({ ok: false, error: "SESSION_NOT_AVAILABLE" });
    }
    const id = crypto.randomUUID();
    let row;
    try {
      const r = await query(
        "INSERT INTO attendance_runtime_records" +
          " (id, session_id, full_name, identification, student_signature)" +
          " VALUES ($1, $2, $3, $4, $5)" +
          " RETURNING id, session_id, full_name, identification, student_signature, created_at",
        [id, session.id, fullName.trim(), identification.trim(), studentSignature.trim()]
      );
      row = r.rows[0];
    } catch (err) {
      if (err && err.code === "23505") {
        return res.status(409).json({ ok: false, error: "DUPLICATE_IDENTIFICATION" });
      }
      throw err;
    }
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
    console.error("records post error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}

function readSessionId(req) {
  if (req.query && typeof req.query.sessionId === "string") return req.query.sessionId;
  if (typeof req.url === "string") {
    const qi = req.url.indexOf("?");
    if (qi >= 0) {
      const params = new URLSearchParams(req.url.slice(qi + 1));
      const v = params.get("sessionId");
      if (v !== null) return v;
    }
  }
  return undefined;
}

async function handleGet(req, res) {
  const sessionId = readSessionId(req);
  if (typeof sessionId !== "string" || sessionId.trim() === "") {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  try {
    const s = await query(
      "SELECT id, teacher_signature FROM attendance_runtime_sessions WHERE id = $1 LIMIT 1",
      [sessionId.trim()]
    );
    if (!s.rows[0]) {
      return res.status(404).json({ ok: false, error: "SESSION_NOT_FOUND" });
    }
    const r = await query(
      "SELECT id, session_id, full_name, identification, student_signature, created_at" +
        " FROM attendance_runtime_records WHERE session_id = $1 ORDER BY created_at ASC",
      [sessionId.trim()]
    );
    return res.status(200).json({
      ok: true,
      teacherSignature: s.rows[0].teacher_signature || null,
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
