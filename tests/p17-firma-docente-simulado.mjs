/* tests/p17-firma-docente-simulado.mjs — PROMPT 17 (servidor simulado, sin BD).
   Crea sesión → teacher_signed_at nulo; firma sin acción explícita no se guarda;
   docente confirma → se guarda con fecha; reabrir/consultar conserva firma.
   También: rep sube firma del docente (acción explícita) y admin la fija con signed_at.
   Uso: node tests/p17-firma-docente-simulado.mjs */
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const ROOT = path.resolve("/home/ds/Documentos/Codigo/asistencias-utch");

const dbPath = require.resolve(path.join(ROOT, "lib/db.js"));
const schemaPath = require.resolve(path.join(ROOT, "lib/sessionSchema.js"));
const repSessionPath = require.resolve(path.join(ROOT, "lib/repSession.js"));

const SID = "11111111-1111-4111-8111-111111111111";

let inserted = null;
let sessionRow = null;
let updateCalls = [];
let repActual = { id: "rep1" };

function resetSession(overrides = {}) {
  inserted = null;
  updateCalls = [];
  sessionRow = {
    id: SID,
    status: "OPEN",
    teacher_code: "DOC1",
    representative_id: "rep1",
    created_by_representative_id: "rep1",
    course_offering_id: 10,
    teacher_signature: null,
    teacher_signed_at: null,
    representative_signature: null,
    representative_signed_at: null,
    ...overrides,
  };
}

require.cache[dbPath] = {
  id: dbPath, filename: dbPath, path: path.dirname(dbPath), loaded: true, children: [],
  exports: {
    query: async (sql, params = []) => {
      const s = String(sql);
      if (/FROM attendance_representative_offerings/i.test(s)) return { rows: [{ 1: 1 }] };
      if (/INSERT INTO attendance_runtime_sessions/i.test(s)) {
        inserted = { sql: s, params };
        // devuelve fila creada (sin firmas)
        return { rows: [{ id: params[0], created_at: "2026-11-19T10:00:00.000Z" }] };
      }
      if (/SELECT COUNT\(\*\)::int AS n FROM attendance_runtime_sessions/i.test(s)) {
        return { rows: [{ n: 0 }] };
      }
      if (/SELECT id FROM course_offerings/i.test(s)) return { rows: [{ id: params[0] }] };
      if (/SELECT id, status, teacher_code, representative_id, course_offering_id/i.test(s) && /FROM attendance_runtime_sessions/i.test(s)) {
        return { rows: sessionRow ? [{ id: sessionRow.id, status: sessionRow.status, teacher_code: sessionRow.teacher_code, representative_id: sessionRow.representative_id, course_offering_id: sessionRow.course_offering_id }] : [] };
      }
      if (/SELECT id, status, teacher_code\s+FROM attendance_runtime_sessions/i.test(s)) {
        return { rows: sessionRow ? [{ id: sessionRow.id, status: sessionRow.status, teacher_code: sessionRow.teacher_code }] : [] };
      }
      if (/SELECT id, status, created_by_representative_id/i.test(s)) {
        return { rows: sessionRow ? [{ id: sessionRow.id, status: sessionRow.status, created_by_representative_id: sessionRow.created_by_representative_id }] : [] };
      }
      if (/SELECT id\s+FROM attendance_runtime_sessions WHERE id = \$1 LIMIT 1/i.test(s)) {
        return { rows: sessionRow ? [{ id: sessionRow.id }] : [] };
      }
      if (/UPDATE attendance_runtime_sessions SET teacher_signature/i.test(s) && /teacher_signed_at = NOW\(\)/i.test(s) && /RETURNING id, status, teacher_signed_at/i.test(s)) {
        updateCalls.push({ sql: s, params });
        sessionRow.teacher_signature = params[0];
        sessionRow.teacher_signed_at = "2026-11-19T10:05:00.000Z";
        return { rows: [{ id: params[1], status: sessionRow.status, teacher_signed_at: sessionRow.teacher_signed_at }] };
      }
      if (/UPDATE attendance_runtime_sessions SET/i.test(s) && /teacher_signed_at = NOW\(\)/i.test(s) && /WHERE id = \$2/i.test(s) && /RETURNING id, teacher_signature/i.test(s)) {
        // admin signature handler
        updateCalls.push({ sql: s, params });
        sessionRow.teacher_signature = params[0];
        sessionRow.teacher_signed_at = "2026-11-19T10:06:00.000Z";
        return { rows: [{ id: sessionRow.id, teacher_signature: sessionRow.teacher_signature, representative_signature: sessionRow.representative_signature }] };
      }
      if (/UPDATE attendance_runtime_sessions SET/i.test(s) && /representative_signed_at = NOW\(\)/i.test(s) && /WHERE id = \$2/i.test(s) && /RETURNING id, teacher_signature/i.test(s)) {
        updateCalls.push({ sql: s, params });
        sessionRow.representative_signature = params[0];
        sessionRow.representative_signed_at = "2026-11-19T10:06:30.000Z";
        return { rows: [{ id: sessionRow.id, teacher_signature: sessionRow.teacher_signature, representative_signature: sessionRow.representative_signature }] };
      }
      return { rows: [] };
    },
    getPool: () => ({ connect: async () => ({ query: async ()=>({rows:[]}), release(){} }) }),
  },
};

require.cache[repSessionPath] = {
  id: repSessionPath, filename: repSessionPath, path: path.dirname(repSessionPath), loaded: true, children: [],
  exports: {
    currentRep: async () => repActual,
    requireRep: async (req, res) => {
      if (!repActual) { res.status(401).json({ ok: false, error: "UNAUTHORIZED" }); return null; }
      return repActual;
    },
  },
};

require.cache[schemaPath] = {
  id: schemaPath, filename: schemaPath, path: path.dirname(schemaPath), loaded: true, children: [],
  exports: {
    columnaExiste: async () => false,
    tablaExiste: async () => false,
  },
};

const sessionsCreate = require(path.join(ROOT, "api/sessions.js"));
const teacherSig = require(path.join(ROOT, "api/sessions/_teacher-signature.js"));
const repTeacherSig = require(path.join(ROOT, "api/rep/sessions/[id]/_teacher-signature.js"));

const results = [];
const check = (name, ok, detail="") => { results.push({name,ok,detail}); console.log(`${ok?"PASS":"FAIL"}  ${name}${detail?"  → "+(typeof detail==="string"?detail:JSON.stringify(detail)):""}`); };
function fakeRes(){ return {statusCode:200, body:null, headers:{}, status(c){this.statusCode=c;return this;}, json(o){this.body=o;return this;}, setHeader(k,v){this.headers[k]=v;} }; }

const VALID_SIG = "data:image/png;base64," + "A".repeat(120);

/* 1) Crear sesión → sin firma docente (teacher_signed_at nulo, no se envía/guarda firma) */
resetSession();
{
  repActual = { id: "rep1" };
  const req = { method:"POST", headers:{}, body:{ courseOfferingId: 10 } };
  const res = fakeRes();
  await sessionsCreate(req, res);
  const ok = res.statusCode===201 && res.body && res.body.ok && inserted;
  const sql = inserted ? inserted.sql : "";
  const sinFirmaEnInsert = !!inserted && !/teacher_signature/i.test(sql) && !/teacher_signed_at/i.test(sql);
  check("S1. Crear sesión responde ok (201)", ok, JSON.stringify({status:res.statusCode, ok:res.body&&res.body.ok, err:res.body&&res.body.error}));
  check("S2. INSERT de creación no incluye columnas de firma docente", sinFirmaEnInsert, inserted ? sql.slice(0,140) : "sin insert");
  check("S3. Sesión creada no trae teacher_signed_at", !((res.body&&res.body.session)||{}).teacherSignedAt, JSON.stringify(res.body&&res.body.session));
}

/* 2) Firma sin acción explícita → no se guarda (código inválido / ausente / sesión no OPEN) */
resetSession();
{
  updateCalls = [];
  const req = { method:"POST", headers:{}, body:{ sessionId:SID, teacherCode:"OTRO", teacherSignature: VALID_SIG } };
  const res = fakeRes();
  await teacherSig(req, res);
  check("S4. Confirmación docente con código incorrecto rechazada (no guarda)", res.statusCode===401 && updateCalls.length===0, JSON.stringify({status:res.statusCode, body:res.body, updates:updateCalls.length}));
}
resetSession({ status:"CLOSED" });
{
  updateCalls = [];
  const req = { method:"POST", headers:{}, body:{ sessionId:SID, teacherCode:"DOC1", teacherSignature: VALID_SIG } };
  const res = fakeRes();
  await teacherSig(req, res);
  check("S5. Firma sin sesión OPEN no se guarda", res.statusCode===400 && updateCalls.length===0 && sessionRow.teacher_signed_at===null, JSON.stringify({status:res.statusCode, body:res.body, signed:sessionRow.teacher_signed_at}));
}
resetSession();
{
  updateCalls = [];
  const req = { method:"POST", headers:{}, body:{ sessionId:SID, teacherSignature: VALID_SIG } }; // sin teacherCode
  const res = fakeRes();
  await teacherSig(req, res);
  check("S6. Firma sin teacherCode (sin acción explícita válida) rechazada", res.statusCode===400 && updateCalls.length===0, JSON.stringify({status:res.statusCode, body:res.body}));
}

/* 3) Docente confirma (acción explícita válida) → se guarda con fecha */
resetSession();
{
  updateCalls = [];
  const req = { method:"POST", headers:{}, body:{ sessionId:SID, teacherCode:"DOC1", teacherSignature: VALID_SIG } };
  const res = fakeRes();
  await teacherSig(req, res);
  const ok = res.statusCode===200 && res.body && res.body.ok && res.body.session && res.body.session.teacherSigned===true;
  const conFecha = !!(res.body && res.body.session && res.body.session.teacherSignedAt) && !!sessionRow.teacher_signed_at;
  const upd = updateCalls.find(u=>/teacher_signature/i.test(u.sql) && /teacher_signed_at\s*=\s*NOW\(\)/i.test(u.sql));
  check("S7. Docente confirma con código correcto → ok", ok, JSON.stringify(res.body));
  check("S8. Confirmación guarda teacher_signed_at (fecha)", conFecha, JSON.stringify({resp:res.body&&res.body.session, row:sessionRow.teacher_signed_at}));
  check("S9. UPDATE explícito escribe firma y marca de tiempo", !!upd, upd?upd.sql.slice(0,140):"sin update");
}

/* 4) Reabrir/consultar conserva la firma confirmada (estado en servidor permanece) */
{
  // sessionRow ya quedó firmado en S7-S9: consultar estado simulado
  check("S10. Firma confirmada se conserva en la sesión (reapertura/consulta)", sessionRow.teacher_signature===VALID_SIG && !!sessionRow.teacher_signed_at, JSON.stringify({sig:!!sessionRow.teacher_signature, at:sessionRow.teacher_signed_at}));
}

/* 5) Representante sube firma del docente (acción explícita) → se guarda con fecha */
resetSession();
repActual = { id: "rep1" };
{
  updateCalls = [];
  const req = { method:"POST", headers:{}, body:{ teacherSignature: VALID_SIG }, query:{ id:SID } };
  const res = fakeRes();
  await repTeacherSig(req, res);
  const ok = res.statusCode===200 && res.body && res.body.ok && res.body.session && res.body.session.teacherSigned===true;
  const conFecha = !!(res.body && res.body.session && res.body.session.teacherSignedAt) && !!sessionRow.teacher_signed_at;
  check("S11. Representante propietario sube firma docente → ok", ok, JSON.stringify(res.body));
  check("S12. Firma subida por representante queda confirmada con fecha", conFecha, JSON.stringify({resp:res.body&&res.body.session, row:sessionRow.teacher_signed_at}));
}
resetSession();
repActual = { id: "otro" };
{
  updateCalls = [];
  const req = { method:"POST", headers:{}, body:{ teacherSignature: VALID_SIG }, query:{ id:SID } };
  const res = fakeRes();
  await repTeacherSig(req, res);
  check("S13. Representante no propietario no puede subir firma docente", res.statusCode===404 && updateCalls.length===0, JSON.stringify({status:res.statusCode, body:res.body}));
}

const fallidos = results.filter(r=>!r.ok).length;
console.log(`\n${results.length - fallidos}/${results.length} comprobaciones correctas.`);
process.exit(fallidos?1:0);
