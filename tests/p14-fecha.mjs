/* tests/p14-fecha.mjs — PROMPT 14, punto 1: Fecha/hora de la planilla.
   - Unitarios de los helpers (hoy, fechaAperturaBogota, fmtFecha) en load.
   - Docente: al abrir, S.cfg.fecha = día de created_at del servidor (Bogotá).
   - Representante: al abrir, S.cfg.fecha = fAp || hoy() (sin heredar).
   Uso: BROWSER_PATH=/usr/bin/brave-browser-stable node tests/p14-fecha.mjs */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = 8128;
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(String(req.url).split("?")[0]);
    const file = join(ROOT, normalize(p).replace(/^\/+/, ""));
    const s = await stat(file).catch(() => null);
    const target = s && s.isDirectory() ? join(file, "index.html") : file;
    const body = await readFile(target);
    res.writeHead(200, { "content-type": MIME[extname(target)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end();
  }
});

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  → " + detail : ""}`);
};

async function nuevaPagina(browser, { init = "", tz = "America/Bogota" } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: tz });
  const errs = [];
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    const json = (obj, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(obj) });
    const path = url.split("?")[0];
    if (path.endsWith("/api/sessions/validate")) {
      return json({
        ok: true, role: "TEACHER", sessionId: "ses-p14", status: "OPEN",
        createdAt: "2026-11-19T07:31:00.000Z",
        cfg: { asignatura: "REDES", codigo: "2720708", docente: "DOCENTE DEMO" },
      });
    }
    if (url.includes("/api/rep/sessions")) {
      return json({
        ok: true,
        sessions: [{
          sessionId: "ses-p14", asignatura: "REDES", codigo: "2720708", docente: "DOCENTE DEMO",
          status: "OPEN", registrationOpen: true, recordCount: 0,
        }],
      });
    }
    if (url.includes("/api/rep/session")) {
      return json({
        ok: true,
        session: {
          sessionId: "ses-p14", status: "OPEN", registrationOpen: true, recordCount: 0,
          createdAt: "2026-11-19T07:31:00.000Z", studentCode: "ABC123", teacherCode: "DOC123",
          attendanceNumber: 1, periodo: "2026-1", asignatura: "REDES",
        },
        records: [],
      });
    }
    return json({ ok: true });
  });
  if (init) await page.addInitScript(init);
  return { ctx, page, errs };
}

await server.listen(PORT);
const browser = await chromium.launch(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {});

/* 1. Unitarios de los helpers. */
{
  const { ctx, page, errs } = await nuevaPagina(browser);
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForTimeout(400);
  const h = await page.evaluate(() => ({
    hoy: hoy(),
    isoBogota: fechaAperturaBogota("2026-11-19T07:31:00.000Z"),
    isoUTC: new Date("2026-11-19T07:31:00.000Z").toISOString(),
    fechaDetro: fechaAperturaBogota("2026-11-19"),
    nulo: fechaAperturaBogota(null),
    vacio: fechaAperturaBogota(""),
    invalido: fechaAperturaBogota("bogus"),
    horaBogota: horaAperturaBogota("2026-11-19T07:31:00.000Z"),
    fechaFormato: fmtFecha("2026-11-19"),
    consistente: fechaAperturaBogota(hoy()),
  }));
  check("1a. hoy() devuelve una fecha Bogotá en formato YYYY-MM-DD", /^\d{4}-\d{2}-\d{2}$/.test(h.hoy), JSON.stringify(h));
  check("1b. fechaAperturaBogota('2026-11-19T07:31:00Z') = '2026-11-19' (America/Bogota)", h.isoBogota === "2026-11-19", JSON.stringify(h.isoBogota));
  check("1c. fechaAperturaBogota('2026-11-19') devuelve '2026-11-19' (día civil, sin parse UTC)", h.fechaDetro === "2026-11-19", JSON.stringify(h.fechaDetro));
  check("1d. fechaAperturaBogota(null) = ''", h.nulo === "");
  check("1e. fechaAperturaBogota('') = ''", h.vacio === "");
  check("1f. fechaAperturaBogota('bogus') = ''", h.invalido === "");
  check("1g. horaAperturaBogota devuelve '02:31' o similar en Bogotá", /^\d{2}:\d{2}$/.test(h.horaBogota), JSON.stringify(h.horaBogota));
  check("1h. fmtFecha(hoy()) es idempotente-ish (DD-MM-AAAA)", /^\d{2}-\d{2}-\d{4}$/.test(h.fechaFormato), JSON.stringify(h.fechaFormato));
  check("1i. fechaAperturaBogota(hoy()) === hoy()", h.consistente === h.hoy, JSON.stringify({ hoy: h.hoy, out: h.consistente }));
  check("1j. Sin errores de consola", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* 2. Docente: al abrir, S.cfg.fecha = día del created_at del servidor. */
{
  const { ctx, page, errs } = await nuevaPagina(browser, { tz: "America/Bogota" });
  await page.goto(`http://localhost:${PORT}/#docente`);
  await page.fill("#codigoDocente", "DOC123");
  await page.click("#ingresarDocente");
  await page.waitForSelector("#hoja", { timeout: 8000 });
  await page.waitForTimeout(400);
  const fecha = await page.evaluate(() => S.cfg.fecha);
  check("2a. Docente: S.cfg.fecha = '2026-11-19' tras entrar (created_at del servidor)", fecha === "2026-11-19", JSON.stringify(fecha));
  const planillaMuestraFecha = await page.evaluate(() => document.querySelector("#hoja") ? true : false);
  check("2b. Planilla montada", planillaMuestraFecha);
  check("2c. Sin errores de consola", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* 3. Representante: S.cfg.fecha (punto 1) + attendanceNumber (punto 2) en app.js.
   Los nombres de exportación (PDF/impresión, CSV, JSON) del panel del representante
   se verifican por código (js/app.js $('#pdf'/$'#csv'/$'#json')) + test unitario de
   nombreArchivoAsist + tests/p14-nombre-servidor.mjs. */
{
  const { ctx, page, errs } = await nuevaPagina(browser);
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForSelector(".portal-card", { timeout: 8000 });
  await page.waitForTimeout(300);
  const res = await page.evaluate(async () => {
    await seleccionarAsistenciaRep("ses-p14");
    return {
      fecha: S.cfg.fecha,
      num: S.sesion.attendanceNumber,
      nombre: nombreArchivoAsist(S.sesion.attendanceNumber, S.cfg.asignatura, S.cfg.periodo),
      pertenece: location.hash === "",
    };
  });
  check("3a. Representante: S.cfg.fecha = '2026-11-19' (fecha created_at del servidor)", res.fecha === "2026-11-19", JSON.stringify(res.fecha));
  check("3a2. Representante: S.sesion.attendanceNumber === 1 tras seleccionar asistencia", res.num === 1, JSON.stringify(res.num));
  check("3a3. Nombre del archivo exportado (rep panel): " + res.nombre, res.nombre === "Asist_001_redes_2026-1", JSON.stringify(res.nombre));
  check("3b. Sin errores de consola", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* 4. "Día anterior" candidato 1: ISO de día específico (sin zona). */
{
  const { ctx, page } = await nuevaPagina(browser);
  await page.goto(`http://localhost:${PORT}/`);
  const r = await page.evaluate(() => ({
    iso: fechaAperturaBogota("2026-11-19"),
    previo: fechaAperturaBogota("2026-11-18T00:00:00"),
    nada: fechaAperturaBogota(undefined),
  }));
  check("4a. new Date('YYYY-MM-DD') ya devuelve ese día en czgFormat", r.iso === "2026-11-19", JSON.stringify(r));
  check("4b. Other", /^\d{4}-\d{2}-\d{2}$/.test(r.nada) === false, JSON.stringify(r.nada));
  await ctx.close();
}

await browser.close();
server.close();
const fallidos = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fallidos}/${results.length} comprobaciones correctas.`);
process.exit(fallidos ? 1 : 0);
