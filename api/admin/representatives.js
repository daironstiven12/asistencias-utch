"use strict";

/* /api/admin/representatives
   GET — lista con ofertas y estado.
   POST — crea representante (name, username, password, courseOfferingIds, active?).
   PATCH — actualiza active y/o reemplaza courseOfferingIds.
   POST ?op=docentes (rewrite /api/admin/docentes) — alta académica de
   docente: persons → users → user_roles(DOCENTE), reutilizando por correo.
   GET ?op=sesiones (rewrite /api/admin/sesiones) — historial paginado de
   sesiones con filtros; con id= devuelve el detalle con registros.
   DELETE ?op=sesiones — elimina sesiones (y sus registros en cascada). */

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
  if (op === "sesiones") {
    if (!requireAdmin(req, res)) return;
    try {
      if (req.method === "GET") return await handleSesiones(req, res);
      if (req.method === "DELETE") return await handleEliminarSesiones(req, res);
      res.setHeader("Allow", "GET, DELETE");
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    } catch (err) {
      console.error("admin sesiones error:", err && err.message);
      return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
    }
  }
  if (op === "docentes") {
    if (!requireAdmin(req, res)) return;
    try {
      if (req.method === "GET") return await handleDocentesList(req, res);
      if (req.method === "POST") return await handleDocentes(req, res);
      if (req.method === "PATCH") return await handleDocentesPatch(req, res);
      if (req.method === "DELETE") return await handleDocentesDelete(req, res);
      res.setHeader("Allow", "GET, POST, PATCH, DELETE");
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
   Incluye activos e inactivos; el frontend filtra. Sin secretos ni credenciales. */
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
      " COALESCE(array_agg(DISTINCT s.name) FILTER (WHERE ta.status = 'ACTIVE' AND s.name IS NOT NULL), '{}') AS ofertas," +
      " COALESCE(array_agg(DISTINCT cs.academic_level_id) FILTER (WHERE ta.status = 'ACTIVE' AND cs.academic_level_id IS NOT NULL), '{}') AS \"nivelesIds\"," +
      " COALESCE(array_agg(DISTINCT co.group_id) FILTER (WHERE ta.status = 'ACTIVE' AND co.group_id IS NOT NULL), '{}') AS \"gruposIds\"" +
      ' FROM "users" u' +
      " JOIN persons p ON p.id = u.person_id" +
      " JOIN user_roles ur ON ur.user_id = u.id AND ur.role_id = 2" +
      " LEFT JOIN teaching_assignments ta ON ta.user_id = u.id" +
      " LEFT JOIN course_offerings co ON co.id = ta.course_offering_id AND co.status = 'ACTIVE'" +
      " LEFT JOIN curriculum_subjects cs ON cs.id = co.curriculum_subject_id" +
      " LEFT JOIN subjects s ON s.id = cs.subject_id" +
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
      nivelesIds: (row.nivelesIds || []).map(Number).filter((n) => n > 0),
      gruposIds: (row.gruposIds || []).map(Number).filter((n) => n > 0),
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

/* PATCH ?op=docentes {userId, nombre?, correo?, estado?} — edita datos del
   docente. Nunca toca password_hash, asignaciones ni roles. Si cambia el
   correo, el username se ajusta a su parte local (con sufijo si colisiona). */
async function handleDocentesPatch(req, res) {
  const body = readBody(req);
  const userId = body && (Number(body.userId) || 0);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  const tieneNombre = body && body.nombre !== undefined;
  const tieneCorreo = body && body.correo !== undefined;
  const tieneEstado = body && body.estado !== undefined;
  if (!tieneNombre && !tieneCorreo && !tieneEstado) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  const nombre = tieneNombre ? normTexto(body.nombre, 160) : null;
  const correo = tieneCorreo ? normTexto(body.correo, 160).toLowerCase() : null;
  const estado = tieneEstado ? String(body.estado || "").toUpperCase() : null;
  if ((tieneNombre && !nombre) || (tieneCorreo && !EMAIL_RE.test(correo))) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  if (tieneEstado && estado !== "ACTIVE" && estado !== "INACTIVE") {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const actual = await client.query(
      "SELECT u.id AS user_id, u.username, u.status, p.id AS person_id," +
        " p.first_name, p.middle_name, p.last_name, p.second_last_name, p.email" +
        ' FROM "users" u JOIN persons p ON p.id = u.person_id' +
        " WHERE u.id = $1 LIMIT 1",
      [userId]
    );
    const row = actual.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
    const esDocente = await client.query(
      "SELECT id FROM user_roles WHERE user_id = $1 AND role_id = 2 LIMIT 1",
      [userId]
    );
    if (!esDocente.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
    let nuevoNombre = nombreReal(row);
    let nuevoCorreo = row.email;
    let nuevoUsername = row.username;
    if (tieneNombre) {
      const partes = partirNombre(nombre);
      if (!partes) {
        await client.query("ROLLBACK");
        return res.status(400).json({ ok: false, error: "INVALID_DATA" });
      }
      await client.query(
        "UPDATE persons SET first_name = $1, last_name = $2, middle_name = NULL, second_last_name = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
        [partes.first, partes.last, row.person_id]
      );
      nuevoNombre = nombre;
    }
    if (tieneCorreo && correo !== String(row.email || "").toLowerCase()) {
      const otro = await client.query(
        "SELECT p.id FROM persons p WHERE LOWER(p.email) = LOWER($1) AND p.id <> $2 LIMIT 1",
        [correo, row.person_id]
      );
      if (otro.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(409).json({ ok: false, error: "EMAIL_EXISTS" });
      }
      await client.query(
        "UPDATE persons SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [correo, row.person_id]
      );
      const base = baseUsername(correo, nuevoNombre);
      let username = base;
      for (let i = 1; i <= 60; i++) {
        const c = await client.query(
          'SELECT id FROM "users" WHERE username = $1 AND id <> $2 LIMIT 1',
          [username, userId]
        );
        if (!c.rows[0]) break;
        username = base + "." + (i + 1);
      }
      await client.query(
        'UPDATE "users" SET username = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [username, userId]
      );
      nuevoCorreo = correo;
      nuevoUsername = username;
    }
    if (tieneEstado && estado !== row.status) {
      await client.query(
        'UPDATE "users" SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [estado, userId]
      );
    }
    await client.query("COMMIT");
    const fin = await client.query(
      "SELECT u.status, u.username, p.email FROM \"users\" u JOIN persons p ON p.id = u.person_id WHERE u.id = $1 LIMIT 1",
      [userId]
    );
    return res.status(200).json({
      ok: true,
      docente: {
        id: Number(row.person_id),
        userId,
        nombre: nuevoNombre,
        correo: fin.rows[0].email,
        username: fin.rows[0].username,
        estado: fin.rows[0].status,
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

/* DELETE ?op=docentes {userId} — elimina un docente solo si no tiene
   dependencias (asignaciones, sesiones heredadas, estudiantes, firmas,
   sesiones de acceso o auditoría ligadas). Nunca toca offers/sesiones. */
async function handleDocentesDelete(req, res) {
  const body = readBody(req);
  const userId = body && (Number(body.userId) || 0);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const actual = await client.query(
      "SELECT u.id AS user_id, p.id AS person_id FROM \"users\" u" +
        " JOIN persons p ON p.id = u.person_id" +
        " JOIN user_roles ur ON ur.user_id = u.id AND ur.role_id = 2" +
        " WHERE u.id = $1 LIMIT 1",
      [userId]
    );
    const row = actual.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
    const deps = [];
    const contar = async (etiqueta, sql, params) => {
      const r = await client.query("SELECT COUNT(*)::int n FROM " + sql, params);
      if (r.rows[0].n > 0) deps.push({ tipo: etiqueta, total: r.rows[0].n });
    };
    await contar("asignaciones", "teaching_assignments WHERE user_id = $1", [userId]);
    await contar("sesiones", "attendance_sessions WHERE teacher_user_id = $1", [userId]);
    await contar("estudiantes", "students WHERE person_id = $1", [row.person_id]);
    await contar("firmas", "signatures WHERE person_id = $1", [row.person_id]);
    await contar("accesos", "auth_sessions WHERE user_id = $1", [userId]);
    await contar("auditoria", "audit_logs WHERE user_id = $1", [userId]);
    await contar("asignaciones_rep", "representative_assignments WHERE user_id = $1", [userId]);
    if (deps.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ ok: false, error: "HAS_DEPENDENCIES", dependencias: deps });
    }
    await client.query("DELETE FROM user_roles WHERE user_id = $1 AND role_id = 2", [userId]);
    await client.query('DELETE FROM "users" WHERE id = $1', [userId]);
    const otros = await client.query(
      "SELECT 1 FROM students WHERE person_id = $1 LIMIT 1",
      [row.person_id]
    );
    if (!otros.rows[0]) {
      await client.query("DELETE FROM persons WHERE id = $1", [row.person_id]);
    }
    await client.query("COMMIT");
    return res.status(200).json({ ok: true, eliminado: { userId, personId: Number(row.person_id) } });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (e) {}
    throw err;
  } finally {
    client.release();
  }
}

/* GET ?op=sesiones — historial paginado de sesiones (rewrite /api/admin/sesiones).
   Filtros: desde/hasta (YYYY-MM-DD, día en America/Bogota sobre created_at),
   q (asignatura o código), nivelId, grupoId, repId, status (OPEN/CLOSED).
   Con id= devuelve el detalle de una sesión con sus registros.
   Orden estable: created_at DESC, id DESC. */
const SESION_JOINS =
  "attendance_runtime_sessions s" +
  " LEFT JOIN course_offerings co ON co.id = s.course_offering_id" +
  " LEFT JOIN curriculum_subjects cs ON cs.id = co.curriculum_subject_id" +
  " LEFT JOIN subjects sub ON sub.id = cs.subject_id" +
  " LEFT JOIN academic_groups g ON g.id = co.group_id" +
  " LEFT JOIN academic_programs ap2 ON ap2.id = g.program_id" +
  " LEFT JOIN faculties f ON f.id = ap2.faculty_id" +
  " LEFT JOIN academic_periods ap ON ap.id = co.academic_period_id" +
  " LEFT JOIN academic_levels al ON al.id = cs.academic_level_id" +
  " LEFT JOIN teaching_assignments ta ON ta.course_offering_id = co.id AND ta.status = 'ACTIVE'" +
  ' LEFT JOIN "users" u ON u.id = ta.user_id' +
  " LEFT JOIN persons p ON p.id = u.person_id" +
  " LEFT JOIN attendance_representatives r ON r.id = s.representative_id";

const SESION_FIELDS =
  's.id AS "sessionId", s.status, s.registration_open AS "registrationOpen",' +
  ' s.created_at AS "createdAt", s.closed_at AS "closedAt", s.purge_at AS "purgeAt",' +
  " f.name AS facultad, ap2.name AS programa, al.name AS nivel, ap.name AS periodo," +
  " sub.name AS asignatura, sub.code AS codigo, al.id AS \"nivelId\"," +
  " g.id AS \"grupoId\", g.name AS grupo, r.name AS representante," +
  " TRIM(COALESCE(p.first_name,'')||' '||COALESCE(p.middle_name||' ','')||COALESCE(p.last_name,'')||COALESCE(' '||p.second_last_name,'')) AS docente," +
  " (s.teacher_signature IS NOT NULL) AS \"teacherSigned\"," +
  " (s.representative_signature IS NOT NULL) AS \"repSigned\"," +
  " (SELECT COUNT(*)::int FROM attendance_runtime_records rec WHERE rec.session_id = s.id) AS \"recordCount\"";

function leerParam(req, name) {
  if (req.query && typeof req.query[name] === "string") return req.query[name];
  return "";
}

function esFecha(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
}

async function handleSesiones(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, DELETE");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  const id = String(leerParam(req, "id") || "").trim();
  if (id) return handleSesionDetalle(req, res, id);
  const page = Math.max(1, parseInt(leerParam(req, "page"), 10) || 1);
  let pageSize = parseInt(leerParam(req, "pageSize"), 10) || 10;
  if (![10, 25, 50].includes(pageSize)) pageSize = 10;
  const desde = String(leerParam(req, "desde") || "").trim();
  const hasta = String(leerParam(req, "hasta") || "").trim();
  if ((desde && !esFecha(desde)) || (hasta && !esFecha(hasta))) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  const q = String(leerParam(req, "q") || "").trim().slice(0, 60);
  const nivelId = parseInt(leerParam(req, "nivelId"), 10) || 0;
  const grupoId = parseInt(leerParam(req, "grupoId"), 10) || 0;
  const repId = String(leerParam(req, "repId") || "").trim().slice(0, 40);
  const status = String(leerParam(req, "status") || "").trim().toUpperCase();
  if (status && status !== "OPEN" && status !== "CLOSED") {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  const conds = [];
  const params = [];
  const like = (frag, val) => {
    params.push(val);
    conds.push(frag.replace("?", "$" + params.length));
  };
  if (desde) like("DATE(s.created_at AT TIME ZONE 'America/Bogota') >= ?", desde);
  if (hasta) like("DATE(s.created_at AT TIME ZONE 'America/Bogota') <= ?", hasta);
  if (q) {
    params.push("%" + q.replace(/[%_\\]/g, "\\$&") + "%");
    conds.push("(sub.name ILIKE $" + params.length + " ESCAPE '\\' OR sub.code ILIKE $" + params.length + " ESCAPE '\\')");
  }
  if (nivelId > 0) like("cs.academic_level_id = ?", nivelId);
  if (grupoId > 0) like("co.group_id = ?", grupoId);
  if (repId) like("s.representative_id = ?", repId);
  if (status) like("s.status = ?", status);
  const where = conds.length ? " WHERE " + conds.join(" AND ") : "";
  const total = await query("SELECT COUNT(DISTINCT s.id)::int n FROM " + SESION_JOINS + where, params);
  const offset = (page - 1) * pageSize;
  const r = await query(
    "SELECT " + SESION_FIELDS + " FROM " + SESION_JOINS + where +
      " ORDER BY s.created_at DESC, s.id DESC LIMIT " + pageSize + " OFFSET " + offset,
    params
  );
  const mapRow = (row) => ({
    sessionId: row.sessionId,
    createdAt: row.createdAt,
    closedAt: row.closedAt,
    status: row.status,
    registrationOpen: row.registrationOpen,
    facultad: row.facultad || null,
    programa: row.programa || null,
    nivel: row.nivel || null,
    periodo: row.periodo || null,
    asignatura: row.asignatura || null,
    codigo: row.codigo || null,
    nivelId: row.nivelId != null ? Number(row.nivelId) : null,
    grupoId: row.grupoId != null ? Number(row.grupoId) : null,
    grupo: row.grupo || null,
    representante: row.representante || null,
    docente: row.docente && String(row.docente).replace(/\s+/g, " ").trim() ? String(row.docente).replace(/\s+/g, " ").trim() : null,
    recordCount: Number(row.recordCount) || 0,
    teacherSigned: !!row.teacherSigned,
    repSigned: !!row.repSigned,
  });
  const n = total.rows[0].n;
  return res.status(200).json({
    ok: true,
    page,
    pageSize,
    total: n,
    pages: Math.max(1, Math.ceil(n / pageSize)),
    sesiones: r.rows.map(mapRow),
  });
}

async function handleSesionDetalle(req, res, id) {
  const r = await query("SELECT " + SESION_FIELDS +
    ', s.teacher_signature AS "teacherSignature", s.representative_signature AS "representativeSignature"' +
    " FROM " + SESION_JOINS + " WHERE s.id = $1 LIMIT 1", [id]);
  const row = r.rows[0];
  if (!row) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  const rec = await query(
    "SELECT id, full_name, identification, student_signature, created_at" +
      " FROM attendance_runtime_records WHERE session_id = $1 ORDER BY created_at ASC",
    [id]
  );
  const mapRow = (w) => ({
    sessionId: w.sessionId,
    createdAt: w.createdAt,
    closedAt: w.closedAt,
    status: w.status,
    registrationOpen: w.registrationOpen,
    facultad: w.facultad || null,
    programa: w.programa || null,
    nivel: w.nivel || null,
    periodo: w.periodo || null,
    asignatura: w.asignatura || null,
    codigo: w.codigo || null,
    grupo: w.grupo || null,
    representante: w.representante || null,
    docente: w.docente && String(w.docente).replace(/\s+/g, " ").trim() ? String(w.docente).replace(/\s+/g, " ").trim() : null,
    recordCount: Number(w.recordCount) || 0,
    teacherSigned: !!w.teacherSigned,
    repSigned: !!w.repSigned,
    teacherSignature: w.teacherSignature || null,
    representativeSignature: w.representativeSignature || null,
  });
  return res.status(200).json({
    ok: true,
    sesion: mapRow(row),
    registros: rec.rows.map((c) => ({
      id: c.id,
      fullName: c.full_name,
      identification: c.identification,
      studentSignature: c.student_signature,
      createdAt: c.created_at,
    })),
  });
}

/* DELETE ?op=sesiones (rewrite /api/admin/sesiones) {ids:[uuid]}.
   Elimina cada sesión con sus registros en cascada, en una transacción.
   Nunca toca asignaturas, docentes, representantes ni catálogos. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handleEliminarSesiones(req, res) {
  const body = readBody(req);
  const raw = body && body.ids;
  if (!Array.isArray(raw) || !raw.length || raw.length > 50) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  const ids = [];
  for (const v of raw) {
    const s = String(v || "").trim();
    if (UUID_RE.test(s) && !ids.includes(s)) ids.push(s);
  }
  if (!ids.length) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const eliminadas = [];
    const rechazadas = [];
    for (const id of ids) {
      const o = await client.query(
        "SELECT s.id, sub.name AS asignatura, sub.code AS codigo," +
          " (SELECT COUNT(*)::int FROM attendance_runtime_records rec WHERE rec.session_id = s.id) AS recs" +
          " FROM attendance_runtime_sessions s" +
          " LEFT JOIN course_offerings co ON co.id = s.course_offering_id" +
          " LEFT JOIN curriculum_subjects cs ON cs.id = co.curriculum_subject_id" +
          " LEFT JOIN subjects sub ON sub.id = cs.subject_id WHERE s.id = $1 LIMIT 1",
        [id]
      );
      if (!o.rows[0]) {
        rechazadas.push({ id, reason: "NOT_FOUND" });
        continue;
      }
      const del = await client.query(
        "DELETE FROM attendance_runtime_sessions WHERE id = $1 RETURNING id",
        [id]
      );
      if (!del.rows[0]) {
        rechazadas.push({ id, reason: "NOT_FOUND" });
        continue;
      }
      eliminadas.push({
        id,
        codigo: o.rows[0].codigo,
        asignatura: o.rows[0].asignatura,
        registros: o.rows[0].recs,
      });
    }
    await client.query("COMMIT");
    return res.status(200).json({ ok: true, eliminadas, rechazadas });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (e) {}
    throw err;
  } finally {
    client.release();
  }
}
