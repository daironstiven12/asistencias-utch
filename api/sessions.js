"use strict";

/* POST /api/sessions — crea una asistencia runtime.
   Responde { ok, session: { id, studentCode, teacherCode, status } }. */

const crypto = require("crypto");
const { query } = require("../lib/db");
const { generateSessionCodes } = require("../lib/codes");
const { currentRep } = require("../lib/repSession");

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
  const body = readBody(req);
  const courseOfferingId = body && body.courseOfferingId;
  if (typeof courseOfferingId !== "number" || !Number.isInteger(courseOfferingId) || courseOfferingId <= 0) {
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });
  }
  try {
    const offering = await query(
      "SELECT id FROM course_offerings WHERE id = $1 AND status = 'ACTIVE' LIMIT 1",
      [courseOfferingId]
    );
    if (!offering.rows[0]) {
      return res.status(400).json({ ok: false, error: "OFFERING_NOT_AVAILABLE" });
    }
    // Si hay representante autenticado, la oferta debe estarle asignada
    // y la sesión queda bajo su propiedad. Sin cookie, flujo heredado.
    let representativeId = null;
    try {
      const rep = await currentRep(req);
      if (rep) {
        const assigned = await query(
          "SELECT 1 FROM attendance_representative_offerings" +
            " WHERE representative_id = $1 AND course_offering_id = $2 LIMIT 1",
          [rep.id, courseOfferingId]
        );
        if (!assigned.rows[0]) {
          return res.status(403).json({ ok: false, error: "OFFERING_NOT_ASSIGNED" });
        }
        representativeId = rep.id;
      }
    } catch (err) {
      console.error("sessions owner error:", err && err.message);
      return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
    }
    let studentCode = null;
    let teacherCode = null;
    let id = null;
    let attempts = 0;
    // Reintenta ante colisión de códigos (constraint UNIQUE).
    for (;;) {
      attempts += 1;
      id = crypto.randomUUID();
      const codes = generateSessionCodes();
      studentCode = codes.studentCode;
      teacherCode = codes.teacherCode;
      try {
        await query(
          "INSERT INTO attendance_runtime_sessions (id, student_code, teacher_code, status, course_offering_id, representative_id)" +
            " VALUES ($1, $2, $3, 'OPEN', $4, $5)",
          [id, studentCode, teacherCode, courseOfferingId, representativeId]
        );
        break;
      } catch (err) {
        if (err && err.code === "23505" && attempts < 4) continue;
        throw err;
      }
    }
    return res.status(201).json({
      ok: true,
      session: { id, studentCode, teacherCode, status: "OPEN" },
    });
  } catch (err) {
    console.error("sessions create error:", err && err.message);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
};
