"use strict";

/* ÚNICA implementación del guardado de "temas tratados" en la sesión.
   Lo usan el representante (cookie de la sesión) y el docente (teacherCode).
   Reglas: el último guardado gana; un valor vacío NO pisa un tema existente
   salvo que se pida el borrado explícitamente (borrar = true); se recorta a
   600 caracteres y se guarda como texto plano. */

const LIMITE_TEMAS = 600;

function normalizarTemas(valor) {
  if (typeof valor !== "string") return "";
  return valor.trim().slice(0, LIMITE_TEMAS);
}

/* Devuelve { fila, borrada, sinCambios }. fila = null si la sesión no existe. */
async function guardarTemas({ query, sessionId, topics, borrar }) {
  if (borrar === true) {
    const r = await query(
      "UPDATE attendance_runtime_sessions" +
        " SET topics = NULL, topics_updated_at = NOW()" +
        " WHERE id = $1 RETURNING id, topics_updated_at",
      [sessionId]
    );
    return { fila: r.rows[0] || null, borrada: true, sinCambios: false };
  }
  const texto = normalizarTemas(topics);
  if (!texto) {
    /* Vacío sin borrado explícito: no se toca nada. */
    return { fila: null, borrada: false, sinCambios: true };
  }
  const r = await query(
    "UPDATE attendance_runtime_sessions" +
      " SET topics = $1, topics_updated_at = NOW()" +
      " WHERE id = $2 RETURNING id, topics, topics_updated_at",
    [texto, sessionId]
  );
  return { fila: r.rows[0] || null, borrada: false, sinCambios: false };
}

module.exports = { LIMITE_TEMAS, normalizarTemas, guardarTemas };
