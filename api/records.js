"use strict";

/* /api/records
   POST — registra un estudiante en una sesión OPEN (flujo público con sessionId).
   GET ?sessionId=... [&teacherCode=...] — lista registros de esa sesión.
   Autorización del GET: representante autenticado dueño de la sesión, o
   teacherCode coincidente (vista del docente). Sin credencial válida → 401. */

const crypto = require("crypto");
const { query } = require("../lib/db");
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
  try {
    const id = crypto.randomUUID();
    let row;
    try {
      // Inserción atómica: solo si la sesión está OPEN con registros abiertos.
      const r = await query(
        "WITH target AS (" +
          " SELECT id FROM attendance_runtime_sessions" +
          " WHERE id = $1 AND status = 'OPEN' AND registration_open IS TRUE" +
        " )" +
        " INSERT INTO attendance_runtime_records" +
        " (id, session_id, full_name, identification, student_signature)" +
        " SELECT $2, target.id, $3, $4, $5 FROM target" +
        " RETURNING id, session_id, full_name, identification, student_signature, created_at",
        [sessionId.trim(), id, fullName.trim(), identification.trim(), studentSignature.trim()]
      );
      row = r.rows[0];
    } catch (err) {
      if (err && err.code === "23505") {
        return res.status(409).json({ ok: false, error: "DUPLICATE_IDENTIFICATION" });
      }
      throw err;
    }
    if (!row) {
      const dup = await query(
        "SELECT 1 FROM attendance_runtime_records WHERE session_id = $1 AND identification = $2 LIMIT 1",
        [sessionId.trim(), identification.trim()]
      );
      if (dup.rows[0]) {
        return res.status(409).json({ ok: false, error: "DUPLICATE_IDENTIFICATION" });
      }
      const st = await query(
        "SELECT status, registration_open FROM attendance_runtime_sessions WHERE id = $1 LIMIT 1",
        [sessionId.trim()]
      );
      const srow = st.rows[0];
      if (srow && srow.status === "OPEN" && srow.registration_open === false) {
        return res.status(409).json({ ok: false, code: "REGISTRATION_CLOSED", message: "Los registros de estudiantes ya fueron cerrados." });
      }
      return res.status(400).json({ ok: false, error: "SESSION_NOT_AVAILABLE" });
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
  try {
    const s = await query(
      "SELECT id, teacher_code, teacher_signature, registration_open, representative_id FROM attendance_runtime_sessions WHERE id = $1 LIMIT 1",
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
    const r = await query(
      "SELECT id, session_id, full_name, identification, student_signature, created_at" +
        " FROM attendance_runtime_records WHERE session_id = $1 ORDER BY created_at ASC",
      [sessionId.trim()]
    );
    return res.status(200).json({
      ok: true,
      teacherSignature: s.rows[0].teacher_signature || null,
      registrationOpen: s.rows[0].registration_open,
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
