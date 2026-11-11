/* tests/cerrar-asistencia-servidor.mjs — PROMPT 12, pruebas de servidor.
   Ejecuta el handler real de /api/sessions/close con funciones simuladas
   (query, requireRep): NO se conecta a ninguna base de datos ni se lee .env.
   Uso:  node tests/cerrar-asistencia-servidor.mjs */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const SECRET = "SECRETO-ADMIN-PRUEBA";

/* El adminAuth real usa process.env.ADMIN_SECRET (no toca localConfig ni .env). */
process.env.ADMIN_SECRET = SECRET;

/* ------------------ simulación de la capa de datos ------------------ */
const rutaDb = require.resolve("../lib/db.js");
const rutaRep = require.resolve("../lib/repSession.js");

const estado = {
  consultas: [],
  /* fila que devuelve el UPDATE y la que devuelve el SELECT (null = sin fila) */
  filaUpdate: null,
  filaSelect: null,
  /* si es distinto de null, el UPDATE solo devuelve fila cuando coincide */
  duenoReal: "rep-dueno",
};

function fakeQuery(sql, params) {
  estado.consultas.push({ sql, params });
  const esUpdate = /^\s*UPDATE/i.test(sql);
  if (esUpdate) {
    /* El UPDATE solo encuentra fila si el filtro de dueño (si existe) coincide
       con el dueño real y la sesión está OPEN. */
    const idx = sql.indexOf("representative_id = $2");
    if (idx >= 0 && (!params[1] || params[1] !== estado.duenoReal)) {
      return Promise.resolve({ rows: [] });
    }
    return Promise.resolve({ rows: estado.filaUpdate ? [estado.filaUpdate] : [] });
  }
  const idx = sql.indexOf("representative_id = $2");
  if (idx >= 0 && (!params[1] || params[1] !== estado.duenoReal)) {
    return Promise.resolve({ rows: [] });
  }
  return Promise.resolve({ rows: estado.filaSelect ? [estado.filaSelect] : [] });
}

require.cache[rutaDb] = {
  id: rutaDb, filename: rutaDb, path: require("node:path").dirname(rutaDb),
  loaded: true, children: [], exports: { query: fakeQuery, getPool: () => ({ connect: async () => ({ query: fakeQuery, release() {} }) }) },
};

/* requireRep simulado: `rep` null = sin sesión de representante válida. */
const repSession = { rep: null, llamadas: 0 };
require.cache[rutaRep] = {
  id: rutaRep, filename: rutaRep, path: require("node:path").dirname(rutaRep),
  loaded: true, children: [],
  exports: {
    currentRep: async () => repSession.rep,
    requireRep: async (req, res) => {
      repSession.llamadas++;
      if (!repSession.rep) {
        res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
        return null;
      }
      return repSession.rep;
    },
  },
};

const cerrar = require("../api/sessions/close.js");

/* ----------------------------- utilidades --------------------------- */
function fakeRes() {
  return {
    statusCode: 200, cabeceras: {}, body: null, enviado: false,
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; this.enviado = true; return this; },
    setHeader(k, v) { this.cabeceras[k] = v; },
  };
}

function peticion({ admin = false, secret = SECRET, rep = null, sessionId = "ses-1", method = "POST" } = {}) {
  estado.consultas = [];
  repSession.rep = rep;
  repSession.llamadas = 0;
  const headers = { "content-type": "application/json" };
  if (admin) headers["x-admin-secret"] = secret;
  const req = { method, headers, body: JSON.stringify({ sessionId }) };
  const res = fakeRes();
  return { req, res, run: () => cerrar(req, res) };
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  → " + detail : ""}`);
};

const SQL_UPDATE_ORIGINAL =
  "UPDATE attendance_runtime_sessions SET status = 'CLOSED'," +
  " registration_open = FALSE," +
  " closed_at = NOW(), purge_at = NOW() + INTERVAL '24 hours'" +
  " WHERE id = $1 AND representative_id = $2 AND status = 'OPEN'" +
  " RETURNING id, status, closed_at, purge_at";
const SQL_SELECT_ORIGINAL =
  "SELECT id, status, closed_at, purge_at FROM attendance_runtime_sessions" +
  " WHERE id = $1 AND representative_id = $2 LIMIT 1";

const CERRADA = { id: "ses-1", status: "CLOSED", closed_at: "2026-11-10T12:00:00Z", purge_at: "2026-11-11T12:00:00Z" };

/* =============================== casos ============================== */

/* (a) Administrador válido cierra una sesión ajena. */
{
  estado.filaUpdate = CERRADA; estado.filaSelect = null;
  const { req, res, run } = peticion({ admin: true, rep: null });
  await run();
  check("a. Admin válido cierra sesión ajena → OK", res.statusCode === 200 && res.body && res.body.ok === true,
    JSON.stringify({ code: res.statusCode, body: res.body }));
  check("a2. El admin NO pasa por requireRep", repSession.llamadas === 0, "llamadas=" + repSession.llamadas);
  const upd = estado.consultas[0];
  check("a3. El UPDATE omite la comprobación de dueño", upd && !upd.sql.includes("representative_id"),
    upd ? upd.sql : "(sin consulta)");
  check("a4. El admin no envía firmas: ninguna consulta toca firmas",
    estado.consultas.every((c) => !/signature|firma/i.test(c.sql)));
  check("a5. La respuesta trae status CLOSED", res.body.session && res.body.session.status === "CLOSED");
}

/* (b) Sin credenciales de administrador ni de representante → rechazado. */
{
  estado.filaUpdate = CERRADA; estado.filaSelect = null;
  const { res, run } = peticion({ admin: false, rep: null });
  await run();
  check("b. Sin credenciales → rechazado (401)", res.statusCode === 401 && res.body && res.body.error === "UNAUTHORIZED",
    JSON.stringify({ code: res.statusCode, body: res.body }));
  check("b2. Sin credenciales NO se ejecuta ningún SQL", estado.consultas.length === 0,
    "consultas=" + estado.consultas.length);
}

/* (b2) Secreto de administrador incorrecto → se rechaza igual que antes. */
{
  estado.filaUpdate = CERRADA;
  const { res, run } = peticion({ admin: true, secret: "OTRA-CLAVE", rep: null });
  await run();
  check("b3. Secreto de admin incorrecto → rechazado (401)", res.statusCode === 401 && res.body.error === "UNAUTHORIZED",
    JSON.stringify({ code: res.statusCode, body: res.body }));
}

/* (c) El representante dueño cierra la suya: idéntico a antes. */
{
  estado.filaUpdate = CERRADA; estado.filaSelect = null;
  const { res, run } = peticion({ admin: false, rep: { id: "rep-dueno", name: "Rep", username: "rep" } });
  await run();
  check("c. Representante dueño cierra la suya → OK", res.statusCode === 200 && res.body.ok === true,
    JSON.stringify({ code: res.statusCode, body: res.body }));
  check("c2. La consulta UPDATE es EXACTAMENTE la original",
    estado.consultas[0] && estado.consultas[0].sql === SQL_UPDATE_ORIGINAL,
    estado.consultas[0] ? estado.consultas[0].sql : "(sin consulta)");
  check("c3. Los parámetros siguen siendo [sessionId, rep.id]",
    JSON.stringify(estado.consultas[0] && estado.consultas[0].params) === JSON.stringify(["ses-1", "rep-dueno"]),
    JSON.stringify(estado.consultas[0] && estado.consultas[0].params));
  check("c4. El admin NO se usa en el flujo del representante", repSession.llamadas === 1);
}

/* (c2) Idempotencia: sesión ya cerrada → OK sin volver a UPDATE exitoso. */
{
  estado.filaUpdate = null; estado.filaSelect = CERRADA;
  const { res, run } = peticion({ admin: false, rep: { id: "rep-dueno" } });
  await run();
  check("c5. Sesión ya cerrada → OK idempotente (representante)",
    res.statusCode === 200 && res.body.ok === true && res.body.session.status === "CLOSED",
    JSON.stringify({ code: res.statusCode, body: res.body }));
  check("c6. El SELECT del idempotente es EXACTAMENTE el original",
    estado.consultas[1] && estado.consultas[1].sql === SQL_SELECT_ORIGINAL,
    estado.consultas[1] ? estado.consultas[1].sql : "(sin consulta)");
}

/* (c3) Idempotencia desde el admin. */
{
  estado.filaUpdate = null; estado.filaSelect = CERRADA;
  const { res, run } = peticion({ admin: true });
  await run();
  check("c7. Sesión ya cerrada → OK idempotente (admin)",
    res.statusCode === 200 && res.body.ok === true && res.body.session.status === "CLOSED",
    JSON.stringify({ code: res.statusCode, body: res.body }));
}

/* (d) Un representante que no es dueño → rechazado. */
{
  estado.filaUpdate = null; estado.filaSelect = null;
  const { res, run } = peticion({ admin: false, rep: { id: "rep-otro" } });
  await run();
  check("d. Representante que no es dueño → 404", res.statusCode === 404 && res.body.error === "SESSION_NOT_FOUND",
    JSON.stringify({ code: res.statusCode, body: res.body }));
  check("d2. UPDATE y SELECT siguen filtrando por dueño (no se cierra nada)",
    estado.consultas.length === 2 &&
    /representative_id = \$2/.test(estado.consultas[0].sql) &&
    /representative_id = \$2/.test(estado.consultas[1].sql),
    JSON.stringify(estado.consultas.map((c) => c.sql.slice(0, 60))));
}

/* (d2) El admin sobre una sesión inexistente → 404 (sin filtrar por dueño). */
{
  estado.filaUpdate = null; estado.filaSelect = null;
  const { res, run } = peticion({ admin: true, sessionId: "no-existe" });
  await run();
  check("d3. Admin, sesión inexistente → 404", res.statusCode === 404 && res.body.error === "SESSION_NOT_FOUND",
    JSON.stringify({ code: res.statusCode, body: res.body }));
}

/* (e) Validaciones de entrada sin cambios. */
{
  const { res, run } = peticion({ admin: true, method: "GET" });
  await run();
  check("e. Método distinto de POST → 405", res.statusCode === 405 && res.body.error === "METHOD_NOT_ALLOWED");
}
{
  estado.consultas = []; repSession.rep = { id: "rep-dueno" };
  const req = { method: "POST", headers: {}, body: JSON.stringify({ sessionId: "  " }) };
  const res = fakeRes();
  await cerrar(req, res);
  check("e2. sessionId vacío → 400", res.statusCode === 400 && res.body.error === "INVALID_DATA",
    JSON.stringify({ code: res.statusCode, body: res.body }));
  check("e3. sessionId vacío no consulta la base", estado.consultas.length === 0);
}

/* (f) ADMIN_SECRET no configurado: no se acepta como administrador. */
{
  const guardado = process.env.ADMIN_SECRET;
  delete process.env.ADMIN_SECRET;
  estado.filaUpdate = CERRADA;
  const { res, run } = peticion({ admin: true, rep: null });
  await run();
  process.env.ADMIN_SECRET = guardado;
  check("f. Sin ADMIN_SECRET no se abre la vía de administrador → 401",
    res.statusCode === 401 && res.body.error === "UNAUTHORIZED",
    JSON.stringify({ code: res.statusCode, body: res.body }));
}

/* (g) El admin no envía firmas: la petición solo lleva sessionId. */
{
  estado.filaUpdate = CERRADA;
  const { req, run } = peticion({ admin: true });
  await run();
  const cuerpo = JSON.parse(req.body);
  check("g. El cuerpo de la petición admin solo lleva sessionId",
    Object.keys(cuerpo).length === 1 && typeof cuerpo.sessionId === "string", JSON.stringify(cuerpo));
}

const fallidos = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fallidos}/${results.length} comprobaciones correctas.`);
process.exit(fallidos ? 1 : 0);
