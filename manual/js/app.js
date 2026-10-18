/* Manual de usuario v1.0 — Plataforma de Asistencia Académica.
   Contenido basado en las funciones reales verificadas en la plataforma.
   Sin dependencias externas. */
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CHAPTERS = [
{ id: "indice", num: "", title: "Índice general", desc: "Mapa del manual",
  html: `<div class="toc"><h3>Contenido de la Versión 1.0</h3><ol id="tocList"></ol></div>
  <p>Utilice el menú lateral para navegar por capítulos, el buscador para localizar un tema, o los botones <b>Anterior</b> y <b>Siguiente</b> al final de cada capítulo.</p>
  <div class="msg"><span class="lbl">Versión 1.0</span><b>Primera versión del manual.</b>El contenido podrá actualizarse conforme evolucionen las funcionalidades de la plataforma.</div>` },

{ id: "introduccion", num: "Capítulo 1", title: "Introducción a la plataforma", desc: "Qué es y qué permite hacer",
  html: `<h3>Qué es</h3>
  <p>La <b>Plataforma de Asistencia Académica</b> es una aplicación web para registrar, consultar y respaldar la asistencia a clases. Funciona en el navegador de celulares, tabletas y computadores, sin instalar programas adicionales.</p>
  <h3>Qué operaciones permite actualmente</h3>
  <ul>
    <li>Abrir sesiones de asistencia por asignatura con un límite de tiempo opcional.</li>
    <li>Generar códigos de acceso para estudiantes y para el docente firmante.</li>
    <li>Registrar estudiantes con nombre, identificación y firma.</li>
    <li>Consultar la lista de asistencia en tiempo real durante la clase.</li>
    <li>Bloquear nuevos registros sin cerrar la sesión.</li>
    <li>Firmar como docente y como representante, y cerrar la asistencia.</li>
    <li>Generar el documento de asistencia para imprimir o guardar como PDF, además de respaldo en CSV y JSON.</li>
    <li>Administrar representantes, docentes y ofertas académicas (perfil administrativo).</li>
  </ul>
  <h3>Perfiles de usuario</h3>
  <div class="stepcards">
    <div class="stepcard"><div class="n">R</div><p><b>Representante.</b> Gestiona el registro: selecciona la asignatura, abre la sesión, comparte el código, consulta la lista, bloquea o cierra, y exporta el formato.</p></div>
    <div class="stepcard"><div class="n">D</div><p><b>Docente.</b> Ingresa con su código, consulta la lista de su clase y registra su firma.</p></div>
    <div class="stepcard"><div class="n">E</div><p><b>Estudiante.</b> Ingresa la clave, escribe sus datos, firma y envía su asistencia una sola vez por clase.</p></div>
  </div>
  <h3>Qué necesita cada usuario antes de comenzar</h3>
  <ul>
    <li>Un navegador moderno actualizado con conexión a internet.</li>
    <li>El representante: su usuario y contraseña, y saber qué asignatura le corresponde.</li>
    <li>El docente: el código de docente que le entregue el representante.</li>
    <li>El estudiante: la clave de acceso que el representante dicte o proyecte en clase.</li>
  </ul>` },

{ id: "acceso-representante", num: "Capítulo 2", title: "Acceso de representantes", desc: "Ingreso paso a paso y errores",
  html: `<div class="proc">
  <h4>Objetivo</h4><p>Entrar a su panel personal con sus credenciales asignadas.</p>
  <h4>Antes de comenzar</h4><p>Tenga a la mano su <b>usuario</b> y su <b>contraseña</b> de representante. No son el código de la clase.</p>
  <h4>Pasos</h4>
  <ol class="steps">
    <li>En la pantalla inicial pulse <b>Representante</b> y luego <b>Gestionar el registro y exportar el formato oficial</b>.</li>
    <li>Escriba su <b>usuario</b> en el campo <code class="k">Usuario del representante</code>.</li>
    <li>Escriba su <b>contraseña</b> en el campo <code class="k">Contraseña</code>.</li>
    <li>Pulse el botón <b>Entrar</b> (también funciona la tecla <code class="k">Enter</code>).</li>
  </ol>
  <h4>Qué debe observar</h4><p>Verá brevemente <i>Verificando…</i> y después su panel con la tarjeta <b>Materia</b>. Eso confirma que entró correctamente.</p>
  <h4>Resultado esperado</h4><p>Acceso a su panel con sus asignaturas asignadas. Su sesión queda guardada en esa pestaña del navegador.</p>
  <h4>Si algo falla</h4></div>
  <div class="msg err"><span class="lbl">Credenciales incorrectas</span><b>Usuario o contraseña incorrectos.</b>Revise mayúsculas y espacios; el sistema indica el intento actual (por ejemplo <i>Intento 2 de 5</i>).</div>
  <h4>Bloqueo por intentos fallidos</h4>
  <p><b>Objetivo:</b> esperar a que termine un bloqueo temporal. Tras <b>5 intentos fallidos</b>, verá <i>Bloqueado. Espere N s.</i> y el acceso se bloquea <b>5 minutos</b>. <b>Resultado esperado:</b> al terminar el conteo puede intentarlo de nuevo; no necesita reinstalar ni borrar nada.</p>
  <h4>Cierre de sesión</h4>
  <p><b>Objetivo:</b> salir de su cuenta. <b>Pasos:</b> pulse <b>Cerrar sesión</b> en la parte superior del panel. <b>Resultado esperado:</b> vuelve a la pantalla inicial. <b>Cierre siempre la sesión en equipos compartidos.</b></p>
  <h4>Sus credenciales no son un código de asistencia</h4>
  <p>Su <b>usuario y contraseña</b> identifican su cuenta de representante: sirven para entrar a su panel, ver sus asignaturas y gestionar sus sesiones. <b>Nunca las comparta con los estudiantes.</b> Lo que los estudiantes necesitan es otra cosa distinta: el <b>código de acceso de la sesión</b>, una clave corta y temporal que la plataforma genera al abrir cada asistencia (ver Capítulo 5). Si un estudiante intenta entrar con su usuario y contraseña, no podrá registrarse.</p>
  <div class="msg err"><span class="lbl">Si rechazan su acceso</span>Verifique que escribe su usuario exacto y su contraseña actual. Si olvidó su contraseña, solicite al administrador que la restablezca: no existe recuperación automática en pantalla.</div>` },

{ id: "panel-representante", num: "Capítulo 3", title: "Panel del representante", desc: "Asignaturas y datos académicos",
  html: `<div class="proc">
  <h4>Objetivo</h4><p>Elegir la asignatura correcta para la clase que va a registrar, con sus datos académicos ya diligenciados.</p>
  <h4>Antes de comenzar</h4><p>Haber iniciado sesión. Saber qué materia dictará en esa clase.</p>
  <h4>Pasos</h4>
  <ol class="steps">
    <li>Ubique la tarjeta <b>Materia</b> y el desplegable <code class="k">Seleccionar materia guardada</code>: muestra <b>únicamente</b> las asignaturas asignadas a su usuario, con nombre, código y horas semanales.</li>
    <li>Elija la asignatura de la clase. Los campos se completan solos: facultad, programa, nivel, asignatura, código, período académico, nombre del docente, correo y horas.</li>
    <li>Si necesita registrar otra clase distinta, pulse <code class="k">Nueva materia</code>; para conservar cambios en la actual, pulse <code class="k">Guardar materia</code> (o <code class="k">Actualizar materia</code>).</li>
  </ol>
  <h4>Qué debe observar</h4><p>El mensaje bajo el selector confirma la materia cargada (<i>Materia cargada. Para esta asistencia, indique la fecha y la hora de inicio…</i>). Elegir otra materia con registros sin exportar pide confirmación antes de borrar la lista actual.</p>
  <h4>Resultado esperado</h4><p>Datos académicos correctos visibles; la hoja de asistencia mostrará esa asignatura.</p>
  <h4>Si algo falla</h4></div>
  <div class="msg warn"><span class="lbl">Si una asignatura no aparece</span>El catálogo depende de sus asignaciones. Si falta una materia o ve una que no le corresponde, <b>no la edite</b>: solicite al administrador que revise sus ofertas asignadas.</div>
  <div class="msg"><span class="lbl">Zona de riesgo</span>El botón <b>Borrar registros locales</b> elimina materias, firmas y asistencias guardadas en ese dispositivo (pide confirmación y la palabra BORRAR). Úselo solo después de exportar.</div>` },

{ id: "apertura-sesion", num: "Capítulo 4", title: "Apertura de una sesión de asistencia", desc: "Ventana de asistencia y estados",
  html: `<div class="proc">
  <h4>Objetivo</h4><p>Iniciar la ventana durante la cual los estudiantes pueden firmar, con un límite de tiempo controlado.</p>
  <h4>Antes de comenzar</h4><p>Asignatura seleccionada y datos verificados (Capítulo 3).</p>
  <h4>Pasos</h4>
  <ol class="steps">
    <li>En la tarjeta <b>Ventana de asistencia</b> elija la <b>Duración</b>: <code class="k">Sin límite (hasta detener)</code>, 5, 10, 15, 20, 30 o 45 minutos. Propósito: la ventana se cierra sola al agotarse el tiempo; con <i>Sin límite</i> usted la cierra manualmente.</li>
    <li>Pulse <b>Abrir registro</b>. Consecuencia inmediata: se generan las dos claves y comienza la recepción.</li>
    <li>Anote las dos claves de solo lectura: <b>Clave de acceso para estudiantes</b> (botón <b>Copiar</b>) y <b>Clave de acceso para docente (firma)</b>. La primera se comparte con la clase; la segunda solo con el docente.</li>
    <li>Observe que aparecen <b>Reiniciar</b> (reinicia el conteo) y <b>Cerrar</b> (termina; ver Capítulo 9).</li>
  </ol>
  <h4>Qué debe observar</h4><p>La insignia de estado y el aviso <i>Registro abierto. Los estudiantes pueden conectarse desde cualquier dispositivo con el código <b>XXXXXX</b>.</i></p>
  <h4>Resultado esperado</h4><p>Sesión abierta con códigos vigentes, lista para recibir firmas.</p>
  <h4>Si algo falla</h4><p>Si no aparece el código, verifique su conexión e inténtelo de nuevo; sin código generado no hay clase que compartir.</p></div>
  <h3>Estados de la sesión</h3>
  <ul>
    <li><b>El registro está cerrado.</b> Nadie puede firmar. Abra la asistencia para comenzar.</li>
    <li><b>Registro abierto · sin límite de tiempo.</b> Acepta firmas hasta que pulse Cerrar.</li>
    <li><b>Registro abierto · quedan M:SS.</b> Cuenta regresiva según la duración elegida.</li>
    <li><b>El tiempo de registro terminó.</b> Se alcanzó el límite; debe reabrir o cerrar.</li>
  </ul>` },

{ id: "codigo-acceso", num: "Capítulo 5", title: "Código de acceso para estudiantes", desc: "Qué es, cómo funciona y errores",
  html: `<h3>Qué es este código</h3>
  <p>Es una <b>clave temporal de 6 letras y números en mayúsculas</b> (por ejemplo <code class="k">7KQ2MZ</code>) que identifica una sesión de asistencia abierta. La plataforma la genera automáticamente con valores aleatorios cada vez que el representante abre una sesión, junto con un código distinto para el docente. Las letras y números se eligen evitando caracteres que se confunden (como el cero con la letra O, o el uno con la letra I).</p>
  <div class="msg"><span class="lbl">Cómo funciona, paso a paso</span><b>Orden real del sistema:</b><br>1. El representante selecciona la asignatura y pulsa <b>Abrir registro</b>.<br>2. La plataforma crea la sesión y genera sus dos códigos.<br>3. El representante comparte <b>solo el código de estudiante</b> con la clase (voz alta, tablero o botón <b>Copiar</b>).<br>4. Cada estudiante abre <b>Estudiante → Firmar la asistencia a la clase</b>.<br>5. Escribe la clave y pulsa <b>Validar</b> (verá <i>Conectando…</i>).<br>6. El servidor comprueba que el código exista, que la sesión siga abierta y que sea código de estudiante; si todo está bien, muestra los datos de la clase.<br>7. El estudiante completa nombre, identificación y firma, y pulsa <b>Enviar asistencia</b>.<br>8. Solo el mensaje <b>Asistencia registrada correctamente</b> confirma el guardado.</div>
  <h3>Qué comprueba el servidor</h3>
  <ul>
    <li><b>Código válido y sesión abierta</b> → acepta y devuelve los datos académicos de esa clase.</li>
    <li><b>Código desconocido o sesión cerrada</b> → <i>El código no es válido o la sesión ya no está disponible.</i></li>
    <li><b>Código de docente en el formulario de estudiante</b> → <i>Este código no es de estudiante. Solicite el código de estudiante al docente.</i></li>
    <li><b>Misma identificación dos veces</b> → el registro se rechaza: cada estudiante firma una sola vez por clase.</li>
    <li><b>Recepción bloqueada o sesión cerrada a mitad del proceso</b> → mensajes de <i>ya no permite nuevos registros</i> o <i>ya no está disponible; solicite un nuevo código</i>.</li>
  </ul>
  <h3>Qué debe hacer el estudiante si no puede continuar</h3>
  <ol class="steps">
    <li>Revise que copió el código completo, sin espacios ni letras minúsculas cambiadas.</li>
    <li>Confirme con el representante que la sesión sigue abierta y que ese es el código vigente (cada reapertura genera códigos nuevos).</li>
    <li>Si perdió la conexión antes de ver la confirmación, vuelva a intentarlo: sin <b>Asistencia registrada correctamente</b> no hay registro.</li>
  </ol>
  <h3>No confundir los identificadores</h3>
  <ul>
    <li><b>Usuario y contraseña del representante:</b> cuenta permanente para gestionar; nunca se dictan en clase.</li>
    <li><b>Código de estudiante:</b> clave temporal de la sesión; es lo único que necesita el alumno.</li>
    <li><b>Código del docente:</b> clave temporal distinta, solo para consulta y firma del docente (ver Capítulo 14).</li>
    <li><b>Identificador interno de sesión:</b> un código técnico largo que el sistema envía solo en sus comunicaciones internas; ningún usuario debe escribirlo ni compartirlo.</li>
  </ul>
  <div class="proc">
  <h4>Procedimiento del representante: compartir con los estudiantes</h4>
  <p><b>Objetivo:</b> que toda la clase pueda firmar sin exponer credenciales. <b>Antes de comenzar:</b> sesión abierta con el código visible.</p>
  <ol class="steps">
    <li>Comunique <b>únicamente el código de estudiantes</b>: díctelo, escríbalo en el tablero o use <b>Copiar</b> para pegarlo en el chat del curso.</li>
    <li>Indíqueles que entren a <b>Estudiante → Firmar la asistencia a la clase</b>, escriban la clave y pulsen <b>Validar</b>.</li>
    <li>Si alguien no puede ingresar: verifique que dictó el código vigente (cada reapertura genera códigos nuevos), que la sesión sigue abierta y que el estudiante tiene conexión.</li>
  </ol>
  <p><b>Resultado esperado:</b> los estudiantes ven los datos de la clase y pueden firmar. <b>Consecuencia de compartir el código equivocado:</b> con la clave de docente verán un error que les pide el código de estudiante.</p></div>` },

{ id: "registro-estudiante", num: "Capítulo 6", title: "Registro del estudiante", desc: "Firma y envío paso a paso",
  html: `<h3>Paso a paso</h3>
  <ol class="steps">
    <li>En la pantalla inicial pulse <b>Estudiante</b> y luego <b>Firmar la asistencia a la clase</b>.</li>
    <li>Escriba la clave en <code class="k">Clave de acceso entregada por el docente</code> (ejemplo: <code class="k">7KQ2MZ</code>) y pulse <b>Validar</b>.</li>
    <li>Complete <b>Nombres y apellidos completos</b> (mínimo 5 letras).</li>
    <li>Escriba el <b>Número de identificación</b> (de 5 a 20 caracteres: letras, números o guiones).</li>
    <li>Firme en el recuadro: puede <b>Dibujar</b> con el dedo o mouse, <b>Subir imagen</b> (PNG o JPG) o <b>Escribir</b> su nombre; use <b>Borrar</b> para repetir.</li>
    <li>Pulse <b>Enviar asistencia</b> y espere <i>Enviando…</i> sin cerrar la página.</li>
    <li>Confirmación: <b>Asistencia registrada correctamente.</b> El registro es único: no podrá firmar otra vez en esa clase.</li>
  </ol>
  <div class="msg err"><span class="lbl">Mensajes frecuentes</span><b>Esa identificación ya tiene una asistencia registrada en esta clase</b> (ya firmó) · <b>Esta asistencia ya no permite nuevos registros</b> (recepción bloqueada) · <b>La asistencia ya no está disponible. Solicite un nuevo código</b> (sesión cerrada) · <b>No se pudo conectar con el servidor</b> (revise internet y use Reintentar).</div>
  <div class="msg warn"><span class="lbl">Importante</span>Solo el mensaje <b>Asistencia registrada correctamente</b> confirma que el servidor guardó su firma. Si pierde la conexión antes de verlo, vuelva a intentarlo.</div>` },

{ id: "consulta-asistencia", num: "Capítulo 7", title: "Consulta de la asistencia", desc: "Lista en tiempo real",
  html: `<div class="proc">
  <h4>Objetivo</h4><p>Vigilar quiénes van firmando y tener la lista completa y actualizada.</p>
  <h4>Antes de comenzar</h4><p>Sesión abierta (o recién cerrada, dentro de su vigencia de consulta).</p>
  <h4>Pasos</h4>
  <ol class="steps">
    <li>En su panel abra la tarjeta <b>Mis asistencias</b>: muestra las sesiones que usted ha creado.</li>
    <li>Pulse <b>Ver asistencias</b> para cargarlas y pulse <b>Abrir</b> junto a la sesión que quiere revisar.</li>
    <li>La lista muestra nombre, identificación y firma de cada estudiante y <b>se actualiza sola cada pocos segundos</b>; cada fila confirma nombre + identificación.</li>
  </ol>
  <h4>Qué debe observar</h4><p>Que cada registro nuevo aparezca en la lista sin recargar la página. Si pasan varios segundos sin cambios, pulse <b>Ver asistencias</b> de nuevo.</p>
  <h4>Resultado esperado</h4><p>Lista completa y al día de la sesión seleccionada.</p>
  <h4>Si un estudiante afirma haberse registrado y no aparece</h4></div>
  <ol class="steps">
    <li>Confirme que está consultando la <b>sesión correcta</b> (cada apertura genera códigos nuevos; otra sesión no mostrará ese registro).</li>
    <li>Pídale que muestre su pantalla: solo vale <b>Asistencia registrada correctamente</b>. Sin ese mensaje (por ejemplo, con error de conexión), no quedó registrado.</li>
    <li>Si vio el mensaje pero no aparece: verifique que firmó en <b>esta</b> sesión y no en una anterior ya cerrada; de ser así, debe firmar de nuevo con el código vigente.</li>
    <li>Espere la actualización automática o pulse <b>Ver asistencias</b> otra vez.</li>
  </ol>` },

{ id: "bloqueo-registros", num: "Capítulo 8", title: "Bloqueo de nuevos registros", desc: "Pausar la recepción sin cerrar",
  html: `<div class="proc">
  <h4>Objetivo</h4><p>Detener la llegada de firmas nuevas sin terminar la asistencia (por ejemplo, al finalizar el llamado a lista).</p>
  <h4>Antes de comenzar</h4><p>Sesión abierta con los registros esperados ya visibles.</p>
  <h4>Pasos</h4>
  <ol class="steps">
    <li>Pulse <b>No permitir más registros</b>. El botón mostrará <i>Registros cerrados</i> y el estado <i>Registros cerrados.</i></li>
    <li>Compruebe el efecto: los estudiantes que ya firmaron permanecen; los nuevos ven que ya no se permiten registros; el docente todavía puede consultar y firmar.</li>
  </ol>
  <h4>Resultado esperado</h4><p>Recepción pausada con la sesión aún abierta y gestionable.</p>
  <h4>Si algo falla</h4><p>Si el botón no responde, verifique su conexión: el bloqueo debe confirmarse en el servidor para ser efectivo.</p></div>
  <div class="msg warn"><span class="lbl">No confundir</span><b>Bloquear registros ≠ cerrar la sesión.</b> Bloquear solo pausa nuevas firmas y la sesión sigue abierta; <b>Cerrar</b> termina definitivamente la asistencia (ver Capítulo 9).</div>` },

{ id: "firmas-cierre", num: "Capítulo 9", title: "Firmas y cierre", desc: "Quién firma qué y consecuencias",
  html: `<h3>Las tres firmas</h3>
  <ul>
    <li><b>Estudiante:</b> obligatoria para registrarse; queda guardada en el servidor junto a su nombre e identificación.</li>
    <li><b>Docente:</b> en su vista, dibuja o sube su firma y pulsa <b>Confirmar firma</b> (<b>Limpiar</b> la borra antes de enviar). Se envía al servidor y aparece en el documento.</li>
    <li><b>Representante:</b> su firma personal en el documento. <b>Propósito:</b> dar fe de que usted gestionó esa asistencia. <b>Cuándo:</b> dibújela en su panel (<b>Firma del representante de clase</b>, con los modos Dibujar, Subir imagen o Escribir) una vez verificada la lista, y pulse <b>Guardar firma</b> (<b>Quitar</b> la retira). Se relaciona con las otras dos así: las tres aparecen juntas al pie del documento, pero cada una se registra por separado y ninguna reemplaza a otra.</li>
  </ul>
  <div class="msg warn"><span class="lbl">Local frente a servidor</span>Las firmas de estudiante y docente confirmadas están persistidas en el servidor. La firma del representante se guarda en el equipo donde se dibujó: si cambia de dispositivo, debe firmarla de nuevo allí. Consecuencia práctica: revise el documento en el mismo equipo donde firmó.</div>
  <div class="proc">
  <h4>Cierre de la asistencia: objetivo</h4><p>Terminar definitivamente la clase, dejando 24 horas de consulta.</p>
  <h4>Antes de cerrar</h4><p>Verifique la lista completa, ambas firmas visibles y exporte el PDF y el respaldo JSON.</p>
  <h4>Pasos</h4>
  <ol class="steps">
    <li>Pulse <b>Cerrar</b>. Lea el diálogo de confirmación con sus cuatro consecuencias y pulse <b>Sí, cerrar</b> (o <b>Cancelar</b> para anular).</li>
    <li>Consecuencias: no se aceptan más registros, el docente ya no puede firmar, la asistencia queda disponible para consulta durante <b>24 horas</b> y luego se elimina automáticamente.</li>
  </ol>
  <h4>Resultado esperado</h4><p>Estado de asistencia cerrada. <b>Si algo falla:</b> si el cierre no se confirma por conexión, inténtelo de nuevo; no continúe como si estuviera cerrada.</p>
  <h4>Advertencia</h4></div>
  <div class="msg err"><span class="lbl">El cierre es definitivo</span>Esa sesión no vuelve a abrirse: para continuar debe abrir una sesión nueva, que generará códigos nuevos.</div>` },

{ id: "pdf", num: "Capítulo 10", title: "Generación del PDF", desc: "Documento para imprimir o guardar",
  html: `<div class="proc">
  <h4>Objetivo</h4><p>Obtener el documento de asistencia para imprimir, archivar o compartir.</p>
  <h4>Antes de comenzar</h4><p>Asistencia cargada, lista completa y firmas visibles.</p>
  <h4>Pasos</h4>
  <ol class="steps">
    <li>Pulse <b>Exportar a PDF / Imprimir</b>.</li>
    <li>Revise en pantalla la vista previa: datos de la clase, tabla de estudiantes con firmas y firmas del docente y del representante.</li>
    <li>En el diálogo de impresión elija impresora o <b>Guardar como PDF</b> y confirme.</li>
  </ol>
  <h4>Qué debe observar</h4><p>El diseño ajusta automáticamente el tamaño de filas para que todo quepa en <b>una sola hoja tamaño Legal</b>. Si hay 36 o más asistencias verá un aviso sugiriendo exportar también el CSV.</p>
  <h4>Resultado esperado</h4><p>Documento impreso o archivo PDF guardado. <b>Si algo falla:</b> si el diálogo no aparece, revise el bloqueador de ventanas emergentes del navegador.</p></div>
  <h3>Otros formatos: cuándo usar cada uno</h3>
  <ul>
    <li><b>Exportar CSV:</b> tabla para hojas de cálculo y conteos (nombre de archivo con código y fecha). Úselo para revisar o sumar datos en Excel.</li>
    <li><b>Respaldo JSON:</b> copia completa (<code class="k">respaldo_asistencia_…json</code>) para guardar o trasladar a otro equipo; con <b>Importar respaldo JSON</b> puede restaurarla (confirme con <b>Aceptar</b>). Úselo antes de borrar registros locales o cambiar de dispositivo.</li>
  </ul>
  <div class="msg"><span class="lbl">Nota</span>Este manual no atribuye validez institucional oficial al documento: su valor depende de las normas de cada institución.</div>` },

{ id: "faq", num: "Capítulo 11", title: "Preguntas frecuentes", desc: "Soluciones rápidas",
  faq: [
    ["No puedo entrar como representante.", "Verifique usuario y contraseña (mayúsculas y espacios). Si ve intentos contados, espere. Tras 5 fallos hay bloqueo de 5 minutos."],
    ["Mi asignatura no aparece en el selector.", "El catálogo depende de sus asignaciones. No edite otra materia: pida al administrador que revise sus ofertas asignadas."],
    ["El código del estudiante no funciona.", "Confirme que dicta el código vigente de la sesión abierta. Cada cierre y reapertura genera códigos nuevos."],
    ["Un estudiante dice que firmó pero no aparece.", "Pida ver su pantalla: solo vale <b>Asistencia registrada correctamente</b>. Verifique que consulta la sesión correcta y espere la actualización automática."],
    ["La página dice que no hay conexión.", "Revise internet y pulse <b>Reintentar</b>. Sin conexión el registro no queda guardado."],
    ["La firma no se acepta.", "Estudiante: la firma es obligatoria; use Borrar y repita. Docente: pulse <b>Confirmar firma</b> y espere <i>Firma enviada correctamente</i>."],
    ["¿Bloquear es lo mismo que cerrar?", "No. Bloquear pausa nuevas firmas; cerrar termina la asistencia definitivamente (24 h de consulta y luego se elimina)."],
    ["¿Cómo salgo en un equipo compartido?", "Pulse <b>Cerrar sesión</b> y cierre el navegador."],
    ["El PDF sale en varias páginas.", "Use el botón <b>Exportar a PDF / Imprimir</b> de la plataforma (ajusta a una hoja Legal) en lugar de imprimir la página directamente."],
    ["Olvidé exportar antes de cerrar.", "Tiene 24 horas para consultar y exportar la asistencia cerrada."],
    ["El botón no responde o la lista no se actualiza.", "Verifique su conexión a internet y pulse <b>Ver asistencias</b> de nuevo. Si el problema persiste, cierre y vuelva a abrir la sesión del panel (sin borrar nada)."],
    ["Cambiar de asignatura me pide confirmar un borrado.", "Es una protección: al cambiar de materia se limpia la lista actual del equipo. Exporte primero el PDF y el respaldo JSON, y luego confirme."],
    ["Mi firma de representante no aparece en otro equipo.", "Esa firma se guarda en el equipo donde la dibujó. Ábrala y fírmela de nuevo en el equipo donde generará el documento."]
  ] },

{ id: "seguridad", num: "Capítulo 12", title: "Seguridad y privacidad", desc: "Buenas prácticas y medidas reales",
  html: `<h3>Lo que usted debe hacer</h3>
  <ul>
    <li>No comparta su usuario ni su contraseña; la clave que se comparte en clase es solo el código de asistencia.</li>
    <li>Cierre sesión en equipos compartidos y no guarde la contraseña en navegadores ajenos.</li>
    <li>Reporte errores describiendo el mensaje en pantalla, sin enviar contraseñas ni fotografiar claves de otros.</li>
    <li>Trate nombres, identificaciones y firmas como datos personales: no los publique ni los reenvíe fuera del curso.</li>
  </ul>
  <h3>Lo que la plataforma sí implementa</h3>
  <ul>
    <li>Bloqueo temporal tras 5 intentos fallidos de acceso.</li>
    <li>Sesiones con vigencia limitada y códigos que se invalidan al cerrar.</li>
    <li>Registro único por identificación en cada clase (sin duplicados).</li>
    <li>Confirmaciones explícitas antes de acciones definitivas (cerrar, borrar, reemplazar respaldo).</li>
    <li>Claves administrativas que nunca se muestran en pantalla.</li>
  </ul>
  <div class="msg warn"><span class="lbl">Límite conocido</span>Los datos visibles en un dispositivo quedan al alcance de quien lo use: proteja físicamente sus equipos.</div>` },

{ id: "guia-rapida", num: "Capítulo 13", title: "Guía rápida del representante", desc: "Flujo y listas de comprobación",
  html: `<h3>Flujo de la clase</h3>
  <div class="flow">
    <div class="fnode">Iniciar sesión</div><div class="farrow">→</div>
    <div class="fnode">Seleccionar asignatura</div><div class="farrow">→</div>
    <div class="fnode">Abrir sesión</div><div class="farrow">→</div>
    <div class="fnode">Compartir código</div><div class="farrow">→</div>
    <div class="fnode">Verificar registros</div><div class="farrow">→</div>
    <div class="fnode">Gestionar el cierre</div><div class="farrow">→</div>
    <div class="fnode">Revisar firmas</div><div class="farrow">→</div>
    <div class="fnode">Generar la asistencia</div>
  </div>
  <h3>Antes de la clase</h3><ul class="check" data-check="antes">
    <li><input type="checkbox" id="ck-a1"><span><label for="ck-a1">Sesión iniciada y asignatura correcta seleccionada.</label></span></li>
    <li><input type="checkbox" id="ck-a2"><span><label for="ck-a2">Duración elegida y sesión abierta.</label></span></li>
    <li><input type="checkbox" id="ck-a3"><span><label for="ck-a3">Código de estudiantes listo para compartir.</label></span></li>
  </ul>
  <h3>Durante la clase</h3><ul class="check" data-check="durante">
    <li><input type="checkbox" id="ck-d1"><span><label for="ck-d1">Verifico que los registros aparecen en la lista.</label></span></li>
    <li><input type="checkbox" id="ck-d2"><span><label for="ck-d2">Ayudo a quien tenga errores de código o conexión.</label></span></li>
    <li><input type="checkbox" id="ck-d3"><span><label for="ck-d3">Bloqueo nuevos registros si ya terminó el llamado.</label></span></li>
  </ul>
  <h3>Después de la clase</h3><ul class="check" data-check="despues">
    <li><input type="checkbox" id="ck-f1"><span><label for="ck-f1">Lista completa y ambas firmas visibles.</label></span></li>
    <li><input type="checkbox" id="ck-f2"><span><label for="ck-f2">PDF y respaldo JSON exportados.</label></span></li>
    <li><input type="checkbox" id="ck-f3"><span><label for="ck-f3">Sesión cerrada y sesión del equipo cerrada.</label></span></li>
  </ul>
  <h3>Cierre y finalización</h3><ul class="check" data-check="cierre">
    <li><input type="checkbox" id="ck-c1"><span><label for="ck-c1">Confirmé que cada estudiante esperado aparece con nombre, identificación y firma.</label></span></li>
    <li><input type="checkbox" id="ck-c2"><span><label for="ck-c2">La firma del docente está visible en el documento.</label></span></li>
    <li><input type="checkbox" id="ck-c3"><span><label for="ck-c3">Mi firma de representante está visible en el documento.</label></span></li>
    <li><input type="checkbox" id="ck-c4"><span><label for="ck-c4">Guardé el PDF y el respaldo JSON antes de cerrar.</label></span></li>
    <li><input type="checkbox" id="ck-c5"><span><label for="ck-c5">Cerré la sesión y luego cerré mi sesión de usuario.</label></span></li>
  </ul>
  <p class="check-progress" id="checkProgress"></p>` },

{ id: "guia-docente", num: "Capítulo 14", title: "Guía para docentes", desc: "Código, consulta y firma",
  html: `<p>Ingrese con el código que le entregó el representante (<b>Acceso del docente → Código de asistencia → Ingresar</b>). Podrá consultar la lista de su clase y, en la parte inferior de la pantalla, encontrará la sección <b>Firma del docente</b>: firme y pulse <b>Confirmar firma</b>. Detalle completo en el Capítulo 14 de la guía anterior y solución de errores en Preguntas frecuentes.</p>
  <div class="msg warn"><span class="lbl">Recuerde</span>Su código es distinto al de los estudiantes y deja de servir al cerrarse la sesión.</div>` },

{ id: "guia-estudiante", num: "Capítulo 15", title: "Guía para estudiantes", desc: "Registro en pocos pasos",
  html: `<p>Ingrese el código que le proporciona el representante (<b>Estudiante → Firmar la asistencia a la clase → Validar</b>) y siga lo que muestra la pantalla: complete sus datos, firme y pulse <b>Enviar asistencia</b>. Solo el mensaje <b>Asistencia registrada correctamente</b> confirma su registro, único por clase. El procedimiento detallado está en el Capítulo 6.</p>` },

{ id: "guia-admin", num: "Capítulo 16", title: "Guía administrativa", desc: "Representantes, docentes y ofertas",
  html: `<h3>Acceso</h3>
  <p>Abra la ruta administrativa e ingrese la <b>Clave administrativa</b> con <b>Entrar</b>. La clave queda guardada solo en esa pestaña; use <b>Cerrar sesión</b> al terminar. Nunca comparta ni publique esta clave.</p>
  <h3>Vistas disponibles</h3>
  <ul>
    <li><b>Resumen:</b> conteos de representantes activos y totales, ofertas académicas y asignaciones, más ofertas por período.</li>
    <li><b>Representantes:</b> buscador, botón <b>+ Nuevo representante</b> (nombre, usuario y contraseña de mínimo 8 caracteres), <b>Editar</b> para cambiar sus ofertas marcando tarjetas, y <b>Activar/Desactivar</b>.</li>
    <li><b>Docentes:</b> buscador y botón <b>+ Nuevo docente</b> (solo nombre completo y correo institucional; sin accesos).</li>
    <li><b>Ofertas académicas:</b> buscador y filtros por período y nivel; cada tarjeta muestra asignatura, código, docente, grupo y representantes asignados.</li>
    <li><b>Nueva oferta:</b> reutilice una asignatura existente o cree nombre y código nuevos, elija período, nivel, grupo (Automático si no está seguro) y docente opcional. Se crea con <b>Crear oferta</b> y el sistema devuelve su identificador real.</li>
  </ul>
  <h3>Importación JSON</h3>
  <p>En <b>Nueva oferta</b>, la sección <b>Importar asignaturas</b> permite <b>Seleccionar JSON</b> con la plantilla descargable (<code class="k">asignaturas-plantilla.json</code>: nombre, código, nivel del 1 al 10 y docente opcional), revisar la vista previa, corregir filas marcadas con error y pulsar <b>Importar seleccionadas</b>. Al final verá el resumen de creadas, existentes y errores.</p>
  <div class="msg warn"><span class="lbl">Límite comprobado</span>El panel administra representantes, docentes y ofertas. No administra períodos, niveles ni grupos: esos catálogos los define la institución.</div>` }
];

const $app = () => $('#chapters');
let current = 'indice';

function renderChapter(id){
  const ch = CHAPTERS.find(c => c.id === id) || CHAPTERS[0];
  current = ch.id;
  let html = `<article class="chapter" id="ch-${ch.id}">` +
    (ch.num ? `<div class="chnum">${esc(ch.num)} · Manual v1.0</div>` : `<div class="chnum">Manual v1.0</div>`) +
    `<h2>${esc(ch.title)}</h2><p class="muted">${esc(ch.desc || '')}</p>`;
  if (ch.faq) {
    html += ch.faq.map((f, i) =>
      `<div class="faq"><button aria-expanded="false" data-faq="${i}"><span>${f[0]}</span><span class="chev">›</span></button><div class="a"><p>${f[1]}</p></div></div>`
    ).join('');
  } else {
    html += ch.html;
  }
  const idx = CHAPTERS.findIndex(c => c.id === ch.id);
  const prev = CHAPTERS[idx - 1], next = CHAPTERS[idx + 1];
  html += `<div class="pagenav">` +
    (prev ? `<button class="btn sec" data-go="${prev.id}">← ${esc(prev.title)}</button>` : `<span></span>`) +
    (next ? `<button class="btn" data-go="${next.id}">${esc(next.title)} →</button>` : `<span></span>`) +
    `</div><p class="metafoot">Plataforma de Asistencia Académica · Manual de usuario · Versión 1.0</p></article>`;
  $app().innerHTML = html;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  wireChapter();
  updateProgress();
  markActive();
}

function wireChapter(){
  $$('#chapters [data-go]').forEach(b => b.onclick = () => renderChapter(b.dataset.go));
  $$('#chapters [data-faq]').forEach(b => b.onclick = () => {
    const box = b.closest('.faq');
    const open = box.classList.toggle('open');
    b.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  $$('#chapters .check input').forEach(box => {
    const id = box.id;
    try { box.checked = localStorage.getItem('manual_ck_' + id) === '1'; } catch (e) {}
    paintCheck(box);
    box.onchange = () => {
      try { localStorage.setItem('manual_ck_' + id, box.checked ? '1' : '0'); } catch (e) {}
      paintCheck(box); updateCheckProgress();
    };
  });
  updateCheckProgress();
}
function paintCheck(box){
  const li = box.closest('li');
  if (li) li.classList.toggle('done', box.checked);
}
function updateCheckProgress(){
  const boxes = $$('#chapters .check input');
  const el = $('#checkProgress');
  if (!el) return;
  if (!boxes.length) { el.textContent = ''; return; }
  const done = boxes.filter(b => b.checked).length;
  el.textContent = `Lista de comprobación: ${done} de ${boxes.length} completadas.`;
}

function buildSidebar(){
  $('#sideNav').innerHTML = '<ul>' + CHAPTERS.map(c =>
    `<li><a href="#" data-nav="${c.id}">${esc(c.num ? c.num + ' · ' : '')}${esc(c.title)}<small>${esc(c.desc || '')}</small></a></li>`
  ).join('') + '</ul>';
  $$('#sideNav [data-nav]').forEach(a => a.onclick = e => {
    e.preventDefault();
    renderChapter(a.dataset.nav);
    document.body.classList.remove('menu-open');
  });
  const toc = $('#tocList');
  if (toc) toc.innerHTML = CHAPTERS.filter(c => c.num).map(c => `<li><a href="#" data-nav="${c.id}">${esc(c.title)}</a></li>`).join('');
  $$('#tocList [data-nav]').forEach(a => a.onclick = e => { e.preventDefault(); renderChapter(a.dataset.nav); });
}
function markActive(){
  $$('#sideNav a').forEach(a => a.classList.toggle('active', a.dataset.nav === current));
}
function updateProgress(){
  const h = document.documentElement;
  const max = h.scrollHeight - h.clientHeight;
  $('#readBar').style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
}

function doSearch(q){
  q = q.trim().toLowerCase();
  const box = $('#searchResults');
  if (q.length < 2) { box.innerHTML = ''; return; }
  const tmp = document.createElement('div');
  const out = [];
  for (const c of CHAPTERS) {
    tmp.innerHTML = (c.html || '') + ' ' + (c.faq || []).map(f => f[0] + ' ' + f[1]).join(' ');
    const text = (tmp.textContent || '').toLowerCase();
    const i = text.indexOf(q);
    if (c.title.toLowerCase().includes(q) || i >= 0) {
      const frag = i >= 0 ? '…' + tmp.textContent.slice(Math.max(0, i - 60), i + 90) + '…' : c.desc;
      out.push({ c, frag });
      if (out.length >= 12) break;
    }
  }
  box.innerHTML = out.length
    ? out.map(o => `<li><a href="#" data-sgo="${o.c.id}"><b>${esc(o.c.num ? o.c.num + ' · ' : '')}${esc(o.c.title)}</b><br><span>${esc(o.frag)}</span></a></li>`).join('')
    : `<li><span class="muted">Sin resultados para esa búsqueda.</span></li>`;
  $$('#searchResults [data-sgo]').forEach(a => a.onclick = e => { e.preventDefault(); box.innerHTML = ''; $('#q').value = ''; renderChapter(a.dataset.sgo); });
}

document.addEventListener('DOMContentLoaded', () => {
  buildSidebar();
  renderChapter('indice');
  $('#menuBtn').onclick = () => document.body.classList.toggle('menu-open');
  $('#scrim').onclick = () => document.body.classList.remove('menu-open');
  $('#homeBtn').onclick = () => { document.body.classList.remove('menu-open'); renderChapter('indice'); };
  let deb = null;
  $('#q').addEventListener('input', e => { clearTimeout(deb); deb = setTimeout(() => doSearch(e.target.value), 180); });
  window.addEventListener('scroll', updateProgress, { passive: true });
  $('#printBtn').onclick = () => window.print();
});
