"use strict";

/* ÚNICA implementación de la escritura de la firma del docente en la sesión.
   La usan /api/sessions/teacher-signature (firma manual por clase) y
   /api/sessions/teacher-saved-signature (aplicar la firma guardada). */

const MAX_SIGNATURE = 1000000;
const SIGNATURE_RE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;

/* Devuelve la firma normalizada o '' si no es válida. */
function validarFirma(valor) {
  if (typeof valor !== "string") return "";
  const v = valor.trim();
  if (!v || v.length > MAX_SIGNATURE) return "";
  if (!SIGNATURE_RE.test(v)) return "";
  return v;
}

/* Escribe teacher_signature / teacher_signed_at en una sesión OPEN. */
async function aplicarFirmaSesion({ query, sessionId, signature }) {
  const r = await query(
    "UPDATE attendance_runtime_sessions SET teacher_signature = $1, teacher_signed_at = NOW()" +
      " WHERE id = $2 AND status = 'OPEN'" +
      " RETURNING id, status, teacher_signed_at",
    [signature, sessionId]
  );
  return r.rows[0] || null;
}

module.exports = { MAX_SIGNATURE, SIGNATURE_RE, validarFirma, aplicarFirmaSesion };
