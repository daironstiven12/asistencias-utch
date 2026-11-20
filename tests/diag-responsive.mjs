/* tests/diag-responsive.mjs — Diagnóstico MEDIBLE del portal (PROMPT 13).
   Solo mide: no cambia nada. Uso:
   BROWSER_PATH=/usr/bin/brave-browser-stable node tests/diag-responsive.mjs
   Requiere: npm i --no-save playwright */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = 8126;
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg",
  ".ico": "image/x-icon", ".svg": "image/svg+xml",
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

const ANCHOS = [360, 381, 390, 414, 600, 699, 700, 784, 914, 1024, 1099, 1100, 1280, 1920];

const MEDIR = () => {
  const tarjetas = Array.from(document.querySelectorAll(".portal-card"));
  const rect = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
  const lineas = (nodo) => {
    if (!nodo) return -1;
    const range = document.createRange();
    range.selectNodeContents(nodo);
    return Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0).length;
  };
  const palabrasPartidas = (el) => {
    if (!el) return [];
    /* Los offsets de Range sobre un elemento cuentan hijos, no caracteres:
       se usa el nodo de texto cuando existe. */
    const nodo = el.firstChild && el.firstChild.nodeType === 3 ? el.firstChild : null;
    const texto = el.textContent || "";
    if (!nodo) return [];
    const out = [];
    const range = document.createRange();
    const re = /\S+/g;
    let m;
    while ((m = re.exec(texto))) {
      const i = m.index, len = m[0].length;
      try { range.setStart(nodo, i); range.setEnd(nodo, i + len); } catch (e) { continue; }
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0);
      if (new Set(rects.map((r) => Math.round(r.top))).size > 1) out.push(m[0]);
    }
    return out;
  };
  const computed = (el, props) => {
    const cs = getComputedStyle(el);
    const o = {};
    for (const p of props) o[p] = cs[p];
    return o;
  };

  return tarjetas.map((card) => {
    const icon = card.querySelector(".portal-icon");
    const text = card.querySelector(".portal-text");
    const h3 = card.querySelector("h3");
    const p = card.querySelector("p");
    const chev = card.querySelector(".portal-chevron");
    const rc = rect(card), ri = rect(icon), rt = rect(text), rh = rect(h3), rp = rect(p), rv = rect(chev);
    const csIcon = computed(icon, ["width", "height", "flexGrow", "flexShrink", "flexBasis"]);
    const csText = computed(text, ["minWidth", "overflowWrap", "wordBreak", "hyphens", "paddingLeft", "paddingRight"]);
    const csH3 = computed(h3, ["overflowWrap", "wordBreak", "hyphens", "fontSize"]);
    const csP = computed(p, ["overflowWrap", "wordBreak", "hyphens", "fontSize", "maxWidth"]);
    const csCard = computed(card, ["display", "gridTemplateColumns", "columnGap", "rowGap", "padding", "maxWidth", "flexDirection"]);
    return {
      id: card.id,
      titulo: h3 ? h3.textContent.trim() : "",
      desc: p ? p.textContent.trim() : "",
      lineasTitulo: lineas(h3),
      lineasDesc: lineas(p),
      partidasTitulo: palabrasPartidas(h3),
      partidasDesc: palabrasPartidas(p),
      gapIconoTexto: Math.round(rt.l - ri.r),
      gapTarjetaIcono: Math.round(ri.l - rc.l),
      gapTextoFlecha: Math.round(rv.l - rt.r),
      gapVerticalIconoTexto: Math.round(rt.t - ri.b),
      anchoTexto: Math.round(rt.w),
      anchoTarjeta: Math.round(rc.w),
      altoTarjeta: Math.round(rc.h),
      icono: csIcon,
      texto: csText,
      h3: csH3,
      p: csP,
      card: csCard,
      textoInvadeFlecha: rv.l < rt.r - 1,
    };
  });
};

const globalMed = () => ({
  docSw: document.documentElement.scrollWidth,
  docCw: document.documentElement.clientWidth,
  bodySw: document.body.scrollWidth,
  mainSw: document.querySelector("main") ? document.querySelector("main").scrollWidth : 0,
  mainCw: document.querySelector("main") ? document.querySelector("main").clientWidth : 0,
  winW: window.innerWidth,
  docSh: document.documentElement.scrollHeight,
  winH: window.innerHeight,
});

await server.listen(PORT);
const browser = await chromium.launch(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {});

const salida = [];
for (const w of ANCHOS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, representatives: [], offerings: [], docentes: [], catalogs: {} }) }));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForSelector(".portal-card", { timeout: 8000 });
  await page.waitForTimeout(250);
  const tarjetas = await page.evaluate(MEDIR);
  const g = await page.evaluate(globalMed);
  salida.push({ ancho: w, tarjetas, global: g, errs });
  await ctx.close();
}

/* Inicio sin scroll vertical en escritorios */
const verticales = [];
for (const [w, h] of [[1920, 950], [1366, 768], [1280, 720]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForSelector(".portal-card", { timeout: 8000 });
  await page.waitForTimeout(250);
  const g = await page.evaluate(globalMed);
  verticales.push({ ancho: w, alto: h, ...g, scrollVertical: g.docSh > g.winH + 1 });
  await ctx.close();
}

await browser.close();
server.close();

const fmt = (n) => Number(n).toFixed(1);
for (const f of salida) {
  console.log(`\n===== ANCHO ${f.ancho} =====  docSw=${f.global.docSw} docCw=${f.global.docCw} mainSw=${f.global.mainSw} mainCw=${f.global.mainCw} docSh=${f.global.docSh} winH=${f.global.winH} errores=${f.errs.length}`);
  for (const t of f.tarjetas) {
    console.log(`  [${t.id}] "${t.titulo}" líneasT=${t.lineasTitulo} partidasT=[${t.partidasTitulo}] líneasD=${t.lineasDesc} partidasD=[${t.partidasDesc}]`);
    console.log(`      tarjeta ${fmt(t.anchoTarjeta)}x${fmt(t.altoTarjeta)} | texto ${fmt(t.anchoTexto)} | gapTarjeta→icono=${t.gapTarjetaIcono} gapIcono→texto=${t.gapIconoTexto} gapTexto→flecha=${t.gapTextoFlecha} gapVertical=${t.gapVerticalIconoTexto} invade=${t.textoInvadeFlecha}`);
    console.log(`      icono=${t.icono.width}x${t.icono.height} flex=${t.icono.flexGrow}/${t.icono.flexShrink}/${t.icono.flexBasis} | card: ${t.card.display} cols=${t.card.gridTemplateColumns} colGap=${t.card.columnGap} rowGap=${t.card.rowGap} pad=${t.card.padding} maxW=${t.card.maxWidth} dir=${t.card.flexDirection}`);
    console.log(`      h3: ${t.h3.fontSize} ovw=${t.h3.overflowWrap} wb=${t.h3.wordBreak} hy=${t.h3.hyphens} | p: ${t.p.fontSize} ovw=${t.p.overflowWrap} wb=${t.p.wordBreak} hy=${t.p.hyphens} maxW=${t.p.maxWidth} | texto: ovw=${t.texto.overflowWrap} minW=${t.texto.minWidth}`);
  }
}
console.log("\n===== SCROLL VERTICAL EN ESCRITORIO =====");
for (const v of verticales) {
  console.log(`  ${v.ancho}x${v.alto}: docSh=${v.docSh} winH=${v.winH} scrollVertical=${v.scrollVertical}`);
}
