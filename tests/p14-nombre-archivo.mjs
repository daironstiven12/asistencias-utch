/* tests/p14-nombre-archivo.mjs — PROMPT 14 punto 2: nombre del archivo (unitarios).
   Función global de app.js (nombreArchivoAsist) + copia de admin.js.
   Uso: BROWSER_PATH=/usr/bin/brave-browser-stable node tests/p14-nombre-archivo.mjs */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = 8127;
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
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

const CASES = [
  [1, "FUNDAMENTOS DE REDES", "2026-1", "Asist_001_fundamentos_de_redes_2026-1"],
  [2, "ECUACIONES DIFERENCIALES", "2026-2", "Asist_002_ecuaciones_diferenciales_2026-2"],
  [3, "INGENIERÍA DE SOFTWARE I", "2026-2", "Asist_003_ingenieria_de_software_i_2026-2"],
  [1001, "A", "2026-1", "Asist_1001_a_2026-1"],
  [5, "Redes", "", "Asist_005_redes"],
  [1, "Ñoño-OPÁ", "2026-1", "Asist_001_nono_opa_2026-1"],
];

await server.listen(PORT);
const browser = await chromium.launch(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {});
const page = await browser.newPage();

await page.goto(`http://localhost:${PORT}/`);
await page.waitForSelector(".portal-card");
const appOut = await page.evaluate((cases) => {
  const out = cases.map(([num, mat, per, exp]) => ({
    args: [num, mat, per],
    got: nombreArchivoAsist(num, mat, per),
  }));
  out.push({ args: [1, "A" + "B".repeat(50), "2026-1"], got: nombreArchivoAsist(1, "A" + "B".repeat(50), "2026-1") });
  out.push({ args: [12, "Física Electromagnética", undefined], got: nombreArchivoAsist(12, "Física Electromagnética", undefined) });
  return out;
}, CASES);

await page.goto(`http://localhost:${PORT}/admin.html`);
await page.waitForSelector("#admEntrar");
const adminOut = await page.evaluate((cases) => {
  const out = cases.map(([num, mat, per, exp]) => ({
    args: [num, mat, per],
    got: nombreArchivoAsist(num, mat, per),
  }));
  return out;
}, CASES);

await browser.close();
server.close();

for (const t of appOut) {
  const expected = CASES.find((c) => c[1] === t.args[1] && c[2] === t.args[2] && c[0] === t.args[0])?.[3];
  if (!expected) continue;
  check(
    `nombreArchivoAsist(${t.args[0]}, "${t.args[1]}", "${t.args[2]}") === ${expected}`,
    t.got === expected,
    JSON.stringify({ got: t.got, expected })
  );
}
for (const t of adminOut) {
  const expected = CASES.find((c) => c[1] === t.args[1] && c[2] === t.args[2] && c[0] === t.args[0])?.[3];
  if (!expected) continue;
  check(
    `admin.js copia nombreArchivoAsist(${t.args[0]}, "${t.args[1]}", "${t.args[2]}") === ${expected}`,
    t.got === expected,
    JSON.stringify({ got: t.got, expected })
  );
}

const longCase = appOut.find((t) => t.args[1] === "A" + "B".repeat(50));
check("Materia >40: se corta a 40 sin guion bajo final: " + longCase.got,
  longCase.got === "Asist_001_a" + "b".repeat(39) + "_2026-1",
  JSON.stringify(longCase.got));
const fisica = appOut.find((t) => t.args[0] === 12);
check("Física Electromagnética → " + fisica.got, fisica.got === "Asist_012_fisica_electromagnetica", JSON.stringify(fisica.got));

const fallidos = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fallidos}/${results.length} comprobaciones correctas.`);
process.exit(fallidos ? 1 : 0);
