/* tests/p14-offerings-programa.mjs — PROMPT 14 punto 4b (simulado).
   Verifica POST /api/admin/offerings: resolución de plan por programa,
   rechazo claro sin plan activo del programa, y fallback compatible cuando
   no se indica programa. NO se conecta a ninguna base de datos.
   Uso: node tests/p14-offerings-programa.mjs */

import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const ROOT = path.resolve("/home/ds/Documentos/Codigo/asistencias-utch");

/* ---------------------------- stubs -------------------------------- */
const dbPath = require.resolve(path.join(ROOT, "lib/db.js"));
const adminAuthPath = require.resolve(path.join(ROOT, "lib/adminAuth.js"));

let consultas = [];
let filasPor = () => ({ rows: [] });

function fakeClient() {
  return {
    query: async (sql, params) => {
      consultas.push({ sql: String(sql), params });
      return filasPor(String(sql), params || []);
    },
    release() {},
  };
}

require.cache[dbPath] = {
  id: dbPath, filename: dbPath, path: path.dirname(dbPath), loaded: true, children: [],
  exports: {
    query: async (sql, params) => filasPor(String(sql), params || []),
    getPool: () => ({ connect: async () => fakeClient() }),
  },
};

require.cache[adminAuthPath] = {
  id: adminAuthPath, filename: adminAuthPath, path: path.dirname(adminAuthPath), loaded: true, children: [],
  exports: { requireAdmin: () => true },
};

const handler = require(path.join(ROOT, "api/admin/offerings.js"));

/* -------------------------- utilidades ----------------------------- */
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  → " + detail : ""}`);
};

function fakeRes() {
  return {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
    setHeader() {},
  };
}

async function post(body) {
  consultas = [];
  const req = { method: "POST", headers: {}, body: JSON.stringify(body) };
  const res = fakeRes();
  await handler(req, res);
  return res;
}

const BASE = {
  subjectId: 10,
  nivelId: 5,
  periodoId: 20,
  // sin grupo -> reutiliza/crea; el mock devolverá grupo existente
};

/* Mock de flujo feliz completo hasta crear oferta. */
function mockFlujoFeliz({ curriculumRow, programaRow, groupRow, existingOffer }) {
  return (sql, params) => {
    const s = sql;
    if (/^BEGIN|^COMMIT|^ROLLBACK/i.test(s.trim())) return { rows: [] };
    if (/FROM academic_levels/i.test(s)) return { rows: [{ id: 5, number: 5, name: "V" }] };
    if (/FROM academic_periods/i.test(s)) return { rows: [{ id: 20, name: "2026-1" }] };
    if (/FROM academic_programs/i.test(s) && /status = 'ACTIVE'/i.test(s)) {
      return { rows: programaRow ? [programaRow] : [] };
    }
    if (/FROM curricula/i.test(s) && /program_id = \$1/i.test(s)) {
      return { rows: curriculumRow ? [curriculumRow] : [] };
    }
    if (/FROM curricula/i.test(s) && /ORDER BY id LIMIT 1/i.test(s) && !/program_id = \$1/i.test(s)) {
      // fallback primer plan activo
      return { rows: curriculumRow ? [curriculumRow] : [] };
    }
    if (/FROM subjects/i.test(s)) return { rows: [{ id: 10, code: "CIV101", name: "MECÁNICA" }] };
    if (/FROM curriculum_subjects/i.test(s) && /SELECT id, academic_level_id/i.test(s)) {
      return { rows: [{ id: 77, academic_level_id: 5 }] };
    }
    if (/FROM academic_groups/i.test(s)) {
      return { rows: [groupRow || { id: 33, name: "5A" }] };
    }
    if (/FROM course_offerings/i.test(s) && /SELECT id/i.test(s)) {
      return { rows: existingOffer ? [existingOffer] : [] };
    }
    if (/INSERT INTO course_offerings/i.test(s)) return { rows: [{ id: 501 }] };
    return { rows: [] };
  };
}

/* (a) programaId indicado y con plan activo -> usa ese plan (programa→curriculum). */
{
  filasPor = mockFlujoFeliz({
    programaRow: { id: 9, name: "INGENIERÍA CIVIL" },
    curriculumRow: { id: 900, program_id: 9 },
  });
  const res = await post({ ...BASE, programaId: 9 });
  check("a. programaId con plan activo crea oferta", res.statusCode === 201 && res.body && res.body.ok,
    JSON.stringify({ code: res.statusCode, ok: res.body && res.body.ok, error: res.body && res.body.error }));
  const qProg = consultas.find(c => /FROM academic_programs/i.test(c.sql) && c.params && c.params[0] === 9);
  check("a2. Consulta el programa indicado por id", !!qProg, qProg ? JSON.stringify(qProg.params) : "no encontrado");
  const qCur = consultas.find(c => /FROM curricula/i.test(c.sql) && /program_id = \$1/i.test(c.sql));
  check("a3. Resuelve curriculum por program_id indicado", !!qCur && qCur.params && qCur.params[0] === 9,
    qCur ? JSON.stringify(qCur.params) : "no encontrado");
  const insOff = consultas.find(c => /INSERT INTO course_offerings/i.test(c.sql));
  check("a4. Inserta oferta con el curriculum del programa", !!insOff, insOff ? JSON.stringify(insOff.params) : "no encontrado");
}

/* (b) programaId indicado pero sin plan activo -> error claro, sin calzar otro programa. */
{
  filasPor = (sql, params) => {
    const s = sql;
    if (/^BEGIN|^ROLLBACK/i.test(s.trim())) return { rows: [] };
    if (/FROM academic_levels/i.test(s)) return { rows: [{ id: 5, number: 5, name: "V" }] };
    if (/FROM academic_periods/i.test(s)) return { rows: [{ id: 20, name: "2026-1" }] };
    if (/FROM academic_programs/i.test(s)) return { rows: [{ id: 9, name: "INGENIERÍA CIVIL" }] };
    if (/FROM curricula/i.test(s) && /program_id = \$1/i.test(s)) return { rows: [] }; // sin plan
    // si llegara al fallback sería un error de lógica: lo hacemos visible
    if (/FROM curricula/i.test(s) && /ORDER BY id LIMIT 1/i.test(s)) return { rows: [{ id: 1, program_id: 999 }] };
    return { rows: [] };
  };
  const res = await post({ ...BASE, programaId: 9 });
  check("b. Programa sin plan activo → 400 NO_ACTIVE_CURRICULUM_FOR_PROGRAM",
    res.statusCode === 400 && res.body && res.body.error === "NO_ACTIVE_CURRICULUM_FOR_PROGRAM",
    JSON.stringify({ code: res.statusCode, body: res.body }));
  check("b2. Respuesta incluye nombre del programa",
    res.body && res.body.programa === "INGENIERÍA CIVIL",
    JSON.stringify(res.body));
  const usoFallback = consultas.some(c => /FROM curricula/i.test(c.sql) && /ORDER BY id LIMIT 1/i.test(c.sql) && !/program_id = \$1/i.test(c.sql));
  check("b3. No usa el fallback de primer plan activo", !usoFallback, "usoFallback=" + usoFallback);
}

/* (c) programaId indicado pero programa inexistente/inactivo -> PROGRAM_NOT_AVAILABLE. */
{
  filasPor = (sql) => {
    const s = sql;
    if (/^BEGIN|^ROLLBACK/i.test(s.trim())) return { rows: [] };
    if (/FROM academic_levels/i.test(s)) return { rows: [{ id: 5, number: 5, name: "V" }] };
    if (/FROM academic_periods/i.test(s)) return { rows: [{ id: 20, name: "2026-1" }] };
    if (/FROM academic_programs/i.test(s)) return { rows: [] };
    return { rows: [] };
  };
  const res = await post({ ...BASE, programaId: 999 });
  check("c. Programa inexistente/inactivo → 400 PROGRAM_NOT_AVAILABLE",
    res.statusCode === 400 && res.body && res.body.error === "PROGRAM_NOT_AVAILABLE",
    JSON.stringify({ code: res.statusCode, body: res.body }));
}

/* (d) Sin programaId -> fallback compatible al primer plan activo. */
{
  filasPor = mockFlujoFeliz({
    programaRow: null,
    curriculumRow: { id: 1, program_id: 2 },
  });
  const res = await post({ ...BASE });
  check("d. Sin programaId crea oferta (fallback compat)", res.statusCode === 201 && res.body && res.body.ok,
    JSON.stringify({ code: res.statusCode, ok: res.body && res.body.ok, error: res.body && res.body.error }));
  const qProg = consultas.find(c => /FROM academic_programs/i.test(c.sql));
  check("d2. No consulta programa específico", !qProg, qProg ? JSON.stringify(qProg.sql) : "ok");
  const qCurFallback = consultas.find(c => /FROM curricula/i.test(c.sql) && /ORDER BY id LIMIT 1/i.test(c.sql) && !/program_id = \$1/i.test(c.sql));
  check("d3. Usa fallback: primer curriculum activo por id", !!qCurFallback, qCurFallback ? "encontrado" : "no encontrado");
}

const fallidos = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fallidos}/${results.length} comprobaciones correctas.`);
process.exit(fallidos ? 1 : 0);
