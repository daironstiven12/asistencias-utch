# Tests de humo — Flujo de asistencia

Archivo: `tests/smoke-flujo.mjs`

Ejecuta el flujo completo contra un servidor de desarrollo:
login de representante → crear asistencia → registrar estudiantes → firmas → cierre → reabrir → historial.

## Uso

```bash
BASE_URL=http://localhost:8765 REP_USER=tu_usuario REP_PASS=tu_clave node tests/smoke-flujo.mjs
```

Variables opcionales:
- `REP2_USER`, `REP2_PASS`: para probar aislamiento entre representantes.
- `CONFIRMAR_BASE_DE_PRUEBA=1`: permite ejecutar contra una base que no sea localhost (bajo tu responsabilidad).

## Seguridad

- Las credenciales se pasan por variables de entorno **en el momento de ejecutar**.
- Nunca se escriben en el archivo ni se leen de `.env`.
- El script se niega a correr si `BASE_URL` no es localhost/127.0.0.1 salvo que se defina `CONFIRMAR_BASE_DE_PRUEBA=1`.

## Notas

- Usa solo datos de prueba (registros rotulados "PRUEBA-REVISION").
- Al final imprime el id de la asistencia de prueba para que la elimines desde el Historial.
- No borra nada automáticamente.