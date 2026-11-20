/* tests/p14-nombre-servidor.mjs — PROMPT 14 punto 2: servidor (simulado).
   Verifica POST /api/sessions: attendanceNumber orden de apertura por
   (created_at, id) de la oferta. NO se conecta a ninguna base de datos.
   Uso: node tests/p14-nombre-servidor.mjs */

import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const ROOT = path.resolve("/home/ds/Documentos/Codigo/asistencias-utch");

/* Stubs de lib/db y lib/repSession antes de cargar el endpoint. */
const dbPath = require.resolve(path.join(ROOT, "lib/db.js"));
const repSessionPath = require.resolve(path.join(ROOT, "lib/repSession.js"));

const nuevaFila = (n) => ({ rows: [{ n }] });
void nuevaFila;
let contador = 0;

require.cache[dbPath] = {
  id: dbPath, filename: dbPath, path: path.dirname(dbPath), loaded: true, children: [],
  exports: {
    query: async (sql, params) => {
      if (/^\s*SELECT id FROM course_offerings/i.test(sql)) {
        return { rows: [{ id: params[0] }] };
      }
      if (/^\s*SELECT 1 FROM attendance_representative_offerings/i.test(sql)) {
        return { rows: [{ 1: 1 }] };
      }
      if (/^\s*INSERT INTO attendance_runtime_sessions/i.test(sql)) {
        return { rows: [{ id: "ses-p14", created_at: new Date().toISOString() }] };
      }
      if (/COUNT\(\*\)::int AS n/i.test(sql) && /course_offering_id = \$1/.test(sql)) {
        return { rows: [{ n: contador }] };
      }
      return { rows: [] };
    },
    getPool: () => ({ connect: async () => ({ query: async () => ({ rows: [] }), release() {} }) }),
  },
};

require.cache[repSessionPath] = {
  id: repSessionPath, filename: repSessionPath, path: path.dirname(repSessionPath), loaded: true, children: [],
  exports: {
    currentRep: async () => ({ id: "rep-1" }),
    requireRep: async () => ({ id: "rep-1" }),
  },
};

const handler = require(path.join(ROOT, "api/sessions.js"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  → " + detail : ""}`);
};

function fakeRes() {
  const r = {
    statusCode: 200,
    json(o) { this.body = o; return this; },
    status(c) { this.statusCode = c; return this; },
  };
  return r;
}

const crear = (courseOfferingId) => {
  const res = fakeRes();
  return handler({
    method: "POST",
    headers: {},
    body: JSON.stringify({ courseOfferingId }),
  }, res).then(() => res);
};

/* attendanceNumber = 1 + conteo de sesiones de la oferta con (created_at,id) < (nuestra,id). */
contador = 0;
const r1 = await crear(7);
check("a. Primer POST /api/sessions → attendanceNumber = 1",
  r1.statusCode === 201 && r1.body && r1.body.session && r1.body.session.attendanceNumber === 1,
  JSON.stringify({ code: r1.statusCode, attendanceNumber: r1.body && r1.body.session && r1.body.session.attendanceNumber }));

contador = 2;
const r2 = await crear(7);
check("b. Segundo POST a la misma oferta → attendanceNumber = 3",
  r2.statusCode === 201 && r2.body && r2.body.session && r2.body.session.attendanceNumber === 3,
  JSON.stringify({ code: r2.statusCode, attendanceNumber: r2.body && r2.body.session && r2.body.session.attendanceNumber }));

const r3 = await crear(9);
contador = 0;
const r4 = await crear(9);
check("c. Oferta diferente (9) con conteo 0 → attendanceNumber = 1",
  r4.statusCode === 201 && r4.body && r4.body.session && r4.body.session.attendanceNumber === 1,
  JSON.stringify({ code: r4.statusCode, attendanceNumber: r4.body && r4.body.session && r4.body.session.attendanceNumber }));

check("d. La respuesta NO cambió por hacer el conteo",
  r3.body.session && typeof r3.body.session === "object", JSON.stringify(r3.body.session));

const fallidos = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fallidos}/${results.length} comprobaciones correctas.`);
process.exit(fallidos ? 1 : 0);
