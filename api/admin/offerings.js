"use strict";

/* /api/admin/offerings
   GET — catálogo de ofertas con período/nivel/grupo/programa + catálogos
          (períodos, niveles, grupos, asignaturas, docentes) para filtros y
          para el formulario de creación. Todo sale de PostgreSQL.
   POST — crea la oferta académica con las tablas existentes:
          subjects → curriculum_subjects → course_offerings (+ teaching_assignments
          opcional). Reutiliza asignatura / curriculum_subject / grupo cuando ya
          existen en vez de fallar; si no hay grupo para la combinación, lo crea.
   Protegido con ADMIN_SECRET. Nunca expone secretos. */

const { query, getPool } = require("../../lib/db");
const { requireAdmin } = require("../../lib/adminAuth");

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

function cleanName(v, max) {
  if (typeof v !== "string") return "";
  return v.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

function toInt(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

async function handleGet(req, res) {
  const [rOf, rPer, rNiv, rGrp, rSub, rDoc] = await Promise.all([
    query(
      "SELECT co.id AS \"courseOfferingId\", s.code AS codigo, s.name AS asignatura," +
        " TRIM(COALESCE(p.first_name,'')||' '||COALESCE(p.middle_name||' ','')||COALESCE(p.last_name,'')||COALESCE(' '||p.second_last_name,'')) AS docente," +
        " ap.id AS \"periodoId\", ap.name AS periodo," +
        " al.id AS \"nivelId\", al.name AS nivel, al.number AS \"nivelNumero\"," +
        " ag.id AS \"grupoId\", ag.name AS grupo," +
        " apr.name AS programa, f.name AS facultad" +
        " FROM course_offerings co" +
        " JOIN curriculum_subjects cs ON cs.id = co.curriculum_subject_id" +
        " JOIN subjects s ON s.id = cs.subject_id" +
        " JOIN academic_periods ap ON ap.id = co.academic_period_id" +
        " LEFT JOIN academic_levels al ON al.id = cs.academic_level_id" +
        " LEFT JOIN academic_groups ag ON ag.id = co.group_id" +
        " LEFT JOIN academic_programs apr ON apr.id = ag.program_id" +
        " LEFT JOIN faculties f ON f.id = apr.faculty_id" +
        " LEFT JOIN teaching_assignments ta ON ta.course_offering_id = co.id AND ta.status = 'ACTIVE'" +
        " LEFT JOIN \"users\" u ON u.id = ta.user_id" +
        " LEFT JOIN persons p ON p.id = u.person_id" +
        " WHERE co.status = 'ACTIVE' ORDER BY ap.name, al.number NULLS LAST, s.code"
    ),
    query("SELECT id, name, year, term FROM academic_periods WHERE status = 'ACTIVE' ORDER BY year DESC, term DESC, name"),
    query("SELECT id, number, name FROM academic_levels ORDER BY number"),
    query(
      "SELECT ag.id, ag.name, ag.code, ag.program_id, apr.name AS programa," +
        " ag.academic_period_id, ap.name AS periodo, ag.academic_level_id, al.name AS nivel" +
        " FROM academic_groups ag" +
        " JOIN academic_programs apr ON apr.id = ag.program_id" +
        " JOIN academic_periods ap ON ap.id = ag.academic_period_id" +
        " LEFT JOIN academic_levels al ON al.id = ag.academic_level_id" +
        " WHERE ag.status = 'ACTIVE' ORDER BY ap.name, al.number NULLS LAST, ag.name"
    ),
    query("SELECT id, code, name FROM subjects WHERE status = 'ACTIVE' ORDER BY code"),
    query(
      "SELECT u.id, TRIM(COALESCE(p.first_name,'')||' '||COALESCE(p.middle_name||' ','')||COALESCE(p.last_name,'')||COALESCE(' '||p.second_last_name,'')) AS nombre" +
        " FROM \"users\" u LEFT JOIN persons p ON p.id = u.person_id" +
        " WHERE u.status = 'ACTIVE' ORDER BY nombre"
    ),
  ]);
  return res.status(200).json({
    ok: true,
    offerings: rOf.rows.map((row) => ({
      courseOfferingId: Number(row.courseOfferingId),
      codigo: row.codigo || null,
      asignatura: row.asignatura || null,
      docente:
        row.docente && row.docente.replace(/\s+/g, " ").trim()
          ? row.docente.replace(/\s+/g, " ").trim()
          : null,
      periodoId: row.periodoId != null ? Number(row.periodoId) : null,
      periodo: row.periodo || null,
      nivelId: row.nivelId != null ? Number(row.nivelId) : null,
      nivel: row.nivel || null,
      nivelNumero: row.nivelNumero != null ? Number(row.nivelNumero) : null,
      grupoId: row.grupoId != null ? Number(row.grupoId) : null,
      grupo: row.grupo || null,
      programa: row.programa || null,
      facultad: row.facultad || null,
    })),
    catalogs: {
      periodos: rPer.rows.map((r) => ({ id: Number(r.id), nombre: r.name, year: r.year, term: r.term })),
      niveles: rNiv.rows.map((r) => ({ id: Number(r.id), nombre: r.name, numero: r.number })),
      grupos: rGrp.rows.map((r) => ({
        id: Number(r.id),
        nombre: r.name,
        codigo: r.code || null,
        programaId: r.program_id != null ? Number(r.program_id) : null,
        programa: r.programa || null,
        periodoId: r.academic_period_id != null ? Number(r.academic_period_id) : null,
        periodo: r.periodo || null,
        nivelId: r.academic_level_id != null ? Number(r.academic_level_id) : null,
        nivel: r.nivel || null,
      })),
      asignaturas: rSub.rows.map((r) => ({ id: Number(r.id), codigo: r.code, nombre: r.name })),
      docentes: rDoc.rows
        .map((r) => ({ id: Number(r.id), nombre: (r.nombre || "").replace(/\s+/g, " ").trim() }))
        .filter((d) => d.nombre),
    },
  });
}

async function handlePost(req, res) {
  const body = readBody(req);
  const subjectId = toInt(body && (body.subjectId ?? body.asignaturaId));
  const nombre = cleanName(body && body.nombre, 160);
  const codigo = cleanName(body && body.codigo, 40).toUpperCase();
  const nivelId = toInt(body && body.nivelId);
  const periodoId = toInt(body && body.periodoId);
  const groupId = toInt(body && (body.groupId ?? body.grupoId));
  const docenteUserId = toInt(body && (body.docenteUserId ?? body.userId ?? body.teacherUserId));

  if (!nivelId || !periodoId) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  // Asignatura: o bien se reutiliza una existente (subjectId), o bien se indica
  // nombre + código para crearla (o reutilizarla si el código ya existe).
  if (!subjectId && (!nombre || !codigo)) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const nivel = await client.query("SELECT id, number, name FROM academic_levels WHERE id = $1 LIMIT 1", [nivelId]);
    if (!nivel.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(400).json({ ok: false, error: "INVALID_DATA" });
    }
    const periodo = await client.query(
      "SELECT id, name FROM academic_periods WHERE id = $1 AND status = 'ACTIVE' LIMIT 1",
      [periodoId]
    );
    if (!periodo.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(400).json({ ok: false, error: "INVALID_DATA" });
    }
    const cur = await client.query(
      "SELECT id, program_id FROM curricula WHERE status = 'ACTIVE' ORDER BY id LIMIT 1"
    );
    if (!cur.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(400).json({ ok: false, error: "NO_ACTIVE_CURRICULUM" });
    }
    const curriculumId = Number(cur.rows[0].id);
    const programId = Number(cur.rows[0].program_id);

    // 1) Asignatura (subjects): reutilizar por id o por código; crear si no existe.
    let subject;
    if (subjectId) {
      const s = await client.query("SELECT id, code, name FROM subjects WHERE id = $1 LIMIT 1", [subjectId]);
      if (!s.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(400).json({ ok: false, error: "INVALID_DATA" });
      }
      subject = s.rows[0];
    } else {
      const s = await client.query("SELECT id, code, name FROM subjects WHERE UPPER(code) = UPPER($1) LIMIT 1", [codigo]);
      if (s.rows[0]) {
        subject = s.rows[0];
      } else {
        const ins = await client.query(
          "INSERT INTO subjects (code, name, status) VALUES ($1, $2, 'ACTIVE') RETURNING id, code, name",
          [codigo, nombre]
        );
        subject = ins.rows[0];
      }
    }

    // 2) Vínculo plan-asignatura-nivel (curriculum_subjects): reutilizar o crear.
    let cs = await client.query(
      "SELECT id FROM curriculum_subjects WHERE curriculum_id = $1 AND subject_id = $2 AND academic_level_id = $3 LIMIT 1",
      [curriculumId, subject.id, nivelId]
    );
    let curriculumSubjectId;
    if (cs.rows[0]) {
      curriculumSubjectId = Number(cs.rows[0].id);
    } else {
      const ins = await client.query(
        "INSERT INTO curriculum_subjects (curriculum_id, subject_id, academic_level_id) VALUES ($1, $2, $3) RETURNING id",
        [curriculumId, subject.id, nivelId]
      );
      curriculumSubjectId = Number(ins.rows[0].id);
    }

    // 3) Grupo (academic_groups): si se indica, validar; si no, reutilizar el de
    // la combinación programa+período+nivel y, si no existe, crearlo.
    let grupoIdFinal = 0;
    let grupoNombre = null;
    if (groupId) {
      const g = await client.query(
        "SELECT id, name FROM academic_groups WHERE id = $1 AND status = 'ACTIVE' LIMIT 1",
        [groupId]
      );
      if (!g.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(400).json({ ok: false, error: "INVALID_DATA" });
      }
      grupoIdFinal = Number(g.rows[0].id);
      grupoNombre = g.rows[0].name;
    } else {
      const g = await client.query(
        "SELECT id, name FROM academic_groups WHERE program_id = $1 AND academic_period_id = $2 AND academic_level_id = $3 AND status = 'ACTIVE' LIMIT 1",
        [programId, periodoId, nivelId]
      );
      if (g.rows[0]) {
        grupoIdFinal = Number(g.rows[0].id);
        grupoNombre = g.rows[0].name;
      } else {
        const base = String(nivel.rows[0].number || nivel.rows[0].name || "G").trim();
        const nuevoNombre = (base + "A").slice(0, 40);
        const ins = await client.query(
          "INSERT INTO academic_groups (program_id, academic_period_id, academic_level_id, name, status) VALUES ($1, $2, $3, $4, 'ACTIVE') RETURNING id, name",
          [programId, periodoId, nivelId, nuevoNombre]
        );
        grupoIdFinal = Number(ins.rows[0].id);
        grupoNombre = ins.rows[0].name;
      }
    }

    // 4) Oferta (course_offerings): si ya existe una ACTIVA idéntica, devolverla
    // en vez de duplicar.
    const existente = await client.query(
      "SELECT id FROM course_offerings WHERE curriculum_subject_id = $1 AND academic_period_id = $2 AND group_id = $3 AND status = 'ACTIVE' LIMIT 1",
      [curriculumSubjectId, periodoId, grupoIdFinal]
    );
    if (existente.rows[0]) {
      const idExistente = Number(existente.rows[0].id);
      if (docenteUserId) {
        const u = await client.query("SELECT id FROM \"users\" WHERE id = $1 AND status = 'ACTIVE' LIMIT 1", [docenteUserId]);
        if (!u.rows[0]) {
          await client.query("ROLLBACK");
          return res.status(400).json({ ok: false, error: "INVALID_DATA" });
        }
        const ya = await client.query(
          "SELECT id FROM teaching_assignments WHERE course_offering_id = $1 AND user_id = $2 AND status = 'ACTIVE' LIMIT 1",
          [idExistente, docenteUserId]
        );
        if (!ya.rows[0]) {
          await client.query(
            "UPDATE teaching_assignments SET status = 'ENDED', ended_at = NOW() WHERE course_offering_id = $1 AND status = 'ACTIVE'",
            [idExistente]
          );
          await client.query(
            "INSERT INTO teaching_assignments (course_offering_id, user_id, status) VALUES ($1, $2, 'ACTIVE')",
            [idExistente, docenteUserId]
          );
        }
      }
      await client.query("COMMIT");
      return res.status(200).json({
        ok: true,
        duplicated: true,
        offering: {
          courseOfferingId: idExistente,
          codigo: subject.code,
          asignatura: subject.name,
          periodoId,
          periodo: periodo.rows[0].name,
          nivelId,
          nivel: nivel.rows[0].name,
          grupoId: grupoIdFinal,
          grupo: grupoNombre,
        },
      });
    }

    const off = await client.query(
      "INSERT INTO course_offerings (curriculum_subject_id, academic_period_id, group_id, status) VALUES ($1, $2, $3, 'ACTIVE') RETURNING id",
      [curriculumSubjectId, periodoId, grupoIdFinal]
    );
    const courseOfferingId = Number(off.rows[0].id);

    // 5) Docente (opcional): la oferta no lo exige; se registra como asignación.
    if (docenteUserId) {
      const u = await client.query("SELECT id FROM \"users\" WHERE id = $1 AND status = 'ACTIVE' LIMIT 1", [docenteUserId]);
      if (!u.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(400).json({ ok: false, error: "INVALID_DATA" });
      }
      await client.query(
        "INSERT INTO teaching_assignments (course_offering_id, user_id, status) VALUES ($1, $2, 'ACTIVE')",
        [courseOfferingId, docenteUserId]
      );
    }

    await client.query("COMMIT");
    return res.status(201).json({
      ok: true,
      offering: {
        courseOfferingId,
        codigo: subject.code,
        asignatura: subject.name,
        periodoId,
        periodo: periodo.rows[0].name,
        nivelId,
        nivel: nivel.rows[0].name,
        grupoId: grupoIdFinal,
        grupo: grupoNombre,
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

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === "GET") return handleGet(req, res);
    return handlePost(req, res);
  } catch (err) {
    console.error("admin offerings error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
};
