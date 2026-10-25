"use strict";


const crypto = require("crypto");
const { query, getPool } = require("../lib/db");
const { currentRep } = require("../lib/repSession");

const LIMITS = {
  fullName: 120,
  identification: 30,
  studentSignature: 1000000,
};

/* Caché de la existencia de la columna ident_norm (Prompt 3).
   null = no probado aún; true/false = resultado. Se consulta una sola vez
   por vida del proceso para no golpear information_schema en cada registro. */
let identNormColumn = null;

async function ensureIdentNormColumn() {
  if (identNormColumn !== null) return identNormColumn;
  try {
    const r = await query(
      "SELECT 1 FROM information_schema.columns" +
        " WHERE table_name='attendance_runtime_records'" +
        " AND column_name='ident_norm' LIMIT 1"
    );
    identNormColumn = r.rows.length > 0;
  } catch (e) {
    identNormColumn = false;
    console.error("ident_norm column check error:", e && e.message);
  }
  if (!identNormColumn) {
    console.warn(
      "ident_norm ausente: aplicar sql/003_ident_norm_duplicados.sql. " +
      "Los registros se guardarán sin normalización hasta aplicar el script."
    );
  }
  return identNormColumn;
}


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

/* Normaliza una identificación para comparar sin alterar lo que se muestra.
   Quita espacios, puntos, guiones, guiones bajos y comas; pasa a mayúsculas.
   "1.234.567", "1234567", " 1234567 " → "1234567". */
function normalizeIdent(value) {
  if (typeof value !== "string") return "";
  return String(value)
    .replace(/\s/g, "")
    .replace(/[.\-_,]/g, "")
    .toUpperCase();
}

/* Valida el formato de la identificación (misma regla que el cliente).
   Acepta puntos, espacios, comas y guiones en el raw; tras normalizar
   debe quedar alfanumérico de 5 a 30 caracteres.
   Ej. "1.234.567", "1234567", " 1234567 ", "V-1234567" son válidos. */
function validateIdentification(value) {
  if (typeof value !== "string") return false;
  const t = value.trim();
  if (t === "" || t.length > LIMITS.identification) return false;
  // Caracteres permitidos en el valor tal como se escribe.
  if (!/^[A-Za-z0-9.\s\-_,]{5,30}$/.test(t)) return false;
  const n = normalizeIdent(t);
  return n.length >= 5 && n.length <= 30 && /^[A-Za-z0-9]+$/.test(n);
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
    !validateIdentification(identification) ||
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
    const identNorm = normalizeIdent(identification.trim());
    const useIdentNorm = await ensureIdentNormColumn();
    let row;
    try {
      const r = useIdentNorm
        ? await client.query(
            "INSERT INTO attendance_runtime_records" +
              " (id, session_id, full_name, identification, ident_norm, student_signature)" +
              " VALUES ($1, $2, $3, $4, $5, $6)" +
              " RETURNING id, session_id, full_name, identification, ident_norm, student_signature, created_at",
            [id, sessionId.trim(), fullName.trim(), identification.trim(), identNorm, studentSignature.trim()]
          )
        : await client.query(
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
        return res.status(409).json({
          ok: false,
          error: "DUPLICATE_IDENTIFICATION",
          message: "Esta identificación ya está registrada en esta asistencia."
        });
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
  try {
    const s = await query(
      "SELECT id, teacher_code, teacher_signature, representative_signature, registration_open, representative_id, status, closed_at FROM attendance_runtime_sessions WHERE id = $1 LIMIT 1",
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
    // Versión ligera del conjunto (sin firmas) para polling condicional.
    const ver = await query(
      "SELECT count(*)::int AS n, max(created_at) AS m FROM attendance_runtime_records WHERE session_id = $1",
      [sessionId.trim()]
    );
    const teacherSig = s.rows[0].teacher_signature || '';
    const repSig = s.rows[0].representative_signature || '';
    const versionToken = [
      (ver.rows[0].n || 0),
      (ver.rows[0].m ? new Date(ver.rows[0].m).toISOString() : ''),
      (s.rows[0].status || ''),
      (s.rows[0].registration_open ? '1' : '0'),
      (s.rows[0].closed_at ? new Date(s.rows[0].closed_at).toISOString() : ''),
      (teacherSig.length + ':' + teacherSig.slice(-8)),
      (repSig.length + ':' + repSig.slice(-8)),
    ].join('|');
    const since = readParam(req, "since");
    if (since !== undefined && since === versionToken) {
      res.setHeader('Cache-Control', 'private, no-store');
      return res.status(200).json({ ok: true, changed: false, version: versionToken });
    }

    const lite = readParam(req, "lite") === "1";
    const r = await query(
      "SELECT id, session_id, full_name, identification, student_signature, created_at" +
        " FROM attendance_runtime_records WHERE session_id = $1 ORDER BY created_at ASC",
      [sessionId.trim()]
    );
    const records = r.rows.map((row) => {
      const base = {
        id: row.id,
        sessionId: row.session_id,
        fullName: row.full_name,
        identification: row.identification,
        createdAt: row.created_at,
      };
      if (lite) {
        const sig = row.student_signature || '';
        return Object.assign(base, {
          hasSignature: !!sig,
          signatureVersion: sig ? (sig.length + ':' + sig.slice(-8)) : '0',
        });
      }
      return Object.assign(base, { studentSignature: row.student_signature });
    });
    const teacherHas = !!teacherSig;
    const teacherVer = teacherSig ? (teacherSig.length + ':' + teacherSig.slice(-8)) : '0';
    const repHas = !!repSig;
    const repVer = repSig ? (repSig.length + ':' + repSig.slice(-8)) : '0';
    const payload = {
      ok: true,
      changed: true,
      version: versionToken,
      registrationOpen: s.rows[0].registration_open,
      records: records,
    };
    if (lite) {
      payload.hasTeacherSignature = teacherHas;
      payload.teacherSignatureVersion = teacherVer;
      payload.hasRepSignature = repHas;
      payload.repSignatureVersion = repVer;
    } else {
      payload.teacherSignature = teacherSig;
      payload.representativeSignature = repSig;
    }
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json(payload);
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
