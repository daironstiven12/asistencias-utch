"use strict";

/* Detección perezosa y cacheada de columnas/tablas OPCIONALES.
   Permite que las funciones nuevas queden OCULTAS (sin error) cuando el script
   sql/106_docente_temas_firmas.sql aún no se ha aplicado, igual que se hizo con
   ident_norm. Nunca lanza: si la consulta falla, asume que no existe. */

const cache = new Map();

async function columnaExiste(query, tabla, columna) {
  const clave = "col:" + tabla + "." + columna;
  if (cache.has(clave)) return cache.get(clave);
  let ok = false;
  try {
    const r = await query(
      "SELECT 1 FROM information_schema.columns" +
        " WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2 LIMIT 1",
      [tabla, columna]
    );
    ok = !!(r.rows[0]);
  } catch (e) {
    ok = false;
  }
  cache.set(clave, ok);
  return ok;
}

async function tablaExiste(query, nombre) {
  const clave = "tab:" + nombre;
  if (cache.has(clave)) return cache.get(clave);
  let ok = false;
  try {
    const r = await query("SELECT to_regclass($1) AS r", ["public." + nombre]);
    ok = !!(r.rows[0] && r.rows[0].r);
  } catch (e) {
    ok = false;
  }
  cache.set(clave, ok);
  return ok;
}

module.exports = { columnaExiste, tablaExiste };
