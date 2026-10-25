"use strict";

/* POST /api/sessions/reopen — reabre la MISMA asistencia (mismo id).
   Solo el representante autenticado propietario de la sesión.
   - No crea registros nuevos ni toca estudiantes/firmas/encabezado.
   - Genera un código de estudiante nuevo para esa misma sesión e invalida
     el anterior (el código docente se conserva para que el docente firme).
   - Si el representante ya tiene otra asistencia abierta, no la cierra en
     silencio: responde 409 REP_HAS_OPEN_SESSION. El cliente debe confirmar
     y repetir con force=true para cerrarla y reabrir la elegida. */

const { getPool } = require("../../lib/db");
const { requireRep } = require("../../lib/repSession");
const { generateCode } = require("../../lib/codes");

function readBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return undefined;
    }
  }
  return body && typeof body === "object" ? body : undefined;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  const rep = await requireRep(req, res);
  if (!rep) return;

  const body = readBody(req);
  const sessionId =
    body && typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const force = !!(body && body.force === true);
  if (!sessionId) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const t = await client.query(
      "SELECT id, status, student_code, teacher_code" +
        " FROM attendance_runtime_sessions" +
        " WHERE id = $1 AND representative_id = $2 LIMIT 1 FOR UPDATE",
      [sessionId, rep.id]
    );
    const target = t.rows[0];
    if (!target) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "SESSION_NOT_FOUND" });
    }

    /* Ya está abierta: idempotente, no se toca nada. */
    if (target.status === "OPEN") {
      await client.query("COMMIT");
      return res.status(200).json({
        ok: true,
        reopened: false,
        session: {
          id: target.id,
          status: "OPEN",
          registrationOpen: true,
          studentCode: target.student_code,
          teacherCode: target.teacher_code,
        },
      });
    }

    /* Otra asistencia abierta del mismo representante. */
    const other = await client.query(
      "SELECT id, student_code FROM attendance_runtime_sessions" +
        " WHERE representative_id = $1 AND status = 'OPEN' AND id <> $2" +
        " ORDER BY id LIMIT 1 FOR UPDATE",
      [rep.id, sessionId]
    );
    if (other.rows.length && !force) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        ok: false,
        error: "REP_HAS_OPEN_SESSION",
        openSession: {
          id: other.rows[0].id,
          studentCode: other.rows[0].student_code,
        },
      });
    }

    /* Con confirmación explícita: se cierra la otra conservando sus datos. */
    let closedSessionId = null;
    if (other.rows.length) {
      const c = await client.query(
        "UPDATE attendance_runtime_sessions SET status = 'CLOSED'," +
          " registration_open = FALSE," +
          " closed_at = NOW(), purge_at = NOW() + INTERVAL '24 hours'" +
          " WHERE representative_id = $1 AND status = 'OPEN' AND id <> $2" +
          " RETURNING id",
        [rep.id, sessionId]
      );
      closedSessionId = c.rows[0] ? c.rows[0].id : null;
    }

    /* Reapertura sobre el mismo registro, con código de estudiante nuevo. */
    let updated = null;
    let attempts = 0;
    for (;;) {
      attempts += 1;
      const newCode = generateCode();
      /* SAVEPOINT: un choque de código UNIQUE no debe abortar la transacción. */
      await client.query("SAVEPOINT code_try");
      try {
        const u = await client.query(
          "UPDATE attendance_runtime_sessions SET status = 'OPEN'," +
            " registration_open = TRUE," +
            " closed_at = NULL, purge_at = NULL, student_code = $3" +
            " WHERE id = $1 AND representative_id = $2 AND status = 'CLOSED'" +
            " RETURNING id, status, registration_open, student_code, teacher_code",
          [sessionId, rep.id, newCode]
        );
        updated = u.rows[0];
        await client.query("RELEASE SAVEPOINT code_try");
        break;
      } catch (err) {
        if (err && err.code === "23505" && attempts < 5) {
          await client.query("ROLLBACK TO SAVEPOINT code_try");
          continue;
        }
        throw err;
      }
    }

    if (!updated) {
      await client.query("ROLLBACK");
      return res.status(409).json({ ok: false, error: "SESSION_STATE_CHANGED" });
    }

    await client.query("COMMIT");
    return res.status(200).json({
      ok: true,
      reopened: true,
      closedSessionId,
      session: {
        id: updated.id,
        status: updated.status,
        registrationOpen: updated.registration_open,
        studentCode: updated.student_code,
        teacherCode: updated.teacher_code,
      },
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (e) {}
    console.error("sessions reopen error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  } finally {
    client.release();
  }
};
