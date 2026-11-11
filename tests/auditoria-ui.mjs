/* tests/auditoria-ui.mjs — Verificación UI de la auditoría general.
   NO toca ninguna base de datos: todas las respuestas de /api/** se
   interceptan con Playwright (page.route) y el sitio se sirve en local.
   Uso:  node tests/auditoria-ui.mjs
   Requiere: npm i --no-save playwright  (navegador chromium instalado) */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = 8123;

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

/* ------------------------- servidor estático ------------------------- */
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

/* --------------------------- datos de prueba -------------------------- */
const CFG_OK = {
  facultad: "INGENIERÍA",
  programa: "INGENIERÍA DE TELECOMUNICACIONES E INFORMÁTICA",
  nivel: "VIII",
  periodo: "2026-2",
  asignatura: "ANALÍTICA DE DATOS",
  codigo: "2720708",
  docente: "ERWIN ENRIQUE MOYA LOZANO",
  correo: "d-erwin.moya@utch.edu.co",
};
const CFG_VACIO = {
  facultad: null, programa: null, nivel: null, periodo: null,
  asignatura: null, codigo: null, docente: null, correo: null,
};

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  → " + detail : ""}`);
};

async function nuevaPagina(browser, { cfg = CFG_OK, bloquearSessionStorage = false, userAgent = undefined } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    ...(userAgent ? { userAgent } : {}),
  });
  const page = await ctx.newPage();
  const erroresConsola = [];
  page.on("console", (m) => {
    if (m.type() === "error") erroresConsola.push(m.text());
  });
  page.on("pageerror", (e) => erroresConsola.push("pageerror: " + e.message));

  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    const metodo = route.request().method();
    const json = (obj, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(obj) });

    if (url.includes("/api/sessions/validate")) {
      const body = JSON.parse(route.request().postData() || "{}");
      const code = String(body.code || "").trim().toUpperCase();
      if (code === "VACIO") return json({ ok: true, role: "STUDENT", sessionId: "s-1", status: "OPEN", createdAt: new Date().toISOString(), cfg: CFG_VACIO });
      if (code === "CERRADA") return json({ ok: false, error: "INVALID_OR_EXPIRED_CODE" });
      return json({ ok: true, role: "STUDENT", sessionId: "s-1", status: "OPEN", createdAt: new Date().toISOString(), cfg });
    }
    if (url.includes("/api/rep/me")) return json({ ok: true, representative: { id: "r-1", name: "Rep Demo", username: "rep" } });
    if (url.includes("/api/rep/offerings")) return json({ ok: true, offerings: [] });
    if (url.includes("/api/rep/sessions")) return json({ ok: true, sessions: [] });
    if (url.includes("/api/records")) return json({ ok: true, light: true, status: "OPEN", registrationOpen: true, count: 0, latestChangeAt: null, teacherSignedAt: null, records: [] });
    if (url.includes("/api/health")) return json({ ok: true, database: true });
    if (metodo === "POST") return json({ ok: true });
    return json({ ok: true });
  });

  if (bloquearSessionStorage) {
    await page.addInitScript(() => {
      const lanzar = () => { throw new DOMException("storage denied", "SecurityError"); };
      Object.defineProperty(window, "sessionStorage", {
        configurable: true,
        get() { return { getItem: lanzar, setItem: lanzar, removeItem: lanzar, clear: lanzar, key: lanzar, get length() { return 0; } }; },
      });
    });
  }

  return { ctx, page, erroresConsola };
}

const titulo = (page) => page.locator("#titEst").innerText().catch(() => "");
const subtitulo = (page) => page.locator("#subEst").innerText().catch(() => "");
const hayFormulario = async (page) => (await page.locator("#nombres").count()) > 0;
const hayCampoClave = async (page) => (await page.locator("#claveEst").count()) > 0;

async function conectar(page, codigo = "ABC123") {
  await page.goto(`http://localhost:${PORT}/#estudiante`);
  await page.fill("#claveEst", codigo);
  await page.click("#validar");
  await page.waitForFunction(() => {
    const t = document.querySelector("#titEst");
    return t && t.textContent.trim() !== "";
  }, null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(250);
}

/* ==================================== tests ============================ */
await server.listen(PORT);
const browser = await chromium.launch(
  process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}
);

/* 1. Caso normal: la materia debe aparecer. */
{
  const { ctx, page, erroresConsola } = await nuevaPagina(browser);
  await conectar(page, "ABC123");
  const t = await titulo(page);
  const s = await subtitulo(page);
  check("1a. Estudiante normal ve la asignatura en el título", t.includes("ANALÍTICA DE DATOS"), JSON.stringify(t));
  check("1b. Estudiante normal ve nivel/período en el subtítulo", s.includes("VIII") && s.includes("2026-2"), JSON.stringify(s));
  check("1c. Estudiante normal ve el formulario", await hayFormulario(page));
  check("1d. Sin errores de consola (vista estudiante)", erroresConsola.length === 0, erroresConsola.join(" | "));
  await ctx.close();
}

/* 2. REPRODUCCIÓN DEL BUG: la API devuelve cfg vacío
      (lo que ocurre cuando un JOIN interno de loadSessionCfg no encuentra fila). */
{
  const { ctx, page } = await nuevaPagina(browser, { cfg: CFG_VACIO });
  await conectar(page, "VACIO");
  const t = await titulo(page);
  const s = await subtitulo(page);
  const form = await hayFormulario(page);
  check("2a. Con cfg vacío el título queda genérico (sin datos que mostrar)", !t.includes("ANALÍTICA") && t.trim() === "Registro de asistencia", JSON.stringify(t));
  check("2b. Con cfg vacío no hay semestre VIII que mostrar", !s.includes("VIII"), JSON.stringify(s));
  check("2c. El formulario del estudiante SÍ está visible (está conectado)", form);
  await ctx.close();
}

/* 3. Estado validado en memoria se pierde al recuperar el foco (bucle reportado). */
{
  const { ctx, page } = await nuevaPagina(browser);
  await conectar(page, "ABC123");
  const antes = await hayFormulario(page);
  const tituloAntes = await titulo(page);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForTimeout(600);
  const despuesCampoClave = await hayCampoClave(page);
  const tituloDespues = await titulo(page);
  check("3a. Antes del foco: formulario visible", antes);
  check("3b. Tras recuperar el foco NO se vuelve a pedir el código", !despuesCampoClave,
    despuesCampoClave ? "zona volvió a 'pedir-clave' tras un simple focus" : "conserva la sesión");
  check("3c. Tras recuperar el foco SE CONSERVA la materia del título",
    tituloDespues.includes("ANALÍTICA DE DATOS"),
    JSON.stringify({ antes: tituloAntes, despues: tituloDespues }));
  await ctx.close();
}

/* 4. sessionStorage bloqueado (webviews integradas / cookies bloqueadas). */
{
  const { ctx, page, erroresConsola } = await nuevaPagina(browser, { bloquearSessionStorage: true });
  let falloNavegacion = null;
  try {
    await page.goto(`http://localhost:${PORT}/#estudiante`);
    await page.waitForTimeout(500);
  } catch (e) { falloNavegacion = e.message; }
  const hayZona = (await page.locator("#zona").count()) > 0;
  const hayInputClave = await hayCampoClave(page);
  check("4a. Con sessionStorage bloqueado la vista estudiante sigue montada", hayZona && !falloNavegacion, falloNavegacion || "");
  check("4b. Con sessionStorage bloqueado se puede escribir el código", hayInputClave);
  check("4c. Errores de consola con sessionStorage bloqueado", erroresConsola.length === 0, erroresConsola.join(" | "));
  await ctx.close();
}

/* 5. Recarga de la página tras validar (supervivencia del estado). */
{
  const { ctx, page } = await nuevaPagina(browser);
  await conectar(page, "ABC123");
  const t1 = await titulo(page);
  await page.reload();
  await page.waitForTimeout(1200);
  const t2 = await titulo(page);
  const form2 = await hayFormulario(page);
  check("5a. Tras recargar la asignatura se recupera (auto-revalidación)", t2.includes("ANALÍTICA DE DATOS"), JSON.stringify({ t1, t2 }));
  check("5b. Tras recargar vuelve el formulario", form2);
  await ctx.close();
}

/* 6. Código inválido / cerrado: mensaje claro en español. */
{
  const { ctx, page } = await nuevaPagina(browser);
  await page.goto(`http://localhost:${PORT}/#estudiante`);
  await page.fill("#claveEst", "CERRADA");
  await page.click("#validar");
  await page.waitForTimeout(400);
  const msg = await page.locator("#msgClave").innerText().catch(() => "");
  check("6. Código inválido muestra mensaje en español", /no es válido|no está disponible/i.test(msg), JSON.stringify(msg));
  await ctx.close();
}

/* 7. Errores de consola en las 5 pantallas públicas, 3 viewports. */
const viewports = [[1366, 768], [768, 1024], [390, 844]];
const rutas = [["", "portal"], ["#estudiante", "estudiante"], ["#docente", "docente"], ["#admin", "representante"], ["/admin.html", "admin"]];
for (const [w, h] of viewports) {
  for (const [ruta, nombre] of rutas) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const errs = [];
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
    await page.route("**/api/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, offerings: [], sessions: [], representatives: [], docentes: [], catalogs: {} }) }));
    const url = ruta.startsWith("/") ? `http://localhost:${PORT}${ruta}` : `http://localhost:${PORT}/${ruta}`;
    await page.goto(url).catch(() => {});
    await page.waitForTimeout(600);
    const scrollable = await page.evaluate(() => document.documentElement.scrollHeight > 0);
    check(`7. ${nombre} ${w}x${h}: sin errores de consola y renderiza`, errs.length === 0 && scrollable, errs.join(" | "));
    await ctx.close();
  }
}

await browser.close();
server.close();

const fallidos = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fallidos}/${results.length} comprobaciones correctas.`);
process.exit(0);
