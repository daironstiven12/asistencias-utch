/* tests/p15-records-since.mjs — PROMPT 15b B1 (simulado).
   Verifica que el token/contrato original de GET /api/records?light=1
   (count, latestChangeAt, status, registrationOpen, teacherSignedAt) sigue
   funcionando igual y que `version` es un campo adicional; `since` es opcional
   y solo optimiza (unchanged) sin romper la respuesta base. Sin BD.
   Uso: node tests/p15-records-since.mjs */
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const ROOT = path.resolve("/home/ds/Documentos/Codigo/asistencias-utch");

const dbPath = require.resolve(path.join(ROOT, "lib/db.js"));
const repSessionPath = require.resolve(path.join(ROOT, "lib/repSession.js"));
const schemaPath = require.resolve(path.join(ROOT, "lib/sessionSchema.js"));

const SES = {
  id:"s1", status:"OPEN", teacher_code:"TCODE", teacher_signature:null,
  teacher_signed_at:"2026-11-19T10:00:00.000Z", registration_open:true,
  representative_id:"rep1", topics:"Tema A", topics_updated_at:"2026-11-19T11:00:00.000Z"
};
let topicsDisponible = true;

require.cache[dbPath] = {
  id: dbPath, filename: dbPath, path: path.dirname(dbPath), loaded: true, children: [],
  exports: {
    query: async (sql) => {
      const s = String(sql);
      if (/FROM attendance_runtime_sessions/i.test(s) && /teacher_code/i.test(s)) {
        const row = { ...SES };
        if (!topicsDisponible) { delete row.topics; delete row.topics_updated_at; }
        return { rows: [row] };
      }
      if (/COUNT\(\*\)::int/i.test(s)) {
        return { rows: [{ count: 3, latestChangeAt: "2026-11-19T12:00:00.000Z" }] };
      }
      if (/FROM attendance_runtime_records/i.test(s) && /ORDER BY/i.test(s)) {
        return { rows: [] };
      }
      return { rows: [] };
    },
    getPool: () => ({ connect: async () => ({ query: async ()=>({rows:[]}), release(){} }) }),
  },
};
require.cache[repSessionPath] = {
  id: repSessionPath, filename: repSessionPath, path: path.dirname(repSessionPath), loaded: true, children: [],
  exports: { currentRep: async () => ({ id: "rep1" }) },
};
require.cache[schemaPath] = {
  id: schemaPath, filename: schemaPath, path: path.dirname(schemaPath), loaded: true, children: [],
  exports: { columnaExiste: async () => topicsDisponible, tablaExiste: async () => false },
};

const handler = require(path.join(ROOT, "api/records.js"));

const results = [];
const check = (name, ok, detail="") => { results.push({name,ok,detail}); console.log(`${ok?"PASS":"FAIL"}  ${name}${detail?"  → "+detail:""}`); };

function fakeRes(){ return {statusCode:200, body:null, status(c){this.statusCode=c;return this;}, json(o){this.body=o;return this;}, setHeader(){}}; }

async function get(url){
  const req = { method:"GET", headers:{}, url, query:Object.fromEntries(new URL("http://x"+url).searchParams.entries()) };
  const res = fakeRes(); await handler(req,res); return res;
}

/* 1) Contrato original light=1 sin since: campos originales presentes. */
{
  topicsDisponible = true;
  const res = await get("/api/records?sessionId=s1&light=1");
  const b = res.body || {};
  check("1a. light sin since responde ok", res.statusCode===200 && b.ok===true && b.light===true, JSON.stringify({code:res.statusCode, ok:b.ok, light:b.light}));
  check("1b. Campos originales presentes e iguales", b.status==="OPEN" && b.registrationOpen===true && b.count===3 && b.latestChangeAt==="2026-11-19T12:00:00.000Z" && b.teacherSignedAt==="2026-11-19T10:00:00.000Z",
    JSON.stringify({status:b.status, registrationOpen:b.registrationOpen, count:b.count, latestChangeAt:b.latestChangeAt, teacherSignedAt:b.teacherSignedAt}));
  check("1c. version es campo adicional (no rompe)", typeof b.version==="string" && b.version.length>0, JSON.stringify({version:b.version, hasUnchanged:Object.prototype.hasOwnProperty.call(b,'unchanged')}));
  check("1d. topics presentes cuando columna existe", b.topics==="Tema A" && b.topicsUpdatedAt==="2026-11-19T11:00:00.000Z", JSON.stringify({topics:b.topics, topicsUpdatedAt:b.topicsUpdatedAt}));
}

/* 2) since antiguo => respuesta completa igual (sin unchanged). */
{
  topicsDisponible = true;
  const res = await get("/api/records?sessionId=s1&light=1&since=2026-11-19T00:00:00.000Z");
  const b = res.body || {};
  check("2a. since antiguo no fuerza unchanged", b.unchanged!==true && b.count===3 && b.status==="OPEN", JSON.stringify({unchanged:b.unchanged, count:b.count, status:b.status}));
  check("2b. campos originales intactos con since antiguo", b.latestChangeAt==="2026-11-19T12:00:00.000Z" && b.teacherSignedAt==="2026-11-19T10:00:00.000Z", JSON.stringify({latestChangeAt:b.latestChangeAt, teacherSignedAt:b.teacherSignedAt}));
}

/* 3) since >= version => optimización unchanged pero con campos de estado presentes. */
{
  topicsDisponible = true;
  const res = await get("/api/records?sessionId=s1&light=1&since=2099-01-01T00:00:00.000Z");
  const b = res.body || {};
  check("3a. since reciente devuelve unchanged:true", b.ok===true && b.light===true && b.unchanged===true, JSON.stringify({ok:b.ok, light:b.light, unchanged:b.unchanged}));
  check("3b. campos originales siguen presentes en unchanged", b.status==="OPEN" && b.registrationOpen===true && b.count===3 && b.latestChangeAt==="2026-11-19T12:00:00.000Z" && b.teacherSignedAt==="2026-11-19T10:00:00.000Z",
    JSON.stringify({status:b.status, registrationOpen:b.registrationOpen, count:b.count, latestChangeAt:b.latestChangeAt, teacherSignedAt:b.teacherSignedAt}));
}

/* 4) Sin columna topics: flujo anterior intacto (sin topics/topicsUpdatedAt). */
{
  topicsDisponible = false;
  const res = await get("/api/records?sessionId=s1&light=1");
  const b = res.body || {};
  check("4a. sin columna topics sigue ok", b.ok===true && b.status==="OPEN" && b.count===3, JSON.stringify({ok:b.ok,status:b.status,count:b.count}));
  check("4b. no expone topics/topicsUpdatedAt si columna ausente", !Object.prototype.hasOwnProperty.call(b,'topics') && !Object.prototype.hasOwnProperty.call(b,'topicsUpdatedAt'),
    JSON.stringify({hasTopics:Object.prototype.hasOwnProperty.call(b,'topics'), hasTopicsUpdatedAt:Object.prototype.hasOwnProperty.call(b,'topicsUpdatedAt')}));
  check("4c. campos originales intactos sin columna topics", b.latestChangeAt==="2026-11-19T12:00:00.000Z" && b.teacherSignedAt==="2026-11-19T10:00:00.000Z" && b.registrationOpen===true,
    JSON.stringify({latestChangeAt:b.latestChangeAt, teacherSignedAt:b.teacherSignedAt, registrationOpen:b.registrationOpen}));
}

const fallidos = results.filter(r=>!r.ok).length;
console.log(`\n${results.length-fallidos}/${results.length} comprobaciones correctas.`);
process.exit(fallidos?1:0);
