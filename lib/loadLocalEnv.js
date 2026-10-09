"use strict";

/* Solo desarrollo local: completa process.env desde .env.local
   (ignorado por Git) cuando la variable no existe.
   En producción el archivo no existe y no hace nada. */

const fs = require("fs");
const path = require("path");

let loaded = false;

function loadLocalEnv() {
  if (loaded) return;
  loaded = true;
  try {
    const file = path.join(__dirname, "..", ".env.local");
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!(m[1] in process.env)) process.env[m[1]] = v;
    }
  } catch (e) {
    /* sin .env.local: el entorno manda */
  }
}

loadLocalEnv();

module.exports = { loadLocalEnv };
