/* tests/p14-copiar-mensaje.mjs — PROMPT 16: textos oficiales de mensajes (WhatsApp).
   Unitarios de MENSAJES/construirMensaje/copiarTextoAlPortapapeles (app.js).
   Verifica: texto oficial (sin "PROVISIONAL"), enlace literal, código copiado = mostrado.
   Uso: BROWSER_PATH=/usr/bin/brave-browser-stable node tests/p14-copiar-mensaje.mjs */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = 8131;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(String(req.url).split("?")[0]);
    const file = join(ROOT, normalize(p).replace(/^\/+/, ""));
    const s = await stat(file).catch(() => null);
    const target = s && s.isDirectory() ? join(file, "index.html") : file;
    const body = await readFile(target);
    res.writeHead(200, { "content-type": MIME[extname(target)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""}`);
};

const ENLACE_OFICIAL = "https://asistencias-utch.vercel.app/";

await server.listen(PORT);
const browser = await chromium.launch(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`http://localhost:${PORT}/`);
await page.waitForSelector(".portal-card", { timeout: 8000 });
await page.waitForTimeout(300);

/* --- Textos oficiales: sin PROVISIONAL, enlace literal, marcador {codigo} --- */
const plantillas = await page.evaluate((ENLACE_OFICIAL) => ({
  doc: MENSAJES.docente,
  est: MENSAJES.estudiante,
  hasProvDoc: /PROVISIONAL/i.test(MENSAJES.docente),
  hasProvEst: /PROVISIONAL/i.test(MENSAJES.estudiante),
  linkDoc: MENSAJES.docente.includes(ENLACE_OFICIAL),
  linkEst: MENSAJES.estudiante.includes(ENLACE_OFICIAL),
  markerDoc: MENSAJES.docente.includes("{codigo}"),
  markerEst: MENSAJES.estudiante.includes("{codigo}"),
}), ENLACE_OFICIAL);
check("M1. MENSAJES.docente sin 'PROVISIONAL'", !plantillas.hasProvDoc, plantillas.doc.slice(0, 60));
check("M2. MENSAJES.estudiante sin 'PROVISIONAL'", !plantillas.hasProvEst, plantillas.est.slice(0, 60));
check("M3. Docente contiene enlace literal oficial", plantillas.linkDoc, ENLACE_OFICIAL);
check("M4. Estudiante contiene enlace literal oficial", plantillas.linkEst, ENLACE_OFICIAL);
check("M5. Plantillas usan variable única {codigo}", plantillas.markerDoc && plantillas.markerEst, { markerDoc: plantillas.markerDoc, markerEst: plantillas.markerEst });

/* --- construirMensaje: código insertado = código pasado (el que se muestra) --- */
const doc = await page.evaluate((ENLACE_OFICIAL) => {
  const mostrado = "ABC123";
  const msg = construirMensaje("docente", { codigo: mostrado });
  return { msg, mostrado, tiene: msg.includes(mostrado), link: msg.includes(ENLACE_OFICIAL), prov: /PROVISIONAL/i.test(msg) };
}, ENLACE_OFICIAL);
check("D1. Docente: código copiado igual al mostrado", doc.tiene && doc.mostrado === "ABC123", { mostrado: doc.mostrado, tiene: doc.tiene });
check("D2. Docente: sin 'PROVISIONAL' y con enlace literal", !doc.prov && doc.link, { prov: doc.prov, link: doc.link });

const stu = await page.evaluate((ENLACE_OFICIAL) => {
  const mostrado = "XYZ789";
  const msg = construirMensaje("estudiante", { codigo: mostrado });
  return { msg, mostrado, tiene: msg.includes(mostrado), link: msg.includes(ENLACE_OFICIAL), prov: /PROVISIONAL/i.test(msg) };
}, ENLACE_OFICIAL);
check("E1. Estudiante: código copiado igual al mostrado", stu.tiene && stu.mostrado === "XYZ789", { mostrado: stu.mostrado, tiene: stu.tiene });
check("E2. Estudiante: sin 'PROVISIONAL' y con enlace literal", !stu.prov && stu.link, { prov: stu.prov, link: stu.link });

/* --- reemplazo seguro y caracteres especiales --- */
const tricky = await page.evaluate(() => construirMensaje("estudiante", { codigo: "A$&B*C" }));
check("E3. Reemplazo seguro: $ y & literales", tricky.includes("A$&B*C"), tricky.slice(0, 120));
const tricky2 = await page.evaluate(() => construirMensaje("estudiante", { codigo: "¡Hola! 😀 ñ á é í ó ú" }));
check("E4. Tildes y emoji literales", tricky2.includes("¡Hola! 😀 ñ á é í ó ú"), tricky2.slice(0, 120));
const vacios = await page.evaluate(() => construirMensaje("estudiante", {}));
check("E5. Sin {codigo} pasado no aparece 'undefined'", !vacios.includes("undefined"), vacios.slice(0, 120));

/* --- copiarTextoAlPortapapeles con clipboard API stub --- */
const clip = await page.evaluate(async () => {
  window.__copied = null;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (t) => { window.__copied = t; } },
  });
  copiarTextoAlPortapapeles("hola ¿mundo?");
  await new Promise((r) => setTimeout(r, 200));
  return window.__copied;
});
check("C1. clipboard.writeText recibe el texto exacto", clip === "hola ¿mundo?", clip);

/* --- copiarTextoAlPortapapeles con execCommand fallback --- */
const fallback = await page.evaluate(async () => {
  window.__txt = null;
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: null });
  document.execCommand = () => {
    const t = document.querySelector("textarea");
    window.__txt = t ? t.value : null;
    return true;
  };
  copiarTextoAlPortapapeles("TEXTFAKE-123");
  await new Promise((r) => setTimeout(r, 200));
  return window.__txt;
});
check("C2. Respaldo execCommand captura el texto", fallback === "TEXTFAKE-123", fallback);

/* --- Wiring del panel del representante: código copiado = código mostrado --- */
const wiring = await page.evaluate(async (ENLACE_OFICIAL) => {
  const out = {};
  window.__copied = null;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (t) => { window.__copied = t; } },
  });
  S.sesion.clave = "CODETEST12";
  S.sesion.claveDocente = "DOCETEST34";
  copiarMsgEst();
  await new Promise((r) => setTimeout(r, 150));
  out.est = window.__copied;
  out.codigoMostrado = S.sesion.clave;
  window.__copied = null;
  copiarMsgDoc();
  await new Promise((r) => setTimeout(r, 150));
  out.doc = window.__copied;
  out.codigoMostradoDoc = S.sesion.claveDocente;
  out.enlace = ENLACE_OFICIAL;
  return out;
}, ENLACE_OFICIAL);
check("P1. copiarMsgEst: código copiado = mostrado, sin PROVISIONAL, enlace literal",
  !!wiring.est && wiring.est.includes(wiring.codigoMostrado) && wiring.est.includes(wiring.enlace) && !/PROVISIONAL/i.test(wiring.est),
  wiring.est ? { mostrado: wiring.codigoMostrado, len: wiring.est.length } : wiring);
check("P2. copiarMsgDoc: código copiado = mostrado, sin PROVISIONAL, enlace literal",
  !!wiring.doc && wiring.doc.includes(wiring.codigoMostradoDoc) && wiring.doc.includes(wiring.enlace) && !/PROVISIONAL/i.test(wiring.doc),
  wiring.doc ? { mostrado: wiring.codigoMostradoDoc, len: wiring.doc.length } : wiring);

await browser.close();
server.close();
const fallidos = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fallidos}/${results.length} comprobaciones correctas.`);
process.exit(fallidos ? 1 : 0);
