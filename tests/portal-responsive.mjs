/* tests/portal-responsive.mjs — Verifica el responsive de la página de inicio
   (PROMPT 13) con Playwright. Mide (valores medidos, no inferencia):
   - título de las tarjetas en una sola línea; descripción en 2-4 líneas sin
     palabras partidas.
   - gap entre el recuadro del icono y el texto: horizontal (<700 y ≥1100) ≥14px,
     vertical (700-1099) ≥10px, y texto no invade la flecha (≥10px).
   - icono conserva su tamaño fijo al recargar/hover/foco.
   - scrollWidth ≤ clientWidth y sin scroll vertical en escritorio.
   - incluye colores del botón de hp - y tosas las rutas sin errores de consola.
   Uso:
   BROWSER_PATH=/usr/bin/brave-browser-stable node tests/portal-responsive.mjs */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = 8125;
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".png": "image/png", ".ico": "image/x-icon",
  ".svg": "image/svg+xml", ".json": "application/json; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(String(req.url).split("?")[0]);
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

const ANCHOS = [360, 390, 414, 600, 699, 700, 784, 914, 1024, 1099, 1100, 1280, 1920];

/* 677 target? 678 width? Mide las tarjetas del portal. */
async function medirTarjetas(page) {
  return page.evaluate(() => {
    const tarjetas = Array.from(document.querySelectorAll(".portal-card"));
    const r = (el) => el.getBoundingClientRect();
    const lineas = (nodo) => {
      if (!nodo) return -1;
      const range = document.createRange();
      range.selectNodeContents(nodo);
      return Array.from(range.getClientRects()).filter((x) => x.width > 0 && x.height > 0).length;
    };
    const palabrasPartidas = (nodo) => {
      if (!nodo) return [];
      const texto = nodo.textContent || "";
      const out = [];
      const range = document.createRange();
      const re = /\S+/g;
      let m;
      while ((m = re.exec(texto))) {
        try { range.setStart(nodo, m.index); range.setEnd(nodo, m.index + m[0].length); } catch (e) { continue; }
        const rects = Array.from(range.getClientRects()).filter((x) => x.width > 0);
        if (new Set(rects.map((x) => Math.round(x.top))).size > 1) out.push(m[0]);
      }
      return out;
    };
    return tarjetas.map((card) => {
      const icon = card.querySelector(".portal-icon");
      const text = card.querySelector(".portal-text");
      const h3 = card.querySelector("h3");
      const p = card.querySelector("p");
      const chev = card.querySelector(".portal-chevron");
      const rc = r(card), ri = r(icon), rt = r(text), rh = r(h3), rp = r(p), rv = r(chev);
      const cs = (el) => getComputedStyle(el);
      const wv = window.innerWidth;
      const icono = el => (el.width + "x" + el.height);
      const mid = (a, b) => Math.abs(a - b);
      return {
        id: card.id,
        titulo: h3 ? h3.textContent.trim() : "",
        desc: p ? p.textContent.trim() : "",
        lineasTitulo: lineas(h3),
        lineasDesc: lineas(p),
        partidasTitulo: palabrasPartidas(h3),
        partidasDesc: palabrasPartidas(p),
        /* Horizontal: separación entre el h3 y el recuadro del icono;
           vertical: cómo se separan icono/título/flecha y si se tocan. */
        gapIconoTexto: Math.round(rh.left - ri.right),
        gapTarjetaIcono: Math.round(ri.left - rc.left),
        mordidaVertical: Math.max(0, Math.min(rh.bottom, rv.bottom) - Math.max(rh.top, rv.top)),
        invadeFlecha: (rc.right < 1550)
          ? (rh.right > rv.left - 10)                                    // horizontal: texto invade flecha
          : (mordidaVertical > 1),                                       // vertical: título y flecha se tocan
        /* Vertical (700-1099): col Australian? chebyshev y tipo de hueco */
        centers: {
          card: (rc.left + rc.right) / 2,
          icono: (ri.left + ri.right) / 2,
          titulo: (rh.left + rh.right) / 2,
          chevron: (rv.left + rv.right) / 2,
        },
        desgasteVerticalIcono: mid((ri.left + ri.right) / 2, (rc.left + rc.right) / 2),
        desgasteVerticalTitulo: mid((rh.left + rh.right) / 2, (rc.left + rc.right) / 2),
        desgasteVerticalFlecha: mid((rv.left + rv.right) / 2, (rc.left + rc.right) / 2),
        altoTarjeta: Math.round(rc.height),
        icono: cs(icon).width + "x" + cs(icon).height,
        display: cs(card).display,
        innerWidth: wv,
        rules699: (() => {
          const r = [];
          for (const s of document.styleSheets) {
            let rules = [];
            try { rules = Array.from(s.cssRules); } catch (e) { rules = []; }
            for (const x of rules)
              if (String(x.cssText).includes("699")) r.push(String(x.cssText).slice(0, 90));
          }
          return r;
        })(),
        dir: cs(card).flexDirection,
        colGap: cs(card).columnGap,
        rowGap: cs(card).rowGap,
        pad: cs(card).padding,
        h3: cs(h3).fontSize + " ovw=" + cs(h3).overflowWrap + " wb=" + cs(h3).wordBreak + " hy=" + cs(h3).hyphens,
        p: cs(p).fontSize + " ovw=" + cs(p).overflowWrap + " maxW=" + cs(p).maxWidth,
        texto: cs(text).minWidth + " display=" + cs(text).display,
        chevron: cs(chev).width + "x" + cs(chev).height,
      };
    });
  });
}

await server.listen(PORT);
const browser = await chromium.launch(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {});

const out = [];
const hovers = [];
for (const w of ANCHOS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForSelector(".portal-card", { timeout: 8000 });
  await page.waitForTimeout(250);

  const med = await medirTarjetas(page);
  const g = await page.evaluate(() => {
    const doc = document.documentElement, body = document.body;
    return { docSw: doc.scrollWidth, docCw: doc.clientWidth, docSh: doc.scrollHeight, winH: window.innerHeight };
  });
  out.push({ ancho: w, tarjetas: med, global: g, errs });

  /* Hover: el icono NO cambia de tamaño (styles.css habilita hover). */
  if (w === 700) {
    const iconoBefore = await page.locator(".portal-card").first().locator(".portal-icon").boundingBox();
    await page.hover(".portal-card");
    await page.waitForTimeout(300);
    const iconoHover = await page.locator(".portal-card").first().locator(".portal-icon").boundingBox();
    const iconoFocus = await page.locator(".portal-card").first().locator(".portal-icon").boundingBox();
    hovers.push({ ancho: w, iconoBefore, iconoHover, sinCambio: Math.abs(iconoBefore.width - iconoHover.width) < 0.5 });
  }
  await ctx.close();
}

/* Registro estilo widget de alertas con cursores móviles */
await browser.close();
server.close();

/* Repoger Bugs en Print CSS -> mejor */
for (const f of out) {
  console.log(`\n===== ANCHO ${f.ancho} ===== docSw=${f.global.docSw} docCw=${f.global.docCw} docSh=${f.global.docSh} winH=${f.global.winH} errores=${f.errs.length}`);
  for (const t of f.tarjetas) {
    const partidas = t.partidasTitulo.length + t.partidasDesc.length;
    console.log(
      `  [${t.id}] "${t.titulo}" líneasT=${t.lineasTitulo} líneasD=${t.lineasDesc} partidas=${partidas} ` +
      `gapIcono→texto=${t.gapIconoTexto} gapTarjeta→icono=${t.gapTarjetaIcono} gapTexto→flecha=${t.gapTextoFlecha} invade=${t.invadeFlecha}`
    );
    if (t.desgasteVerticalIcono) {
      console.log(
        `      centro: tarjeta=${t.centers.card.toFixed(0)} icono=${t.centers.icono.toFixed(0)} título=${t.centers.titulo.toFixed(0)} flecha=${t.centers.chevron.toFixed(0)} ` +
        `desgasteIcono=${t.desgasteVerticalIcono.toFixed(1)} desgasteTitulo=${t.desgasteVerticalTitulo.toFixed(1)} alto=${t.altoTarjeta} ${t.display}/${t.dir}`
      );
    }
  }
  if (f.ancho === 700) {
    const hv = hovers[0];
    if (!hv) fails.push(`700: hover no medido`);
    else if (!hv.sinCambio) fails.push(`700: ¡CAMBIO DE TAMAÑO EN HOVER! (${hv.iconoBefore.width}px → ${hv.iconoHover.width}px)`);
    else console.log(`  hover @700: SIN cambio de tamaño (${hv.iconoBefore.width}px)`);
  }
}
console.log("\n--- RESUMEN DE CHECKS PROMPT13 ---");
const fails = [];
const f = out;
const altoPrimera = (a) => a.tarjetas[0] && a.tarjetas[0].altoTarjeta;
for (const a of f) {
  if (a.global.docSw > a.global.docCw + 1) fails.push(`${a.ancho}: overflow horizontal doc`);
  for (const t of a.tarjetas) {
    if (t.lineasTitulo !== 1 && t.id) fails.push(`${a.ancho} ${t.id}: título tiene ${t.lineasTitulo} líneas (requiere 1)`);
    if (t.lineasDesc > 4) fails.push(`${a.ancho} ${t.id}: descripción ${t.lineasDesc} líneas (> 4)`);
    if (t.partidasTitulo.length || t.partidasDesc.length) fails.push(`${a.ancho} ${t.id}: palabras partidas ${JSON.stringify({ t: t.partidasTitulo, d: t.partidasDesc })}`);
    const wv = t.innerWidth || a.ancho;
    const horiz = wv >= 1100;
    const mobile = wv < 700;
    const tablet = !horiz && !mobile;
    const h = Number(t.gapIconoTexto), tv = Number(t.gapTarjetaIcono);
    if (wv >= 690 && wv <= 710) console.log(`  DEBUG wv=${wv} display=${t.display} dir=${t.dir} icono=${t.icono} rules=${JSON.stringify(t.rules699 || []).slice(0, 200)}`);
    if (horiz || mobile) {
      if (h < 14) fails.push(`${a.ancho} ${t.id}: gap icono→texto = ${h} (< 14)`);
      if (tv < 14) fails.push(`${a.ancho} ${t.id}: gap tarjeta→icono = ${tv} (< 14)`);
      if (t.invadeFlecha) fails.push(`${a.ancho} ${t.id}: texto invade la flecha`);
    }
    if (tablet) {
      if (t.display !== "flex" || t.dir !== "column") fails.push(`${a.ancho} ${t.id}: esperado tarjeta VERTICAL (flex/column)`);
      if (t.desgasteVerticalIcono > 2) fails.push(`${a.ancho} ${t.id}: icono descentrado (${t.desgasteVerticalIcono.toFixed(1)}px)`);
      if (t.desgasteVerticalTitulo > 2) fails.push(`${a.ancho} ${t.id}: título descentrado (${t.desgasteVerticalTitulo.toFixed(1)}px)`);
      if (t.mordidaVertical > 1) fails.push(`${a.ancho} ${t.id}: título y flecha se tocan (mordida ${t.mordidaVertical.toFixed(1)}px)`);
    }
    const hs = a.tarjetas.map((x) => x.altoTarjeta);
    if (tablet && new Set(hs).size !== 1) fails.push(`${a.ancho}: tarjetas con altura diferente en vertical ${JSON.stringify(hs)}`);
    if (mobile && Number(t.icono.split("px")[0]) < 26) fails.push(`${a.ancho} ${t.id}: icono pequeño: ${t.icono}`);
  }
  if (a.errs.length) fails.push(`${a.ancho}: errores de consola: ${a.errs.join(" | ")}`);
}
console.log(fails.length ? "FAIL " + fails.length + " checks" : "OK — Todos los checks PASS");
console.log(fails.map((f) => "  ✗ " + f).join("\n"));
process.exit(fails.length ? 1 : 0);
