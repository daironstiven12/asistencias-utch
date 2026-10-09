"use strict";

/* /api/admin/representatives
   GET — lista con ofertas y estado.
   POST — crea representante (name, username, password, courseOfferingIds, active?).
   PATCH — actualiza active y/o reemplaza courseOfferingIds.
   POST ?op=docentes (rewrite /api/admin/docentes) — alta académica de
   docente: persons → users → user_roles(DOCENTE), reutilizando por correo. */

const crypto = require("crypto");
const { query, getPool } = require("../../lib/db");
const { requireAdmin } = require("../../lib/adminAuth");
const { hashPassword } = require("../../lib/repAuth");

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

function cleanOfferingIds(value) {
  if (!Array.isArray(value)) return null;
  const out = [];
  for (const v of value) {
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0 || out.includes(n)) continue;
    out.push(n);
  }
  return out;
}

async function assertOfferings(ids) {
  if (!ids.length) return true;
  const r = await query(
    "SELECT COUNT(*)::int n FROM course_offerings WHERE id = ANY($1) AND status = 'ACTIVE'",
    [ids]
  );
  return r.rows[0].n === ids.length;
}

async function handleGet(req, res) {
  try {
    const r = await query(
    "SELECT r.id, r.name, r.username, r.active, r.created_at," +
      " COALESCE(array_agg(ro.course_offering_id) FILTER (WHERE ro.course_offering_id IS NOT NULL), '{}') AS offerings" +
      " FROM attendance_representatives r" +
      " LEFT JOIN attendance_representative_offerings ro ON ro.representative_id = r.id" +
      " GROUP BY r.id ORDER BY r.created_at DESC"
  );
  return res.status(200).json({
    ok: true,
    representatives: r.rows.map((row) => ({
      id: row.id,
      name: row.name,
      username: row.username,
      active: row.active,
      createdAt: row.created_at,
      courseOfferingIds: (row.offerings || []).map(Number).sort((a, b) => a - b),
    })),
  });
  } catch (err) {
    console.error("admin representatives error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}

async function handlePost(req, res) {
  const body = readBody(req);
  const name = body && body.name;
  const username = body && body.username;
  const password = body && body.password;
  const active = body && body.active !== undefined ? !!body.active : true;
  const offeringIds = cleanOfferingIds(body && body.courseOfferingIds);
  if (
    typeof name !== "string" || name.trim() === "" || name.trim().length > 120 ||
    typeof username !== "string" || username.trim() === "" || username.trim().length > 160 ||
    typeof password !== "string" || password.length < 8 || password.length > 256 ||
    offeringIds === null
  ) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  if (!(await assertOfferings(offeringIds))) {
    return res.status(400).json({ ok: false, error: "OFFERING_NOT_AVAILABLE" });
  }
  const id = crypto.randomUUID();
  try {
    await query(
      "INSERT INTO attendance_representatives (id, name, username, password_hash, active)" +
        " VALUES ($1, $2, $3, $4, $5)",
      [id, name.trim(), username.trim(), hashPassword(password), active]
    );
  } catch (err) {
    if (err && err.code === "23505") {
      const s = await query(
        "SELECT id, name, username, active FROM attendance_representatives WHERE username = $1 LIMIT 1",
        [username.trim()]
      );
      const row = s.rows[0];
      return res.status(409).json({
        ok: false,
        error: "USERNAME_EXISTS",
        representative: row
          ? { id: row.id, name: row.name, username: row.username, active: row.active }
          : null,
      });
    }
    throw err;
  }
  for (const offeringId of offeringIds) {
    await query(
      "INSERT INTO attendance_representative_offerings (representative_id, course_offering_id)" +
        " VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [id, offeringId]
    );
  }
  return res.status(201).json({
    ok: true,
    representative: { id, name: name.trim(), username: username.trim(), active, courseOfferingIds: offeringIds },
  });
}

async function handlePatch(req, res) {
  const body = readBody(req);
  const id = body && body.id;
  if (typeof id !== "string" || id.trim() === "") {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  const hasActive = body && body.active !== undefined;
  const hasOfferings = body && body.courseOfferingIds !== undefined;
  if (!hasActive && !hasOfferings) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  const s = await query(
    "SELECT id, name, username, active FROM attendance_representatives WHERE id = $1 LIMIT 1",
    [id.trim()]
  );
  const row = s.rows[0];
  if (!row) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }
  if (hasActive) {
    await query("UPDATE attendance_representatives SET active = $1, updated_at = NOW() WHERE id = $2", [
      !!body.active,
      id.trim(),
    ]);
    row.active = !!body.active;
  }
  if (hasOfferings) {
    const offeringIds = cleanOfferingIds(body.courseOfferingIds);
    if (offeringIds === null || !(await assertOfferings(offeringIds))) {
      return res.status(400).json({ ok: false, error: "INVALID_DATA" });
    }
    await query("DELETE FROM attendance_representative_offerings WHERE representative_id = $1", [
      id.trim(),
    ]);
    for (const offeringId of offeringIds) {
      await query(
        "INSERT INTO attendance_representative_offerings (representative_id, course_offering_id) VALUES ($1, $2)",
        [id.trim(), offeringId]
      );
    }
  }
  const o = await query(
    "SELECT course_offering_id FROM attendance_representative_offerings WHERE representative_id = $1 ORDER BY 1",
    [id.trim()]
  );
  return res.status(200).json({
    ok: true,
    representative: {
      id: row.id,
      name: row.name,
      username: row.username,
      active: row.active,
      courseOfferingIds: o.rows.map((r) => Number(r.course_offering_id)),
    },
  });
}

module.exports = async function handler(req, res) {
  const op = req.query && typeof req.query.op === "string" ? req.query.op : "";
  if (op === "docentes") {
    if (!requireAdmin(req, res)) return;
    try {
      if (req.method === "GET") return await handleDocentesList(req, res);
      if (req.method === "POST") return await handleDocentes(req, res);
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    } catch (err) {
      console.error("admin docentes error:", err && err.message);
      return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
    }
  }
  if (req.method !== "GET" && req.method !== "POST" && req.method !== "PATCH") {
    res.setHeader("Allow", "GET, POST, PATCH");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === "GET") return handleGet(req, res);
    if (req.method === "POST") return handlePost(req, res);
    return handlePatch(req, res);
  } catch (err) {
    console.error("admin representatives error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
};

/* GET /api/admin/docentes — catálogo de docentes (role_id = 2).
   Solo usuarios activos con rol DOCENTE. Sin secretos ni credenciales. */
async function handleDocentesList(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  const r = await query(
    "SELECT p.id AS id, u.id AS \"userId\"," +
      " TRIM(COALESCE(p.first_name,'')||' '||COALESCE(p.middle_name||' ','')||COALESCE(p.last_name,'')||COALESCE(' '||p.second_last_name,'')) AS nombre," +
      " p.email AS correo, u.status AS estado," +
      " COUNT(DISTINCT CASE WHEN ta.status = 'ACTIVE' THEN ta.course_offering_id END)::int AS \"ofertasCount\"," +
      " COALESCE(array_agg(DISTINCT s.name) FILTER (WHERE ta.status = 'ACTIVE' AND s.name IS NOT NULL), '{}') AS ofertas" +
      ' FROM "users" u' +
      " JOIN persons p ON p.id = u.person_id" +
      " JOIN user_roles ur ON ur.user_id = u.id AND ur.role_id = 2" +
      " LEFT JOIN teaching_assignments ta ON ta.user_id = u.id" +
      " LEFT JOIN course_offerings co ON co.id = ta.course_offering_id AND co.status = 'ACTIVE'" +
      " LEFT JOIN curriculum_subjects cs ON cs.id = co.curriculum_subject_id" +
      " LEFT JOIN subjects s ON s.id = cs.subject_id" +
      " WHERE u.status = 'ACTIVE'" +
      " GROUP BY p.id, u.id, p.first_name, p.middle_name, p.last_name, p.second_last_name, p.email, u.status" +
      " ORDER BY nombre"
  );
  return res.status(200).json({
    ok: true,
    docentes: r.rows.map((row) => ({
      id: Number(row.id),
      userId: Number(row.userId),
      nombre: String(row.nombre || "").replace(/\s+/g, " ").trim(),
      correo: row.correo || null,
      estado: row.estado || null,
      ofertasCount: Number(row.ofertasCount) || 0,
      ofertas: (row.ofertas || []).filter(Boolean),
    })),
  });
}

/* Alta académica de docente (registro interno, sin accesos).
   POST /api/admin/docentes {nombre, correo} — transaccional.
   Busca por correo (insensible a mayúsculas); reutiliza users.id;
   solo crea persons/users/user_roles(DOCENTE=2) si no existen. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normTexto(v, max) {
  return String(v || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function nombreReal(row) {
  return [row.first_name, row.middle_name, row.last_name, row.second_last_name]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function partirNombre(nombre) {
  const toks = normTexto(nombre, 160).split(" ").filter(Boolean);
  if (!toks.length) return null;
  if (toks.length === 1) return { first: toks[0], last: toks[0] };
  if (toks.length === 2) return { first: toks[0], last: toks[1] };
  return { first: toks.slice(0, -2).join(" "), last: toks.slice(-2).join(" ") };
}

function baseUsername(correo, nombre) {
  const local = String(correo).split("@")[0].toLowerCase();
  let base = local
    .replace(/[\s_]+/g, ".")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 120);
  if (!base) {
    base = normTexto(nombre, 120)
      .toLowerCase()
      .replace(/[\s_]+/g, ".")
      .replace(/[^a-z0-9._-]/g, "")
      .replace(/^\.+|\.+$/g, "");
  }
  return base || "docente";
}

async function crearUsuario(client, personId, correo, nombre) {
  const base = baseUsername(correo, nombre);
  let username = base;
  for (let i = 1; i <= 60; i++) {
    const c = await client.query('SELECT id FROM "users" WHERE username = $1 LIMIT 1', [
      username,
    ]);
    if (!c.rows[0]) break;
    username = base + "." + (i + 1);
  }
  // Valor aleatorio: solo satisface el NOT NULL. Ningún flujo de la app
  // autentica contra users.password_hash, por lo que no es una credencial útil.
  const imposible = "UNUSABLE$" + crypto.randomBytes(32).toString("hex");
  const ins = await client.query(
    'INSERT INTO "users" (person_id, username, password_hash, status)' +
      " VALUES ($1, $2, $3, 'ACTIVE') RETURNING id",
    [personId, username, imposible]
  );
  return { userId: Number(ins.rows[0].id), username };
}

async function asegurarRolDocente(client, userId) {
  const r = await client.query(
    "SELECT id FROM user_roles WHERE user_id = $1 AND role_id = 2 LIMIT 1",
    [userId]
  );
  if (!r.rows[0]) {
    await client.query("INSERT INTO user_roles (user_id, role_id) VALUES ($1, 2)", [userId]);
  }
}

async function handleDocentes(req, res) {
  const body = readBody(req);
  const nombre = normTexto(body && body.nombre, 160);
  const correo = normTexto(body && body.correo, 160).toLowerCase();
  if (!nombre || !EMAIL_RE.test(correo)) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const existente = await client.query(
      "SELECT u.id AS user_id, u.status, p.id AS person_id," +
        " p.first_name, p.middle_name, p.last_name, p.second_last_name, p.email" +
        ' FROM "users" u JOIN persons p ON p.id = u.person_id' +
        " WHERE LOWER(p.email) = LOWER($1) LIMIT 1",
      [correo]
    );
    if (existente.rows[0]) {
      const r = existente.rows[0];
      if (nombreReal(r).toUpperCase() !== nombre.toUpperCase()) {
        await client.query("ROLLBACK");
        return res.status(409).json({ ok: false, error: "NAME_MISMATCH" });
      }
      await asegurarRolDocente(client, r.user_id);
      await client.query("COMMIT");
      return res.status(200).json({
        ok: true,
        docente: {
          id: Number(r.person_id),
          nombre: nombreReal(r),
          correo: r.email,
          userId: Number(r.user_id),
          created: false,
        },
      });
    }
    const persona = await client.query(
      "SELECT id, first_name, middle_name, last_name, second_last_name, email" +
        " FROM persons WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [correo]
    );
    let personId;
    let creado = false;
    if (persona.rows[0]) {
      if (nombreReal(persona.rows[0]).toUpperCase() !== nombre.toUpperCase()) {
        await client.query("ROLLBACK");
        return res.status(409).json({ ok: false, error: "NAME_MISMATCH" });
      }
      personId = Number(persona.rows[0].id);
    } else {
      const partes = partirNombre(nombre);
      if (!partes) {
        await client.query("ROLLBACK");
        return res.status(400).json({ ok: false, error: "INVALID_DATA" });
      }
      const ins = await client.query(
        "INSERT INTO persons (first_name, last_name, email, status)" +
          " VALUES ($1, $2, $3, 'ACTIVE') RETURNING id",
        [partes.first, partes.last, correo]
      );
      personId = Number(ins.rows[0].id);
      creado = true;
    }
    const nuevo = await crearUsuario(client, personId, correo, nombre);
    await asegurarRolDocente(client, nuevo.userId);
    await client.query("COMMIT");
    return res.status(creado ? 201 : 200).json({
      ok: true,
      docente: {
        id: personId,
        nombre,
        correo,
        userId: nuevo.userId,
        created: creado,
      },
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (e) {}
    throw err;
  } finally {
    client.release();
  }
}
