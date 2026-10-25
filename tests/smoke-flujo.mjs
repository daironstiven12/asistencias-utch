// tests/smoke-flujo.mjs
// Smoke test del flujo completo de asistencia (solo fetch, sin dependencias).
// Uso:
//   BASE_URL=http://localhost:8765 REP_USER=... REP_PASS=... node tests/smoke-flujo.mjs
// Variables opcionales: REP2_USER, REP2_PASS (para prueba de aislamiento entre representantes).
// Seguridad: se niega a correr si BASE_URL no es localhost/127.0.0.1
// salvo que se defina CONFIRMAR_BASE_DE_PRUEBA=1.

const BASE = (process.env.BASE_URL || '').replace(/\/$/, '');
if (!BASE) { console.error('FALLA: falta BASE_URL'); process.exit(1); }
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE);
if (!isLocal && process.env.CONFIRMAR_BASE_DE_PRUEBA !== '1') {
  console.error('FALLA: BASE_URL no es local. Define CONFIRMAR_BASE_DE_PRUEBA=1 para continuar (bajo tu responsabilidad).');
  process.exit(1);
}
const REP_USER = process.env.REP_USER;
const REP_PASS = process.env.REP_PASS;
if (!REP_USER || !REP_PASS) { console.error('FALLA: faltan REP_USER y REP_PASS'); process.exit(1); }

let cookie = '';
let ok = 0, fail = 0;
function log(label, status, detail) {
  console.log(`${status === 'OK' ? '✓' : '✗'} ${label}${detail ? ' — ' + detail : ''}`);
  if (status === 'OK') ok++; else fail++;
}
async function req(method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = r.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  let data = null;
  try { data = await r.json(); } catch (_) {}
  return { status: r.status, data };
}

// 1. Login representante
async function main() {
  console.log('=== SMOKE TEST FLUJO DE ASISTENCIA ===\n');
  const login = await req('POST', '/api/rep/login', { username: REP_USER, password: REP_PASS });
  if (login.status === 200 && login.data && login.data.ok) {
    log('1. Login representante', 'OK', login.data.representative?.name || '');
  } else {
    log('1. Login representante', 'FALLA', `HTTP ${login.status} ${login.data?.error || ''}`);
    process.exit(1);
  }

  // Obtener ofertas asignadas
  const offs = await req('GET', '/api/rep/offerings');
  if (!offs.data || !offs.data.ok || !Array.isArray(offs.data.offerings) || offs.data.offerings.length === 0) {
    log('2. Ofertas del representante', 'FALLA', 'sin ofertas asignadas');
    process.exit(1);
  }
  log('2. Ofertas del representante', 'OK', `${offs.data.offerings.length} oferta(s)`);
  const offeringId = offs.data.offerings[0].courseOfferingId;

  // 3. Crear asistencia
  const create = await req('POST', '/api/sessions', { courseOfferingId: offeringId });
  if (!create.data || !create.data.ok || !create.data.session) {
    log('3. Crear asistencia', 'FALLA', `HTTP ${create.status} ${create.data?.error || ''}`);
    process.exit(1);
  }
  const sessionId = create.data.session.id;
  const studentCode = create.data.session.studentCode;
  const teacherCode = create.data.session.teacherCode;
  log('3. Crear asistencia', 'OK', `id=${sessionId} codigo=${studentCode}`);

  // 4. Registrar 3 estudiantes
  const estudiantes = [
    { fullName: 'PRUEBA-REVISION Estudiante Uno', identification: '1000000001' },
    { fullName: 'PRUEBA-REVISION Estudiante Dos', identification: '1000000002' },
    { fullName: 'PRUEBA-REVISION Estudiante Tres', identification: '1000000003' },
  ];
  const firmaPequena = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  for (const est of estudiantes) {
    const r = await req('POST', '/api/records', { sessionId, studentCode, fullName: est.fullName, identification: est.identification, studentSignature: firmaPequena });
    if (r.status === 200 && r.data && r.data.ok) {
      log(`4. Registrar ${est.fullName}`, 'OK');
    } else {
      log(`4. Registrar ${est.fullName}`, 'FALLA', `HTTP ${r.status} ${r.data?.error || ''}`);
    }
  }

  // 5. Duplicado por identificación normalizada
  for (const variante of ['1.000.000.001', '1000000001', ' 1000000001 ']) {
    const r = await req('POST', '/api/records', { sessionId, studentCode, fullName: 'PRUEBA-REVISION Dup', identification: variante, studentSignature: firmaPequena });
    if (r.status === 409 && r.data && r.data.error === 'DUPLICATE_IDENTIFICATION') {
      log(`5. Duplicado "${variante}" → 409`, 'OK');
    } else if (r.status === 200) {
      log(`5. Duplicado "${variante}" → aceptado (falta aplicar SQL ident_norm)`, 'RIESGO');
    } else {
      log(`5. Duplicado "${variante}"`, 'FALLA', `HTTP ${r.status} ${r.data?.error || ''}`);
    }
  }

  // 6. Concurrencia: dos registros simultáneos con misma identificación
  const dupId = '9999999999';
  const [r1, r2] = await Promise.all([
    req('POST', '/api/records', { sessionId, studentCode, fullName: 'PRUEBA-REVISION Conc A', identification: dupId, studentSignature: firmaPequena }),
    req('POST', '/api/records', { sessionId, studentCode, fullName: 'PRUEBA-REVISION Conc B', identification: dupId, studentSignature: firmaPequena }),
  ]);
  const statuses = [r1.status, r2.status].sort();
  if (statuses.includes(200) && statuses.includes(409)) {
    log('6. Concurrencia misma identificación', 'OK', 'uno 200, uno 409');
  } else {
    log('6. Concurrencia misma identificación', 'RIESGO', `statuses=${statuses.join(',')}`);
  }

  // 7. Firmas docente y representante
  const sigDoc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const sigRep = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const saveSigs = await req('POST', '/api/sessions/signatures', { sessionId, teacherSignature: sigDoc, representativeSignature: sigRep });
  if (saveSigs.status === 200 && saveSigs.data && saveSigs.data.ok) {
    log('7. Guardar firmas docente+representante', 'OK');
  } else {
    log('7. Guardar firmas', 'FALLA', `HTTP ${saveSigs.status} ${saveSigs.data?.error || ''}`);
  }
  // Leer de nuevo
  const readSigs = await req('GET', '/api/rep/session?id=' + sessionId);
  if (readSigs.data && readSigs.data.ok && readSigs.data.session) {
    const s = readSigs.data.session;
    if (s.teacherSignature && s.representativeSignature) {
      log('7b. Leer firmas de nuevo', 'OK', 'ambas completas');
    } else {
      log('7b. Leer firmas de nuevo', 'FALLA', 'firmas incompletas');
    }
  } else {
    log('7b. Leer firmas de nuevo', 'RIESGO', 'no se pudo leer');
  }
  // Guardar con valor vacío no debe borrar
  const emptySave = await req('POST', '/api/sessions/signatures', { sessionId, teacherSignature: '', representativeSignature: '' });
  const readAfter = await req('GET', '/api/rep/session?id=' + sessionId);
  if (readAfter.data && readAfter.data.ok && readAfter.data.session && readAfter.data.session.teacherSignature) {
    log('7c. Valor vacío no borra firma', 'OK');
  } else {
    log('7c. Valor vacío no borra firma', 'RIESGO', 'posible borrado');
  }

  // 8. Cerrar asistencia
  const close = await req('POST', '/api/sessions/close', { sessionId, teacherSignature: '', representativeSignature: '' });
  if (close.status === 200 && close.data && close.data.ok) {
    log('8. Cerrar asistencia', 'OK');
  } else {
    log('8. Cerrar asistencia', 'FALLA', `HTTP ${close.status} ${close.data?.error || ''}`);
  }

  // 9. Reabrir (mismo id, estudiantes y firmas, código nuevo)
  const reopen = await req('POST', '/api/sessions/reopen', { sessionId });
  if (reopen.status === 200 && reopen.data && reopen.data.ok) {
    log('9. Reabrir asistencia', 'OK', `nuevo código: ${reopen.data.session?.studentCode || '?'}`);
    // Registrar 4º estudiante
    const r4 = await req('POST', '/api/records', { sessionId, studentCode: reopen.data.session.studentCode, fullName: 'PRUEBA-REVISION Estudiante Cuatro', identification: '1000000004', studentSignature: firmaPequena });
    if (r4.status === 200 && r4.data && r4.data.ok) {
      log('9b. Registrar 4º estudiante tras reabrir', 'OK');
    } else {
      log('9b. Registrar 4º estudiante tras reabrir', 'FALLA', `HTTP ${r4.status} ${r4.data?.error || ''}`);
    }
    // Código anterior debe fallar
    const oldCodeFail = await req('POST', '/api/records', { sessionId, studentCode: studentCode, fullName: 'PRUEBA-REVISION Old Code', identification: '1000000005', studentSignature: firmaPequena });
    if (oldCodeFail.status !== 200) {
      log('9c. Código anterior rechazado', 'OK');
    } else {
      log('9c. Código anterior rechazado', 'FALLA', 'aceptó código viejo');
    }
  } else {
    log('9. Reabrir asistencia', 'RIESGO', `HTTP ${reopen.status} ${reopen.data?.error || ''} (puede no existir endpoint reopen)`);
  }

  // 10. Historial del representante
  const hist = await req('GET', '/api/rep/sessions');
  if (hist.status === 200 && hist.data && hist.data.ok) {
    const found = (hist.data.sessions || []).some(s => s.id === sessionId || s.sessionId === sessionId);
    log('10. Historial lista la asistencia', found ? 'OK' : 'RIESGO', found ? '' : 'no encontrada en lista');
  } else {
    log('10. Historial', 'FALLA', `HTTP ${hist.status} ${hist.data?.error || ''}`);
  }

  // 11. Aislamiento: otro representante no accede
  const REP2_USER = process.env.REP2_USER;
  const REP2_PASS = process.env.REP2_PASS;
  if (REP2_USER && REP2_PASS) {
    const login2 = await req('POST', '/api/rep/login', { username: REP2_USER, password: REP2_PASS });
    if (login2.status === 200 && login2.data && login2.data.ok) {
      const access = await req('GET', '/api/rep/session?id=' + sessionId);
      if (access.status === 401 || access.status === 403 || access.status === 404) {
        log('11. Aislamiento entre representantes', 'OK', `rechazado con ${access.status}`);
      } else {
        log('11. Aislamiento entre representantes', 'FALLA', `acceso permitido (${access.status})`);
      }
    } else {
      log('11. Aislamiento', 'RIESGO', 'login REP2 falló');
    }
  } else {
    log('11. Aislamiento entre representantes', 'RIESGO', 'REP2_USER/REP2_PASS no definidos, omitido');
  }

  console.log(`\n=== RESULTADO: ${ok} OK, ${fail} FALLA ===`);
  console.log(`Asistencia de prueba creada: ${sessionId}`);
  console.log('Elimínala desde el Historial cuando termines la revisión.');
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Error inesperado:', e.message); process.exit(1); });