/* tests/cerrar-asistencia.mjs — PROMPT 12: botón "Cerrar" en el Historial.
   NO toca ninguna base de datos: todas las respuestas de /api/** se
   interceptan con Playwright (page.route) y el sitio se sirve en local.
   Uso:  BROWSER_PATH=/usr/bin/brave-browser-stable node tests/cerrar-asistencia.mjs
   Requiere: npm i --no-save playwright  (navegador chromium o Brave) */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = 8124;
const SECRET = "SECRETO-ADMIN-PRUEBA";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(String(req.url).split("?")[0]);
    if (p === "/ruta-administrativa") p = "/admin.html";
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ""));
    const s = await stat(file).catch(() => null);
    const target = s && s.isDirectory() ? join(file, "index.html") : file;
    const body = await readFile(target);
    res.writeHead(200, { "content-type": MIME[extname(target)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
  }
});

/* ----------------------------- datos ----------------------------- */
const AGORA = Date.now();
const iso = (min) => new Date(AGORA - min * 60000).toISOString();

const SES_ABIERTA = {
  sessionId: "ses-abierta", createdAt: iso(30), asignatura: "ANALÍTICA DE DATOS",
  codigo: "2720708", nivel: "VIII", grupo: "1", representante: "Rep Demo",
  status: "OPEN", recordCount: 3,
};
const SES_CERRADA = {
  sessionId: "ses-cerrada", createdAt: iso(90), closedAt: iso(75),
  asignatura: "BASES DE DATOS", codigo: "2720808", nivel: "VIII", grupo: "1",
  representante: "Rep Demo", status: "CLOSED", recordCount: 5,
};

function nuevoEstado() {
  return {
    cierre: "ok",            // ok | lenta | error | unauthorized
    cierres: 0,
    ultimaClose: null,
    sesiones: [SES_ABIERTA, SES_CERRADA],
    lightStatus: "OPEN",     // estado que devuelven las consultas ligeras
    lightCalls: 0,
    registroOk: true,
  };
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  → " + detail : ""}`);
};

/* ------------------------- red simulada -------------------------- */
async function interceptar(page, est) {
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const url = req.url();
    const metodo = req.method();
    const json = (obj, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(obj) });
    let q;
    try { q = new URL(url).searchParams; } catch { q = new URLSearchParams(); }

    /* --- Historial / administración --- */
    if (url.includes("/api/admin/representatives")) return json({ ok: true, representatives: [] });
    if (url.includes("/api/admin/offerings")) {
      return json({
        ok: true, offerings: [],
        catalogs: { periodos: [], niveles: [], grupos: [], asignaturas: [], docentes: [], programas: [] },
      });
    }
    if (url.includes("/api/admin/docentes")) return json({ ok: true, docentes: [] });
    if (url.includes("/api/admin/sesiones")) {
      return json({
        ok: true, total: 12, pages: 2, page: Number(q.get("page") || 1), pageSize: 10,
        sesiones: est.sesiones,
      });
    }

    /* --- Cierre (el objeto del PROMPT 12) --- */
    if (url.includes("/api/sessions/close")) {
      est.cierres++;
      est.ultimaClose = { headers: req.headers(), body: req.postData() };
      if (est.cierre === "lenta") await new Promise((r) => setTimeout(r, 700));
      if (est.cierre === "error") return json({ ok: false, error: "INTERNAL_ERROR" }, 500);
      if (est.cierre === "unauthorized") return json({ ok: false, error: "UNAUTHORIZED" }, 401);
      return json({
        ok: true,
        session: { id: "ses-abierta", status: "CLOSED", closedAt: new Date(Date.now() - 20 * 60000).toISOString(), purgeAt: new Date(Date.now() + 86400000).toISOString() },
      });
    }

    /* --- Validación de códigos --- */
    if (url.includes("/api/sessions/validate")) {
      const body = JSON.parse(req.postData() || "{}");
      const code = String(body.code || "").trim().toUpperCase();
      if (code === "DOC123") {
        return json({ ok: true, role: "TEACHER", sessionId: "ses-doc", status: "OPEN", createdAt: iso(20), cfg: { asignatura: "REDES", codigo: "2720708", docente: "DOCENTE DEMO" } });
      }
      if (code === "CERRADA2") return json({ ok: false, error: "INVALID_OR_EXPIRED_CODE", status: "CLOSED" });
      if (code === "MALO") return json({ ok: false, error: "INVALID_OR_EXPIRED_CODE" });
      return json({
        ok: true, role: "STUDENT", sessionId: "ses-abierta", status: "OPEN",
        createdAt: iso(30),
        cfg: {
          facultad: "INGENIERÍA", programa: "INGENIERÍA DE TELECOMUNICACIONES E INFORMÁTICA",
          nivel: "VIII", periodo: "2026-2", asignatura: "ANALÍTICA DE DATOS",
          codigo: "2720708", docente: "ERWIN ENRIQUE MOYA LOZANO", correo: "d-erwin.moya@utch.edu.co",
        },
      });
    }

    /* --- Registro de estudiantes --- */
    if (url.includes("/api/records") && metodo === "POST") {
      if (!est.registroOk) return json({ ok: false, error: "SESSION_NOT_AVAILABLE" }, 400);
      return json({ ok: true, record: { id: "r-1" } }, 201);
    }

    /* --- Listas ligeras (representante y docente) --- */
    if (url.includes("/api/records")) {
      est.lightCalls++;
      if (q.get("light") !== "1") return json({ ok: true, records: [], count: 0 });
      return json({
        ok: true, light: true, status: est.lightStatus, registrationOpen: est.lightStatus === "OPEN",
        count: 0, latestChangeAt: null, teacherSignedAt: null, records: [],
      });
    }

    /* --- Representante --- */
    if (url.includes("/api/rep/me")) return json({ ok: true, representative: { id: "r-1", name: "Rep Demo", username: "rep" } });
    if (url.includes("/api/rep/sessions")) {
      return json({
        ok: true,
        sessions: [{
          sessionId: "ses-abierta", asignatura: "ANALÍTICA DE DATOS", codigo: "2720708",
          docente: "ERWIN MOYA", status: "OPEN", registrationOpen: true, recordCount: 0,
        }],
      });
    }
    if (url.includes("/api/rep/session")) {
      return json({
        ok: true,
        session: {
          sessionId: "ses-abierta", status: "OPEN", registrationOpen: true, recordCount: 0,
          createdAt: iso(30), studentCode: "ABC123", teacherCode: "DOC123",
          asignatura: "ANALÍTICA DE DATOS", codigo: "2720708", nivel: "VIII",
          periodo: "2026-2", docente: "ERWIN MOYA", facultad: "INGENIERÍA",
          programa: "TELECOMUNICACIONES E INFORMÁTICA", teacherSignature: "", representativeSignature: "",
        },
        records: [],
      });
    }

    if (metodo === "POST") return json({ ok: true });
    return json({ ok: true });
  });
}

async function nuevaPagina(browser, { est, init = "", viewport = { width: 1366, height: 768 } } = {}) {
  const ctx = await browser.newContext({ viewport });
  const errs = [];
  ctx.on("page", (p) => {
    p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  await interceptar(page, est);
  if (init) await page.addInitScript(init);
  return { ctx, page, errs };
}

async function abrirHistorial(page) {
  await page.goto(`http://localhost:${PORT}/admin.html`);
  await page.waitForSelector('#adminApp [data-v="historial"]', { timeout: 8000 });
  /* click por JS: a 768/390 el menú lateral está fuera de pantalla. */
  await page.evaluate(() => document.querySelector('#adminApp [data-v="historial"]').click());
  await page.waitForSelector("#histBody tr", { timeout: 8000 });
}

const fila = (page, sid) => page.locator(`#histBody tr[data-sid="${sid}"]`);

/* ==================================== tests ============================ */
await server.listen(PORT);
const browser = await chromium.launch(
  process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}
);

/* 1. La fila ABIERTA muestra "Cerrar"; la CERRADA, no. Estilo y medidas. */
{
  const est = nuevoEstado();
  const { ctx, page, errs } = await nuevaPagina(browser, {
    est, init: `sessionStorage.setItem("utch.sesion.adminSecret", ${JSON.stringify(SECRET)});`,
  });
  await abrirHistorial(page);

  const abierta = fila(page, "ses-abierta");
  const cerrada = fila(page, "ses-cerrada");
  check("1a. Fila ABIERTA muestra el botón Cerrar", (await abierta.locator("[data-cerrar]").count()) === 1);
  check("1b. Fila CERRADA NO muestra el botón Cerrar", (await cerrada.locator("[data-cerrar]").count()) === 0);
  check("1c. Sigue mostrando Ver y Eliminar", (await abierta.locator("[data-ver]").count()) === 1 && (await abierta.locator("[data-borrar]").count()) === 1);

  const btn = abierta.locator("[data-cerrar]");
  const aria = await btn.getAttribute("aria-label");
  check("1d. aria-label correcto", aria === "Cerrar asistencia ANALÍTICA DE DATOS", String(aria));

  const estilo = await btn.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { color: cs.color, bg: cs.backgroundColor, border: cs.borderTopColor, min: cs.minWidth, h: el.offsetHeight };
  });
  check("1e. Acento ámbar (texto/borde #b45309, fondo #fffbeb)",
    estilo.color === "rgb(180, 83, 9)" && estilo.border === "rgb(180, 83, 9)" && estilo.bg === "rgb(255, 251, 235)",
    JSON.stringify(estilo));

  const alturas = await page.evaluate(() => {
    const c = document.querySelector("#histBody [data-cerrar]");
    const v = document.querySelector("#histBody [data-ver]");
    return { cerrar: c.offsetHeight, ver: v.offsetHeight, min: getComputedStyle(c).minWidth };
  });
  check("1f. Misma altura que Ver y min-width 92px",
    alturas.cerrar === alturas.ver && alturas.min === "92px", JSON.stringify(alturas));

  check("1g. Sin errores de consola (vista Historial)", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* 2. Hover real con la ratón de Playwright. */
{
  const est = nuevoEstado();
  const { ctx, page } = await nuevaPagina(browser, {
    est, init: `sessionStorage.setItem("utch.sesion.adminSecret", ${JSON.stringify(SECRET)});`,
  });
  await abrirHistorial(page);
  await page.hover("#histBody [data-cerrar]");
  await page.waitForTimeout(400); /* la transición de color tarda un poco */
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector("#histBody [data-cerrar]")).backgroundColor);
  check("2. Hover: fondo #fef3c7", bg === "rgb(254, 243, 199)", bg);
  await ctx.close();
}

/* 3. Cancelar: no se llama al servidor y la fila no cambia. */
{
  const est = nuevoEstado();
  const { ctx, page } = await nuevaPagina(browser, {
    est, init: `sessionStorage.setItem("utch.sesion.adminSecret", ${JSON.stringify(SECRET)});`,
  });
  await abrirHistorial(page);
  await page.click("#histBody [data-cerrar]");
  await page.waitForSelector("#uiModal .ui-panel");
  const titulo = await page.locator("#uiModal .ui-title").innerText();
  const mensaje = await page.locator("#uiModal .ui-msg").innerText();
  check("3a. Confirmación: título 'Cerrar asistencia'", titulo === "Cerrar asistencia", titulo);
  check("3b. Confirmación: texto con asignatura y representante",
    mensaje.includes("«ANALÍTICA DE DATOS»") && mensaje.includes("(Rep Demo)") &&
    mensaje.includes("ya no podrán registrarse") && mensaje.includes("reabrirla desde su panel"),
    JSON.stringify(mensaje));
  const botones = await page.locator("#uiModal .ui-actions button").allInnerTexts();
  check("3c. Botones 'Cancelar' y 'Cerrar asistencia'",
    botones.length === 2 && botones[0] === "Cancelar" && botones[1] === "Cerrar asistencia", JSON.stringify(botones));

  await page.click('#uiModal [data-ui="cancel"]');
  await page.waitForTimeout(300);
  check("3d. Cancelar NO envía ninguna petición", est.cierres === 0, "cierres=" + est.cierres);
  check("3e. La fila sigue ABIERTA con su botón",
    (await page.locator('#histBody tr[data-sid="ses-abierta"] [data-cerrar]').count()) === 1 &&
    (await page.locator('#histBody tr[data-sid="ses-abierta"] .adm-badge').innerText()).includes("ABIERTA"));
  await ctx.close();
}

/* 4. Confirmar: petición con credenciales admin y la fila pasa a CERRADA
      sin perder página, filtros ni búsqueda. */
{
  const est = nuevoEstado();
  const { ctx, page, errs } = await nuevaPagina(browser, {
    est, init: `sessionStorage.setItem("utch.sesion.adminSecret", ${JSON.stringify(SECRET)});`,
  });
  await abrirHistorial(page);

  /* Búsqueda + página 2: todo debe sobrevivir al cierre. */
  await page.fill("#hQ", "ANAL");
  await page.waitForTimeout(700); /* debounce de la búsqueda (vuelve a pág. 1) */
  await page.click("#histNext");
  await page.waitForFunction(() => (document.querySelector("#histPag") || {}).textContent.includes("Página 2"));
  const pagAntes = await page.locator("#histPag").innerText();
  const qAntes = await page.inputValue("#hQ");
  const repAntes = await page.inputValue("#hRep");

  const anchoAntes = await page.evaluate(() => document.querySelector("#histBody [data-cerrar]").getBoundingClientRect().width);
  est.cierre = "lenta";
  await page.click("#histBody [data-cerrar]");
  await page.waitForSelector("#uiModal .ui-panel");
  await page.click('#uiModal [data-ui="ok"]');
  await page.waitForSelector("#histBody .spin");
  const durante = await page.evaluate(() => {
    const b = document.querySelector("#histBody [data-cerrar]");
    return { w: b.getBoundingClientRect().width, disabled: b.disabled };
  });
  check("4a. Mientras cierra: botón deshabilitado con spinner", durante.disabled === true, JSON.stringify(durante));
  check("4b. El ancho del botón NO cambia al cargar", Math.abs(durante.w - anchoAntes) < 0.5,
    JSON.stringify({ antes: anchoAntes, durante: durante.w }));

  await page.waitForFunction(() => {
    const t = document.querySelector('#histBody tr[data-sid="ses-abierta"] .adm-badge');
    return t && t.textContent.includes("CERRADA");
  }, null, { timeout: 5000 });

  check("4c. Se envió UNA petición", est.cierres === 1, "cierres=" + est.cierres);
  const h = est.ultimaClose ? est.ultimaClose.headers : {};
  check("4d. La petición lleva las credenciales de administrador",
    h["x-admin-secret"] === SECRET, JSON.stringify({ cabecera: h["x-admin-secret"] ? "(presente)" : "(ausente)" }));
  check("4e. El cuerpo envía el sessionId", String(est.ultimaClose && est.ultimaClose.body).includes("ses-abierta"),
    String(est.ultimaClose && est.ultimaClose.body));

  const tr = fila(page, "ses-abierta");
  check("4f. La fila queda CERRADA", (await tr.locator(".adm-badge").innerText()).includes("CERRADA"));
  check("4g. Desaparece el botón Cerrar (siguen Ver y Eliminar)",
    (await tr.locator("[data-cerrar]").count()) === 0 &&
    (await tr.locator("[data-ver]").count()) === 1 && (await tr.locator("[data-borrar]").count()) === 1);
  const tiempo = await tr.locator('td[data-label="Tiempo"]').innerText();
  check("4h. Se actualiza 'Tiempo' (duración real, sin contador en vivo)",
    (await tr.locator("[data-tiempo]").count()) === 0 && /10\s*min/.test(tiempo), JSON.stringify(tiempo));

  const pag = await page.locator("#histPag").innerText();
  const q = await page.inputValue("#hQ");
  const rep = await page.inputValue("#hRep");
  check("4i. Se conservan página, búsqueda y filtro",
    pag === pagAntes && q === qAntes && rep === repAntes,
    JSON.stringify({ antes: { pag: pagAntes, q: qAntes, rep: repAntes }, despues: { pag, q, rep } }));

  await page.waitForSelector("#histAviso");
  const aviso = await page.locator("#histAviso").innerText();
  check("4k. Aviso breve 'Asistencia cerrada'", aviso === "Asistencia cerrada", aviso);
  check("4l. Sin errores de consola", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* 5. Doble clic: una sola petición. */
{
  const est = nuevoEstado();
  const { ctx, page } = await nuevaPagina(browser, {
    est, init: `sessionStorage.setItem("utch.sesion.adminSecret", ${JSON.stringify(SECRET)});`,
  });
  await abrirHistorial(page);
  await page.evaluate(() => {
    const b = document.querySelector("#histBody [data-cerrar]");
    b.click(); b.click();
  });
  await page.waitForTimeout(200);
  const paneles = await page.locator("#uiModal .ui-panel").count();
  check("5a. Doble clic: se abre UNA sola confirmación", paneles === 1, "paneles=" + paneles);
  await page.click('#uiModal [data-ui="ok"]');
  await page.waitForTimeout(900);
  check("5b. Doble clic: UNA sola petición", est.cierres === 1, "cierres=" + est.cierres);
  await ctx.close();
}

/* 6. Error del servidor: mensaje claro y la fila queda como estaba. */
{
  const est = nuevoEstado();
  est.cierre = "error";
  const { ctx, page, errs } = await nuevaPagina(browser, {
    est, init: `sessionStorage.setItem("utch.sesion.adminSecret", ${JSON.stringify(SECRET)});`,
  });
  await abrirHistorial(page);
  await page.click("#histBody [data-cerrar]");
  await page.waitForSelector("#uiModal .ui-panel");
  await page.click('#uiModal [data-ui="ok"]');
  await page.waitForSelector("#uiModal .ui-title");
  await page.waitForFunction(() => (document.querySelector("#uiModal .ui-title") || {}).textContent === "No se pudo cerrar", null, { timeout: 5000 });
  const msg = await page.locator("#uiModal .ui-msg").innerText();
  check("6a. Error 500: mensaje en español", /No se pudo cerrar la asistencia/.test(msg) && /La asistencia sigue como estaba/.test(msg), JSON.stringify(msg));
  const sigue = await page.evaluate(() => ({
    badge: document.querySelector('#histBody tr[data-sid="ses-abierta"] .adm-badge').textContent,
    btn: document.querySelectorAll('#histBody tr[data-sid="ses-abierta"] [data-cerrar]').length,
  }));
  check("6b. La fila queda como estaba", sigue.badge.includes("ABIERTA") && sigue.btn === 1, JSON.stringify(sigue));
  /* El navegador anota por su cuenta el 500 simulado: solo se descartan esos
     avisos de red; cualquier error de JavaScript sigue siendo un fallo. */
  const errsJs = errs.filter((e) => !/Failed to load resource/.test(e));
  check("6c. Sin errores de JavaScript ante el error del servidor", errsJs.length === 0, errsJs.join(" | "));
  await ctx.close();
}

/* 7. Sesión admin expirada (401): mismo manejo que el resto del admin. */
{
  const est = nuevoEstado();
  est.cierre = "unauthorized";
  const { ctx, page } = await nuevaPagina(browser, {
    est, init: `sessionStorage.setItem("utch.sesion.adminSecret", ${JSON.stringify(SECRET)});`,
  });
  await abrirHistorial(page);
  await page.click("#histBody [data-cerrar]");
  await page.waitForSelector("#uiModal .ui-panel");
  await page.click('#uiModal [data-ui="ok"]');
  await page.waitForSelector("#admSecret", { timeout: 5000 });
  check("7. Con 401 vuelve al login administrativo", (await page.locator("#admEntrar").count()) === 1);
  await ctx.close();
}

/* 8. Viewports: 1366 (la columna Acciones cabe), 768 y 390 sin desbordes. */
for (const [w, h] of [[1366, 768], [768, 1024], [390, 844]]) {
  const est = nuevoEstado();
  const { ctx, page, errs } = await nuevaPagina(browser, {
    est, viewport: { width: w, height: h },
    init: `sessionStorage.setItem("utch.sesion.adminSecret", ${JSON.stringify(SECRET)});`,
  });
  await abrirHistorial(page);
  const med = await page.evaluate(() => {
    const wrap = document.querySelector(".adm-table-wrap");
    const doc = document.documentElement;
    const btns = document.querySelectorAll("#histBody tr[data-sid='ses-abierta'] td.nowrap button");
    return {
      wrapSw: wrap.scrollWidth, wrapCw: wrap.clientWidth,
      docSw: doc.scrollWidth, winW: window.innerWidth,
      botones: btns.length,
      accAncho: document.querySelector("#histBody tr[data-sid='ses-abierta'] td.nowrap").scrollWidth,
      accCw: document.querySelector("#histBody tr[data-sid='ses-abierta'] td.nowrap").clientWidth,
    };
  });
  check(`8. ${w}x${h}: 3 botones de acción, sin desborde de página ni errores de consola`,
    med.botones === 3 && med.docSw <= med.winW + 1 && errs.length === 0,
    JSON.stringify({ med, errs }));
  if (w === 1366) {
    check("8b. 1366: la columna Acciones cabe sin scroll horizontal",
      med.wrapSw <= med.wrapCw + 1 && med.accAncho <= med.accCw + 1,
      JSON.stringify({ wrap: [med.wrapSw, med.wrapCw], acciones: [med.accAncho, med.accCw] }));
  }
  await ctx.close();
}

/* 9. Docente: detecta CERRADA, detiene el polling y lo muestra. */
{
  const est = nuevoEstado();
  const { ctx, page, errs } = await nuevaPagina(browser, { est });
  await page.goto(`http://localhost:${PORT}/#docente`);
  await page.fill("#codigoDocente", "DOC123");
  await page.click("#ingresarDocente");
  await page.waitForSelector("#estadoDocente", { state: "attached", timeout: 8000 });
  await page.waitForFunction(() => (document.querySelector("#totalEst") || {}).textContent !== null, null, { timeout: 8000 });
  const oculto1 = await page.locator("#estadoDocente").isHidden();
  check("9a. Docente conectado: sin aviso de cierre", oculto1);

  est.lightStatus = "CLOSED";
  await page.waitForFunction(() => {
    const e = document.querySelector("#estadoDocente");
    return e && !e.hidden && e.textContent.includes("Asistencia cerrada");
  }, null, { timeout: 9000 });
  check("9b. Docente muestra 'Asistencia cerrada.'", true);

  const llamadas = est.lightCalls;
  await page.waitForTimeout(5200);
  check("9c. Docente detiene el polling", est.lightCalls === llamadas,
    `antes=${llamadas} despues=${est.lightCalls}`);
  check("9d. Sin errores de consola (docente)", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* 10. Representante: detecta CERRADA, detiene el polling y lo muestra. */
{
  const est = nuevoEstado();
  const { ctx, page, errs } = await nuevaPagina(browser, {
    est, init: `sessionStorage.setItem("utch.sesion.rep", "1");`,
  });
  await page.goto(`http://localhost:${PORT}/#admin`);
  await page.waitForSelector("#verAsistencias", { timeout: 8000 });
  await page.click("#verAsistencias");
  await page.waitForSelector("#listaAsistencias [data-sid]", { timeout: 8000 });
  await page.click("#listaAsistencias [data-sid]");
  await page.waitForFunction(() => {
    const e = document.querySelector("#estadoReg");
    return e && e.textContent.includes("Registros permitidos");
  }, null, { timeout: 8000 });
  check("10a. Representante con asistencia abierta: 'Registros permitidos.'", true);

  est.lightStatus = "CLOSED";
  await page.waitForFunction(() => {
    const e = document.querySelector("#estadoReg");
    return e && e.textContent.includes("Asistencia cerrada");
  }, null, { timeout: 9000 });
  const red = await page.locator("#red").innerText();
  check("10b. Representante muestra 'Asistencia cerrada.'", true);
  check("10c. El aviso general indica registro cerrado", /cerrado/i.test(red), JSON.stringify(red));

  const llamadas = est.lightCalls;
  await page.waitForTimeout(5200);
  check("10d. Representante detiene el polling", est.lightCalls === llamadas,
    `antes=${llamadas} despues=${est.lightCalls}`);
  check("10e. Sin errores de consola (representante)", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* 11. Estudiante: al intentar registrarse en una asistencia cerrada,
      recibe el mensaje de cierre. */
{
  const est = nuevoEstado();
  const { ctx, page, errs } = await nuevaPagina(browser, { est });
  await page.goto(`http://localhost:${PORT}/#estudiante`);
  await page.fill("#claveEst", "CERRADA2");
  await page.click("#validar");
  await page.waitForTimeout(500);
  const msg = await page.locator("#msgClave").innerText();
  check("11a. Estudiante: mensaje de asistencia cerrada", /asistencia está cerrada/i.test(msg), JSON.stringify(msg));
  check("11b. El formulario NO se abre", (await page.locator("#nombres").count()) === 0);

  await page.fill("#claveEst", "MALO");
  await page.click("#validar");
  await page.waitForTimeout(400);
  const msg2 = await page.locator("#msgClave").innerText();
  check("11c. Código inexistente: mensaje genérico (sin cambio)", /no es válido|no está disponible/i.test(msg2), JSON.stringify(msg2));
  check("11d. Sin errores de consola (estudiante)", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
server.close();

const fallidos = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fallidos}/${results.length} comprobaciones correctas.`);
process.exit(fallidos ? 1 : 0);
