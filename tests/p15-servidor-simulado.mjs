/* tests/p15-servidor-simulado.mjs — PROMPT 15 B4 (simulado, sin BD).
   Cubre: autorización (sin código / código de otro docente rechazado),
   firma inválida o >1 MB rechazada, temas vacío no pisa, borrado explícito, >600.
   Uso: node tests/p15-servidor-simulado.mjs */
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const ROOT = path.resolve("/home/ds/Documentos/Codigo/asistencias-utch");

const dbPath = require.resolve(path.join(ROOT, "lib/db.js"));
const schemaPath = require.resolve(path.join(ROOT, "lib/sessionSchema.js"));
const repSessionPath = require.resolve(path.join(ROOT, "lib/repSession.js"));

let tablas = { docente_firmas: true };
let cols = { "attendance_runtime_sessions.topics": true };
let sesion = { id:"s1", status:"OPEN", teacher_code:"DOC1", representative_id:"rep1", course_offering_id:10 };
let savedSig = null; // { docente_id, signature, updated_at }
let sessionTopics = "Tema previo";
let sessionTopicsAt = "2026-11-19T10:00:00.000Z";
let docenteIdOferta = 77;

function reset(){
  tablas = { docente_firmas: true };
  cols = { "attendance_runtime_sessions.topics": true };
  sesion = { id:"s1", status:"OPEN", teacher_code:"DOC1", representative_id:"rep1", course_offering_id:10 };
  savedSig = null;
  sessionTopics = "Tema previo";
  sessionTopicsAt = "2026-11-19T10:00:00.000Z";
  docenteIdOferta = 77;
}

require.cache[dbPath] = {
  id: dbPath, filename: dbPath, path: path.dirname(dbPath), loaded: true, children: [],
  exports: {
    query: async (sql, params=[]) => {
      const s = String(sql);
      if (/information_schema\.tables/i.test(s)) {
        const t = params[0]; return { rows: tablas[t] ? [{1:1}] : [] };
      }
      if (/information_schema\.columns/i.test(s)) {
        const key = `${params[0]}.${params[1]}`; return { rows: cols[key] ? [{1:1}] : [] };
      }
      if (/FROM attendance_runtime_sessions WHERE id = \$1 LIMIT 1/i.test(s) && /teacher_code/i.test(s)) {
        return { rows: sesion ? [{...sesion}] : [] };
      }
      if (/FROM attendance_runtime_sessions WHERE id = \$1 LIMIT 1/i.test(s) && /topics/i.test(s)) {
        return { rows: sesion ? [{ topics: sessionTopics, topics_updated_at: sessionTopicsAt }] : [] };
      }
      if (/FROM teaching_assignments/i.test(s)) {
        if (Array.isArray(docenteIdOferta)) return { rows: docenteIdOferta.map(u => ({ user_id: u })) };
        return { rows: docenteIdOferta!=null ? [{ user_id: docenteIdOferta }] : [] };
      }
      if (/FROM docente_firmas WHERE docente_id = \$1/i.test(s) && /SELECT updated_at/i.test(s)) {
        return { rows: savedSig ? [{ updated_at: savedSig.updated_at }] : [] };
      }
      if (/FROM docente_firmas WHERE docente_id = \$1/i.test(s) && /SELECT signature/i.test(s)) {
        return { rows: savedSig ? [{ signature: savedSig.signature }] : [] };
      }
      if (/INSERT INTO docente_firmas/i.test(s)) {
        savedSig = { docente_id: params[0], signature: params[1], updated_at: "2026-11-19T12:00:00.000Z" };
        return { rows: [{ docente_id: savedSig.docente_id, updated_at: savedSig.updated_at }] };
      }
      if (/DELETE FROM docente_firmas/i.test(s)) {
        const had = !!savedSig; savedSig = null; return { rows: had ? [{ docente_id: params[0] }] : [] };
      }
      if (/UPDATE attendance_runtime_sessions SET teacher_signature/i.test(s)) {
        return { rows: [{ id: params[1]||"s1", status:"OPEN", teacher_signed_at:"2026-11-19T12:30:00.000Z" }] };
      }
      if (/UPDATE attendance_runtime_sessions/i.test(s) && /SET topics = NULL/i.test(s)) {
        sessionTopics = null; sessionTopicsAt = "2026-11-19T13:00:00.000Z";
        return { rows: [{ id: params[0], topics_updated_at: sessionTopicsAt }] };
      }
      if (/UPDATE attendance_runtime_sessions/i.test(s) && /SET topics = \$1/i.test(s)) {
        sessionTopics = params[0]; sessionTopicsAt = "2026-11-19T13:05:00.000Z";
        return { rows: [{ id: params[1], topics: sessionTopics, topics_updated_at: sessionTopicsAt }] };
      }
      return { rows: [] };
    },
    getPool: () => ({ connect: async () => ({ query: async ()=>({rows:[]}), release(){} }) }),
  },
};
require.cache[repSessionPath] = {
  id: repSessionPath, filename: repSessionPath, path: path.dirname(repSessionPath), loaded: true, children: [],
  exports: { currentRep: async () => null },
};
require.cache[schemaPath] = {
  id: schemaPath, filename: schemaPath, path: path.dirname(schemaPath), loaded: true, children: [],
  exports: {
    columnaExiste: async (_q, table, col) => !!cols[`${table}.${col}`],
    tablaExiste: async (_q, table) => !!tablas[table],
  },
};

const topicsHandler = require(path.join(ROOT, "api/sessions/topics.js"));
const savedSigHandler = require(path.join(ROOT, "api/sessions/teacher-saved-signature.js"));

const results = [];
const check = (name, ok, detail="") => { results.push({name,ok,detail}); console.log(`${ok?"PASS":"FAIL"}  ${name}${detail?"  → "+detail:""}`); };
function fakeRes(){ return {statusCode:200, body:null, status(c){this.statusCode=c;return this;}, json(o){this.body=o;return this;}, setHeader(){}}; }

const VALID_SIG = "data:image/png;base64," + "A".repeat(100);
const BIG_SIG = "data:image/png;base64," + "A".repeat(1000005);

/* ---- Temas ---- */
reset();
{
  const req={method:"POST", headers:{}, body:{sessionId:"s1", topics:"Nuevo tema", teacherCode:"OTRO"}};
  const res=fakeRes(); await topicsHandler(req,res);
  check("T1. Temas: código de otro docente (no coincide) → 401", res.statusCode===401 && res.body && res.body.error==="UNAUTHORIZED", JSON.stringify(res.body));
}
reset();
{
  const req={method:"POST", headers:{}, body:{sessionId:"s1", topics:"Nuevo tema"}};
  const res=fakeRes(); await topicsHandler(req,res);
  check("T2. Temas: sin código → 401", res.statusCode===401 && res.body && res.body.error==="UNAUTHORIZED", JSON.stringify(res.body));
}
reset();
{
  const req={method:"POST", headers:{}, body:{sessionId:"s1", topics:"   ", teacherCode:"DOC1"}};
  const res=fakeRes(); await topicsHandler(req,res);
  check("T3. Temas: vacío sin borrado explícito no pisa (sinCambios)", res.statusCode===200 && res.body && res.body.ok===true && res.body.sinCambios===true && sessionTopics==="Tema previo",
    JSON.stringify({body:res.body, sessionTopics}));
}
reset();
{
  const req={method:"POST", headers:{}, body:{sessionId:"s1", borrar:true, teacherCode:"DOC1"}};
  const res=fakeRes(); await topicsHandler(req,res);
  check("T4. Temas: borrado explícito borra", res.statusCode===200 && res.body && res.body.ok===true && (res.body.topics===null || res.body.borrada===true) && sessionTopics===null,
    JSON.stringify({body:res.body, sessionTopics}));
}
reset();
{
  const largo = "x".repeat(650);
  const req={method:"POST", headers:{}, body:{sessionId:"s1", topics:largo, teacherCode:"DOC1"}};
  const res=fakeRes(); await topicsHandler(req,res);
  check("T5. Temas: >600 se recorta a 600", res.statusCode===200 && res.body && res.body.ok===true && typeof res.body.topics==="string" && res.body.topics.length===600,
    JSON.stringify({len: res.body && res.body.topics && res.body.topics.length}));
}
reset();
{
  cols = { "attendance_runtime_sessions.topics": false };
  const req={method:"POST", headers:{}, body:{sessionId:"s1", topics:"Algo", teacherCode:"DOC1"}};
  const res=fakeRes(); await topicsHandler(req,res);
  check("T6. Temas: columna ausente → 501 TOPICS_UNAVAILABLE (oculto sin error)", res.statusCode===501 && res.body && res.body.error==="TOPICS_UNAVAILABLE", JSON.stringify(res.body));
}

/* ---- Firma guardada ---- */
reset();
{
  const req={method:"GET", headers:{}, url:"/api/sessions/teacher-saved-signature?op=get&sessionId=s1&teacherCode=OTRO", query:{op:"get",sessionId:"s1",teacherCode:"OTRO"}, body:{}};
  const res=fakeRes(); await savedSigHandler(req,res);
  check("F1. Firma guardada: código de otro docente → 401", res.statusCode===401 && res.body && res.body.error==="UNAUTHORIZED", JSON.stringify(res.body));
}
reset();
{
  const req={method:"GET", headers:{}, url:"/api/sessions/teacher-saved-signature?op=get&sessionId=s1", query:{op:"get",sessionId:"s1"}, body:{}};
  const res=fakeRes(); await savedSigHandler(req,res);
  check("F2. Firma guardada: sin código → 401", res.statusCode===401 && res.body && res.body.error==="UNAUTHORIZED", JSON.stringify(res.body));
}
reset();
{
  const req={method:"POST", headers:{}, body:{op:"save", sessionId:"s1", teacherCode:"DOC1", teacherSignature:"data:text/plain;base64,abc"}};
  const res=fakeRes(); await savedSigHandler(req,res);
  check("F3. Firma guardada: firma inválida → 400", res.statusCode===400 && res.body && res.body.error==="INVALID_SIGNATURE", JSON.stringify(res.body));
}
reset();
{
  const req={method:"POST", headers:{}, body:{op:"save", sessionId:"s1", teacherCode:"DOC1", teacherSignature:BIG_SIG}};
  const res=fakeRes(); await savedSigHandler(req,res);
  check("F4. Firma guardada: >1 MB rechazada → 400", res.statusCode===400 && res.body && res.body.error==="INVALID_SIGNATURE", JSON.stringify(res.body));
}
reset();
{
  const req={method:"POST", headers:{}, body:{op:"save", sessionId:"s1", teacherCode:"DOC1", teacherSignature:VALID_SIG}};
  const res=fakeRes(); await savedSigHandler(req,res);
  check("F5. Firma guardada: guardar válida con código correcto → ok", res.statusCode===200 && res.body && res.body.ok===true && res.body.saved===true, JSON.stringify(res.body));
}
reset();
{
  tablas = { docente_firmas: false };
  const req={method:"GET", headers:{}, url:"/api/sessions/teacher-saved-signature?op=get&sessionId=s1&teacherCode=DOC1", query:{op:"get",sessionId:"s1",teacherCode:"DOC1"}, body:{}};
  const res=fakeRes(); await savedSigHandler(req,res);
  check("F6. Firma guardada: tabla ausente → 501 SAVED_SIGNATURE_UNAVAILABLE", res.statusCode===501 && res.body && res.body.error==="SAVED_SIGNATURE_UNAVAILABLE", JSON.stringify(res.body));
}

/* ---- Firma guardada: caminos felices completos + casos adicionales (req 2,4) ---- */
reset();
{
  // Guardar
  let req={method:"POST", headers:{}, body:{op:"save", sessionId:"s1", teacherCode:"DOC1", teacherSignature:VALID_SIG}};
  let res=fakeRes(); await savedSigHandler(req,res);
  check("H1. Happy guardar: ok", res.statusCode===200 && res.body && res.body.ok && res.body.saved===true, JSON.stringify(res.body));
  // Consultar
  req={method:"GET", headers:{}, url:"/api/sessions/teacher-saved-signature?op=get&sessionId=s1&teacherCode=DOC1", query:{op:"get",sessionId:"s1",teacherCode:"DOC1"}, body:{}};
  res=fakeRes(); await savedSigHandler(req,res);
  check("H2. Happy consultar: has=true", res.statusCode===200 && res.body && res.body.ok && res.body.has===true, JSON.stringify(res.body));
  // Aplicar a sesión
  req={method:"POST", headers:{}, body:{op:"apply", sessionId:"s1", teacherCode:"DOC1"}};
  res=fakeRes(); await savedSigHandler(req,res);
  check("H3. Happy aplicar a sesión: ok", res.statusCode===200 && res.body && res.body.ok && res.body.applied===true && res.body.session && res.body.session.teacherSigned===true, JSON.stringify(res.body));
  // Reemplazar
  const VALID_SIG2 = "data:image/jpeg;base64," + "B".repeat(80);
  req={method:"POST", headers:{}, body:{op:"save", sessionId:"s1", teacherCode:"DOC1", teacherSignature:VALID_SIG2}};
  res=fakeRes(); await savedSigHandler(req,res);
  check("H4. Happy reemplazar: ok", res.statusCode===200 && res.body && res.body.ok && res.body.saved===true, JSON.stringify(res.body));
  // Quitar
  req={method:"DELETE", headers:{}, url:"/api/sessions/teacher-saved-signature?op=delete&sessionId=s1&teacherCode=DOC1", query:{op:"delete",sessionId:"s1",teacherCode:"DOC1"}, body:{op:"delete",sessionId:"s1",teacherCode:"DOC1"}};
  res=fakeRes(); await savedSigHandler(req,res);
  check("H5. Happy quitar: ok", res.statusCode===200 && res.body && res.body.ok && res.body.removed===true, JSON.stringify(res.body));
  // Consultar tras quitar
  req={method:"GET", headers:{}, url:"/api/sessions/teacher-saved-signature?op=get&sessionId=s1&teacherCode=DOC1", query:{op:"get",sessionId:"s1",teacherCode:"DOC1"}, body:{}};
  res=fakeRes(); await savedSigHandler(req,res);
  check("H6. Happy consultar tras quitar: has=false", res.statusCode===200 && res.body && res.body.ok && res.body.has===false, JSON.stringify(res.body));
}
reset();
{
  // Oferta de otro docente: se interpreta como intento con teacherCode de otra sesión/docente
  // (no coincide con el teacher_code de esta sesión) => rechazado.
  const req={method:"POST", headers:{}, body:{op:"save", sessionId:"s1", teacherCode:"DOC_OTRO", teacherSignature:VALID_SIG}};
  const res=fakeRes(); await savedSigHandler(req,res);
  check("H7. Oferta/teacherCode de otro docente rechazado → 401", res.statusCode===401 && res.body && res.body.error==="UNAUTHORIZED", JSON.stringify(res.body));
}
reset();
{
  // Oferta sin docente asignado
  docenteIdOferta = null;
  const req={method:"GET", headers:{}, url:"/api/sessions/teacher-saved-signature?op=get&sessionId=s1&teacherCode=DOC1", query:{op:"get",sessionId:"s1",teacherCode:"DOC1"}, body:{}};
  const res=fakeRes(); await savedSigHandler(req,res);
  check("H8. Oferta sin docente asignado → 409 TEACHER_NOT_ASSIGNED", res.statusCode===409 && res.body && res.body.error==="TEACHER_NOT_ASSIGNED", JSON.stringify(res.body));
}
reset();
{
  // Varios docentes ACTIVE en la oferta: ambiguo
  docenteIdOferta = [77, 88];
  const req={method:"GET", headers:{}, url:"/api/sessions/teacher-saved-signature?op=get&sessionId=s1&teacherCode=DOC1", query:{op:"get",sessionId:"s1",teacherCode:"DOC1"}, body:{}};
  const res=fakeRes(); await savedSigHandler(req,res);
  check("H9. Oferta con varios docentes ACTIVE → 409 AMBIGUOUS_TEACHER", res.statusCode===409 && res.body && res.body.error==="AMBIGUOUS_TEACHER", JSON.stringify(res.body));
}


const fallidos = results.filter(r=>!r.ok).length;
console.log(`\n${results.length-fallidos}/${results.length} comprobaciones correctas.`);
process.exit(fallidos?1:0);
