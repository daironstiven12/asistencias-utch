/* tests/contar-funciones.mjs — Verifica el límite de Serverless Functions de
   Vercel (plan Hobby: máx. 12 por despliegue).
   Regla: cuenta cada archivo .js dentro de api/ (incluidas rutas dinámicas
   como [id]/[action]). NO cuenta archivos cuyo nombre empieza por "_" ni nada
   fuera de api/ (p.ej. lib/). Falla si hay más de 12.
   Uso: node tests/contar-funciones.mjs */

import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const API = join(ROOT, "api");

function walk(dir) {
  let out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) out = out.concat(walk(full));
    else if (ent.isFile()) out.push(full);
  }
  return out;
}

const todasJs = walk(API).filter((f) => f.endsWith(".js"));
const funciones = todasJs.filter((f) => !f.split("/").pop().startsWith("_"));
const ignoradas = todasJs.filter((f) => f.split("/").pop().startsWith("_"));

funciones.sort();
ignoradas.sort();

console.log(`Funciones serverless contadas (api/**/*.js, sin "_*"): ${funciones.length}`);
for (const f of funciones) console.log("  - " + relative(ROOT, f));
console.log(`\nIgnoradas (empiezan por "_"): ${ignoradas.length}`);
for (const f of ignoradas) console.log("  - " + relative(ROOT, f));

const MAX = 12;
if (funciones.length > MAX) {
  console.error(`\nFALLA: ${funciones.length} funciones > ${MAX} (límite plan Hobby).`);
  process.exit(1);
}
console.log(`\nOK: ${funciones.length} <= ${MAX}.`);
process.exit(0);
