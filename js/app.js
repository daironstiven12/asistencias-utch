"use strict";
/* ============================================================
   SISTEMA INSTITUCIONAL DE REGISTRO DE ASISTENCIA · UTCH
   100% client-side · Datos cifrados en localStorage
   Seguridad: AES-GCM 256 · PBKDF2-SHA256 (310k) · Bloqueo por intentos
   ============================================================ */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
));
const clean = (s, max=160) => String(s ?? '')
  .replace(/[<>]/g,'').replace(/[\u0000-\u001F\u007F]/g,' ')
  .replace(/\s+/g,' ').trim().slice(0,max);
const cleanMulti = (s, max=800) => String(s ?? '')
  .replace(/[<>]/g,'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'')
  .slice(0,max);
const firmaSegura = s =>
  /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(String(s||'')) ? String(s) : '';
const hoy = () => { const d=new Date(), z=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; };
const fmtFecha = iso => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso||''));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(iso||'');
};
const rndBytes = n => {
  if (!(globalThis.crypto && crypto.getRandomValues)) throw new Error('Web Crypto no está disponible.');
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
};
const b64FromBytes = b => {
  let s=''; const CH=0x8000;
  for (let i=0;i<b.length;i+=CH) s+=String.fromCharCode.apply(null,b.subarray(i,i+CH));
  return btoa(s);
};
const bytesFromB64 = s => {
  const bin=atob(s), o=new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) o[i]=bin.charCodeAt(i);
  return o;
};

/* ---------------------- Iconos SVG ------------------------- */
const I = {
  student:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
  teacher:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  arrowLeft:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
  pencil:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
  image:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  type:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
  eraser:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16a2 2 0 0 1 0-2.83l9.17-9.17a2 2 0 0 1 2.83 0l5.17 5.17a2 2 0 0 1 0 2.83L11 20"/></svg>',
  lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  shieldCheck:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>',
  copy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  play:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
  stop:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>',
  refresh:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  print:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
  download:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  alert:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  key:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
  clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  file:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  users:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  database:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>'
};

/* ============================================================
   LOGO INSTITUCIONAL FIJO
   🔒 El logo es SIEMPRE logo.png (no configurable)
   ============================================================ */
const LOGO_SRC = 'logo.png';

/* -------------------------- Cifrado -------------------------- */
const DATA_STORE='utch.asistencia.v1', KEY_STORE='utch.asistencia.k',
      SESSION_REP='utch.sesion.rep',
      SESSION_EST='utch.sesion.est',
      SESSION_API='utch.sesion.apiId',
      LOCK_STORE='utch.asistencia.lock';

/* ============================================================
   Acceso del representante: autenticación real contra la API
   (POST /api/rep/login). Ya no existe PIN fijo en el frontend.
   ============================================================ */

const _enc=new TextEncoder(), _dec=new TextDecoder();

async function cryptoKey(){
  if (!(globalThis.crypto && crypto.subtle)) return null;
  try{
    let raw=localStorage.getItem(KEY_STORE);
    if(!raw){ raw=b64FromBytes(rndBytes(32)); localStorage.setItem(KEY_STORE,raw); }
    return await crypto.subtle.importKey('raw',bytesFromB64(raw),{name:'AES-GCM'},false,['encrypt','decrypt']);
  }catch(e){ return null; }
}
async function cifrar(obj){
  const json=JSON.stringify(obj);
  const k=await cryptoKey();
  if(!k) throw new Error('El cifrado seguro no está disponible.');
  const iv=rndBytes(12);
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},k,_enc.encode(json));
  return 'aes:'+b64FromBytes(iv)+':'+b64FromBytes(new Uint8Array(ct));
}
async function descifrar(raw){
  if(!raw) return null;
  try{
    if(raw.startsWith('aes:')){
      const p=raw.split(':'); const k=await cryptoKey();
      if(!k) return null;
      const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytesFromB64(p[1])},k,bytesFromB64(p[2]));
      return JSON.parse(_dec.decode(pt));
    }
    return JSON.parse(raw);
  }catch(e){ return null; }
}

/* ---- Bloqueo a los 5 intentos fallidos ---- */
const MAX_INTENTOS = 5;
const BLOQUEO_MS   = 5 * 60 * 1000;

function getLock() {
  try { return JSON.parse(localStorage.getItem(LOCK_STORE)||'{"n":0,"until":0}'); }
  catch(e){ return {n:0, until:0}; }
}
function setLock(o) { try { localStorage.setItem(LOCK_STORE, JSON.stringify(o)); } catch(e){} }
function registrarFallo() {
  const o = getLock();
  o.n = (o.n||0) + 1;
  if (o.n >= MAX_INTENTOS) { o.until = Date.now() + BLOQUEO_MS; o.n = 0; }
  setLock(o);
  return o;
}
function limpiarFallos() { setLock({n:0, until:0}); }
function estaBloqueado() {
  const o = getLock();
  if (o.until && o.until > Date.now()) return Math.ceil((o.until - Date.now())/1000);
  if (o.until && o.until <= Date.now()) { setLock({n:0, until:0}); return 0; }
  return 0;
}

/* -------------------------- Estado --------------------------- */
const MATERIA_CAMPOS=['facultad','programa','nivel','asignatura','codigo','periodo','cds','docente','temas'];
/* Datos comunes a todas las asignaturas (configuración del período académico) */
const DATOS_COMUNES={
  facultad:'INGENIERÍA',
  programa:'INGENIERÍA DE TELECOMUNICACIONES E INFORMÁTICA',
  nivel:'VIII',
  periodo:'2026-1'
};
const MATERIAS_SEMESTRE=[
  {id:'sem-2720208-comunicacion-analoga',datos:{asignatura:'COMUNICACIÓN ANÁLOGA',codigo:'2720208',docente:'JOHAN FERNEY PINO CUESTA'},correo:'',horas:4,courseOfferingId:1},
  {id:'sem-2720308-microcontroladores',datos:{asignatura:'MICROCONTROLADORES',codigo:'2720308',docente:'JACKSON BERNEY RENTERIA MENA'},correo:'d-jackson.renteria@utch.edu.co',horas:3,courseOfferingId:2},
  {id:'sem-2720408-administracion-sistemas-operativos',datos:{asignatura:'ADMINISTRACIÓN Y GESTIÓN DE SISTEMAS OPERATIVOS',codigo:'2720408',docente:'DEINER MENA WALDO'},correo:'deiner.mena@utch.edu.co',horas:4,courseOfferingId:3},
  {id:'sem-2720608-metodologia-investigacion-ii',datos:{asignatura:'METODOLOGÍA DE LA INVESTIGACIÓN II',codigo:'2720608',docente:'HECTOR DAVID AGUDELO ARIAS'},correo:'d-hector.agudelo@utch.edu.co',horas:2,courseOfferingId:4},
  {id:'sem-2720108-electiva-ii',datos:{asignatura:'ELECTIVA II',codigo:'2720108',docente:'HARLINTON PALACIOS MOSQUERA'},correo:'harlinton.palacios@utch.edu.co',horas:2,courseOfferingId:5},
  {id:'sem-2720708-analitica-datos',datos:{asignatura:'ANALÍTICA DE DATOS',codigo:'2720708',docente:'ERWIN ENRIQUE MOYA LOZANO'},correo:'d-erwin.moya@utch.edu.co',horas:4,courseOfferingId:6}
];
const DEFAULTS = () => ({
  cfg:{ facultad:'',programa:'',nivel:'',asignatura:'',codigo:'',
        periodo:'',cds:'',fecha:hoy(),hora:'',docente:'',temas:'' },
  materias:MATERIAS_SEMESTRE.map(materia=>({...materia,datos:{...materia.datos}})), materiaActiva:'',
  firmaDoc:'',firmaRep:'',logo:'',
  sesion:{ abierta:false,inicio:0,minutos:15,clave:'',sessionId:'' },
  clavesUsadas:[],
  estudiantes:[]
});
let S=DEFAULTS(), adminMode=false, tic=null, saveTimer=null, pads={};
let tituloPDF=null;
let repRegAbiertos=true;
let pollApi=null, pollApiCtrl=null;
let docenteSessionId=null, pollApiDocente=null, pollApiDocenteCtrl=null, docenteInfo=null;
let cierreEnCurso=false;

function normalizar(o){
  const d=DEFAULTS(), src=(o&&typeof o==='object')?o:{};
  const materiasPorId=new Map();
  const ofertaCatalogo=new Map(MATERIAS_SEMESTRE.map(materia=>[materia.id,Math.max(0,Number(materia.courseOfferingId)||0)]));
  [...MATERIAS_SEMESTRE,...(Array.isArray(src.materias)?src.materias:[])].forEach((materia,i)=>{
    const datos={};
    for(const k of MATERIA_CAMPOS){
      const v=materia&&materia.datos?materia.datos[k]:'';
      datos[k]=(k==='temas')?cleanMulti(v,800):clean(v,160);
    }
    const id=clean(materia&&materia.id,40)||('m'+i);
    materiasPorId.set(id,{
      id,datos,
      correo:clean(materia&&materia.correo,160),
      horas:Math.max(0,Number(materia&&materia.horas)||0),
      courseOfferingId:Math.max(0,Number(materia&&materia.courseOfferingId)||ofertaCatalogo.get(id)||0)
    });
  });
  const materias=Array.from(materiasPorId.values()).filter(materia=>materia.datos.asignatura);
  const materiaActiva=clean(src.materiaActiva,40);
  const cfg={};
  for(const k in d.cfg){
    const v=src.cfg?src.cfg[k]:'';
    cfg[k]=(k==='temas')?cleanMulti(v,800):clean(v,160);
  }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(cfg.fecha)) cfg.fecha=hoy();
  const ses=src.sesion||{};
  return {
    cfg,
    materias,
    materiaActiva:materias.some(materia=>materia.id===materiaActiva)?materiaActiva:'',
    firmaDoc:firmaSegura(src.firmaDoc),
    firmaRep:firmaSegura(src.firmaRep),
    logo:'',
    sesion:{
      abierta:!!ses.abierta,
      inicio:Number(ses.inicio)||0,
      minutos:Math.max(0,Math.min(240,Number(ses.minutos)||0)),
      clave:clean(ses.clave,8).toUpperCase(),
      claveDocente:clean(ses.claveDocente,8).toUpperCase(),
      sessionId:clean(ses.sessionId,40)
    },
    clavesUsadas:(Array.isArray(src.clavesUsadas)?src.clavesUsadas:[]).map(c=>clean(c,8).toUpperCase()).filter(Boolean).slice(-40),
    estudiantes:(Array.isArray(src.estudiantes)?src.estudiantes:[])
      .map((f,i)=>({
        id:clean(f&&f.id,40)||('imp'+i),
        nombre:clean(f&&f.nombre,80),
        ident:clean(f&&f.ident,20),
        firma:firmaSegura(f&&f.firma),
        ts:Number(f&&f.ts)||Date.now()
      }))
      .filter(f=>f.nombre&&f.ident)
      .slice(0,500)
  };
}
async function guardar(){
  clearTimeout(saveTimer); saveTimer=null;
  if(modoRemoto) return;
  try{ localStorage.setItem(DATA_STORE,await cifrar(S)); }
  catch(e){ console.warn('No se pudo guardar.'); }
}
function guardarDiferido(){ clearTimeout(saveTimer); saveTimer=setTimeout(guardar,300); }
async function cargar(){
  const raw=localStorage.getItem(DATA_STORE);
  if(raw){ const o=await descifrar(raw); if(o) S=normalizar(o); }
  await guardar();
}
/* Relee los datos guardados por OTRA pestaña sin volver a escribir
   (evita un bucle infinito de eventos "storage"). */
async function sincronizar(){
  const claveRemota = (modoRemoto) ? String(sessionStorage.getItem(SESSION_EST)||(S&&S.sesion&&S.sesion.clave)||'').trim().toUpperCase() : '';
  const apiRemota = (modoRemoto) ? String(sessionStorage.getItem(SESSION_API)||(S&&S.sesion&&S.sesion.sessionId)||'').trim() : '';
  const abiertaRemota = (modoRemoto) ? !!((S&&S.sesion&&S.sesion.abierta)) : false;
  const inicioRemoto = (modoRemoto) ? Number(S&&S.sesion&&S.sesion.inicio)||0 : 0;
  const raw=localStorage.getItem(DATA_STORE);
  if(raw){ const o=await descifrar(raw); if(o) S=normalizar(o); }
  if(claveRemota){ S.sesion.clave=claveRemota; }
  if(modoRemoto){
    if(apiRemota){ S.sesion.sessionId=apiRemota; }
    S.sesion.abierta=abiertaRemota;
    S.sesion.inicio=inicioRemoto;
    S.sesion.minutos=0;
  }
  const ruta=location.hash.replace(/^#\/?/,'').split('?')[0];
  if(ruta==='estudiante') refrescarZona();
  else if(ruta==='admin' && adminMode) refrescarPanel();
}
function alCambiarAlmacenamiento(e){
  if(e && e.key && e.key!==DATA_STORE) return;
  if(saveTimer) return;
  sincronizar();
}

/* ------------------------- Sesión ---------------------------- */
function estadoSesion(){
  const s=S.sesion;
  /* Conectado al docente pero aún sin su estado: NO se puede afirmar que
     esté cerrado, o el estudiante ve un mensaje falso mientras carga. */
  if(modoRemoto&&!estadoRemotoRecibido) return { abierto:true, conectando:true, texto:'Conectando con el docente…' };
  if(!s.abierta) return { abierto:false, texto:'El registro está cerrado.' };
  const m=+s.minutos||0;
  if(!m) return { abierto:true, texto:'Registro abierto · sin límite de tiempo.' };
  const restante=s.inicio+m*60000-Date.now();
  if(restante<=0) return { abierto:false, texto:'El tiempo de registro terminó.' };
  const t=Math.ceil(restante/1000);
  return { abierto:true, texto:`Registro abierto · quedan ${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}` };
}
/* Conexión entre dispositivos migrada a API + PostgreSQL. */
let redMensaje='', estadoRemotoRecibido=false;

function pintarRed(){
  const el=$('#red'); if(!el) return;
  const activo=S.sesion.abierta && S.sesion.clave;
  el.className='aviso '+(activo?'ok':'');
  el.innerHTML=(activo?I.shieldCheck:I.users)+'<span>'+
    (activo
      ? 'Registro abierto. Los estudiantes pueden conectarse desde cualquier dispositivo con el código <b>'+esc(S.sesion.clave)+'</b>.'
      : 'El registro está cerrado. Abra la asistencia para que los estudiantes puedan conectarse.')+
    (redMensaje?' <b>'+esc(redMensaje)+'</b>':'')+'</span>';
}

const espera=ms=>new Promise(r=>setTimeout(r,ms));

/* -------------------- Estudiante: conexión ------------------- */
function mostrarExitoEstudiante(nombre,ident){
  sessionStorage.setItem('utch.registro.'+S.sesion.clave,'1');
  zonaFijada=true; zonaEstado='ya-registrado:'+S.sesion.clave;
  const zona=$('#zona');
  if(!zona) return;
  zona.innerHTML =
    '<div class="aviso ok">'+I.shieldCheck+
      '<span><b>Asistencia registrada correctamente.</b><br>' +
      '<span class="mut">'+esc(nombre)+' · '+esc(ident)+'</span></span>' +
    '</div>' +
    '<p class="mut">El registro es único: no podrá firmar otra vez en esta clase. ' +
    'Puede cerrar esta página.</p>';
}
function mostrarErrorEstudiante(texto){
  const env=$('#enviar');
  if(env) env.disabled=false;
  const msg=$('#msg');
  if(msg) msg.textContent=texto||'No se pudo registrar la asistencia.';
}

/* --------------------------- Firma pad ----------------------- */
function sigPad(el){
  el.classList.add('sig');
  el.innerHTML =
    '<div class="sig-tabs">' +
      '<button type="button" data-m="d" class="active">'+I.pencil+'Dibujar</button>' +
      '<button type="button" data-m="u">'+I.image+'Subir imagen</button>' +
      '<button type="button" data-m="t">'+I.type+'Escribir</button>' +
    '</div>' +
    '<div class="pane" data-p="u" hidden><input type="file" accept="image/png,image/jpeg"></div>' +
    '<div class="pane" data-p="t" hidden><input type="text" maxlength="40" placeholder="Escriba su nombre como firma"></div>' +
    '<canvas width="360" height="120" aria-label="Área de firma"></canvas>' +
    '<button type="button" class="s" data-c style="margin-top:10px">'+I.eraser+'Borrar</button>';

  const cv=el.querySelector('canvas');
  const x=cv.getContext('2d');
  let dirty=false, draw=false, mode='d';
  const clear=()=>{ x.clearRect(0,0,360,120); dirty=false; };
  const pt=e=>{ const r=cv.getBoundingClientRect();
    return [(e.clientX-r.left)*360/r.width,(e.clientY-r.top)*120/r.height]; };
  x.lineWidth=2.4; x.lineCap=x.lineJoin='round'; x.strokeStyle='#111';

  cv.addEventListener('pointerdown',e=>{
    if(mode!=='d') return;
    draw=true;
    try{ cv.setPointerCapture(e.pointerId); }catch(_){}
    x.beginPath(); const [a,b]=pt(e);
    x.moveTo(a,b); x.lineTo(a+.1,b); x.stroke(); dirty=true;
  });
  cv.addEventListener('pointermove',e=>{
    if(!draw) return;
    const [a,b]=pt(e); x.lineTo(a,b); x.stroke();
  });
  ['pointerup','pointercancel'].forEach(ev=>cv.addEventListener(ev,()=>{ draw=false; }));
  el.querySelectorAll('[data-m]').forEach(b=>{
    b.onclick=()=>{
      mode=b.dataset.m; clear();
      el.querySelectorAll('[data-m]').forEach(t=>t.classList.toggle('active',t===b));
      el.querySelectorAll('.pane').forEach(p=>{ p.hidden=p.dataset.p!==mode; });
    };
  });
  el.querySelector('[data-c]').onclick=clear;

  el.querySelector('input[type=file]').onchange=e=>{
    const f=e.target.files&&e.target.files[0];
    if(!f) return;
    if(!/^image\/(png|jpeg)$/.test(f.type)){ uiAlert({kind:'error',title:'Imagen no válida',message:'Use una imagen PNG o JPG.'}); return; }
    const im=new Image();
    im.onload=()=>{
      clear();
      const k=Math.min(360/im.width,120/im.height);
      const w=im.width*k, h=im.height*k;
      x.drawImage(im,(360-w)/2,(120-h)/2,w,h);
      const img=x.getImageData(0,0,360,120), px=img.data;
      for(let i=0;i<px.length;i+=4){
        const lum=.2126*px[i]+.7152*px[i+1]+.0722*px[i+2];
        px[i+3]=Math.round(px[i+3]*(255-lum)/255);
        px[i]=px[i+1]=px[i+2]=0;
      }
      x.putImageData(img,0,0); dirty=true;
      URL.revokeObjectURL(im.src);
    };
    im.src=URL.createObjectURL(f);
    e.target.value='';
  };
  el.querySelector('input[type=text]').oninput=e=>{
    textoFirma=clean(e.target.value,40);
    pintarTextoFirma();
  };
  let textoFirma='';
  const pintarTextoFirma=()=>{
    clear();
    if(!textoFirma) return;
    x.fillStyle='#111';
    let s=52; x.font=s+'px Caveat, cursive';
    while(x.measureText(textoFirma).width>340 && s>14){ s-=2; x.font=s+'px Caveat, cursive'; }
    x.textBaseline='middle'; x.fillText(textoFirma,10,62); dirty=true;
  };
  /* Cuando la fuente manuscrita termina de cargar se redibuja, sin
     bloquear nunca la escritura del estudiante. */
  if(document.fonts&&document.fonts.ready){
    document.fonts.ready.then(()=>{ if(textoFirma) pintarTextoFirma(); });
    try{ document.fonts.load('40px Caveat').then(()=>{ if(textoFirma) pintarTextoFirma(); }); }catch(_){}
  }
  return {
    get:()=>(dirty?cv.toDataURL('image/png'):''),
    clear,
    set(dataUrl){
      clear();
      const d=firmaSegura(dataUrl);
      if(!d) return;
      const im=new Image();
      im.onload=()=>{
        const k=Math.min(360/im.width,120/im.height);
        const w=im.width*k, h=im.height*k;
        x.drawImage(im,(360-w)/2,(120-h)/2,w,h); dirty=true;
      };
      im.src=d;
    }
  };
}

/* -------------------------- Descargas ------------------------ */
function descargar(nombre, blob){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=nombre; a.rel='noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}

/* --------------------------- Header -------------------------- */
function cabecera(sub){
  return '<header class="app-header np">' +
    '<img class="logo" src="'+LOGO_SRC+'" alt="Universidad Tecnológica del Chocó">' +
    '<div class="titulos">' +
      '<h1>Registro de Asistencia</h1>' +
    '</div>' +
  '</header>';
}

const avisoLocal =
  '<div class="card np privacy-card">' +
    '<h2>'+I.shield+'Cómo funciona y privacidad</h2>' +
    '<p class="mut">La contraseña de administrador está predefinida en el sistema institucional. ' +
    'Los registros se cifran con AES-256-GCM y no se envían a Internet.</p>' +
    '<div class="privacy-extra">' +
    '<p class="mut">Mientras el docente tiene el registro abierto, cada estudiante que escribe la clave ' +
    'se conecta directamente al dispositivo del docente y envía allí sus datos y su firma. El enlace se ' +
    'establece a través de un servicio público de conexión, que solo negocia la comunicación: ' +
    'no guarda nombres, identificaciones ni firmas.</p>' +
    '<p class="mut">Al cerrar el registro, la conexión se corta y los datos quedan solo en el equipo del ' +
    'docente. Quien tenga acceso al dispositivo o a sus herramientas de navegador puede inspeccionar o ' +
    'borrar el almacenamiento local.</p>' +
    '</div>' +
    '<button type="button" class="privacy-toggle" aria-expanded="false">Ver más información &gt;</button>' +
  '</div>';

/* ---------------------------- Router ------------------------- */
function render(){
  const app=$('#app');
  pararTic();
  detenerPollingApi();
  detenerPollingApiDocente();
  if(location.pathname==='/ruta-administrativa') return vistaRutaAdmin(app);
  const ruta=location.hash.replace(/^#\/?/,'').split('?')[0];
  if(ruta==='estudiante') return vistaEstudiante(app);
  if(ruta==='docente')    return vistaDocente(app);
  if(ruta==='admin')      return vistaAdmin(app);
  return vistaPortal(app);
}
function pararTic(){ if(tic){ clearInterval(tic); tic=null; } }
function arrancarTic(){
  pararTic();
  tic=setInterval(()=>{
    if(zonaFijada) return;               /* ya firmó: no se toca la pantalla */
    refrescarZona();
    const e=estadoSesion();
    $$('[data-estado]').forEach(el=>{
      if(!el.offsetParent) return;       /* estado oculto: no se inventa */
      el.innerHTML=(e.abierto?I.clock:I.lock)+esc(e.texto);
      el.className='badge '+(e.abierto?'ok':'no');
    });
    const btn=$('#enviar');
    if(btn && !adminMode){
      btn.disabled=!e.abierto;
      const msg=$('#msg');
      if(!e.abierto && msg && !msg.textContent) msg.textContent=e.texto;
    }
    const adm=$('#abrir'), det=$('#detener'), re=$('#reiniciar');
    if(adm){
      adm.disabled=!!S.sesion.abierta;
      det.disabled=!S.sesion.abierta;
      re.disabled=!S.sesion.abierta;
    }
    const lockTxt=$('#lockMsg');
    if(lockTxt){
      const s=estaBloqueado();
      if(s>0) lockTxt.textContent='Bloqueado por intentos fallidos. Espere '+s+' s.';
      else lockTxt.textContent='';
    }
    if(adminMode){
      pintarRed();
    }
  },1000);
}

/* ---------------------------- PORTAL ------------------------- */
function vistaPortal(app){
  adminMode=false;
  app.innerHTML =
    cabecera() +
    '<div class="card portal-access">' +
      '<h2>'+I.users+'Seleccione su acceso</h2>' +
      '<p class="mut" style="margin-bottom:18px">Sistema institucional de registro de asistencia a clases.</p>' +
      '<div class="portal-grid" style="grid-template-columns:1fr 1fr 1fr;">' +
        '<button class="portal-card" id="irEst">' +
          '<span class="portal-icon" aria-hidden="true">'+I.student+'</span>' +
          '<span class="portal-text">' +
            '<h3>Estudiante</h3>' +
            '<p>Firmar la asistencia a la clase</p>' +
          '</span>' +
        '</button>' +
        '<button class="portal-card" id="irDoc">' +
          '<span class="portal-icon" aria-hidden="true">'+I.teacher+'</span>' +
          '<span class="portal-text">' +
            '<h3>Docente</h3>' +
            '<p>Consultar asistencia y firmar</p>' +
          '</span>' +
        '</button>' +
        '<button class="portal-card" id="irAdm">' +
          '<span class="portal-icon" aria-hidden="true">'+I.shield+'</span>' +
          '<span class="portal-text">' +
            '<h3>Representante</h3>' +
            '<p>Gestionar el registro y exportar el formato oficial</p>' +
          '</span>' +
        '</button>' +
      '</div>' +
    '</div>' +
    avisoLocal;
  $('#irEst').onclick=()=>{ location.hash='estudiante'; };
  $('#irDoc').onclick=()=>{ location.hash='docente'; };
  $('#irAdm').onclick=()=>{ location.hash='admin'; };
}

/* -------------------------- ESTUDIANTE ----------------------- */
function pintarTituloEstudiante(){
  const t=$('#titEst'), s=$('#subEst');
  if(!t||!s) return;
  /* Sin clave validada en ESTA sesión del navegador no se muestra ningún
     dato académico: la pantalla es completamente genérica hasta que el
     backend confirma el PIN y se aplica data.cfg. */
  const clave=S.sesion.clave||'';
  const validada=!!clave && sessionStorage.getItem(SESSION_EST)===clave;
  const badge=$('#estadoEst');
  if(!validada){
    t.textContent='Registro de asistencia';
    s.textContent='';
    if(badge) badge.parentNode.style.display='none';
    return;
  }
  const c=S.cfg;
  t.textContent=c.asignatura||'Registro de asistencia';
  s.textContent=[
    c.docente, c.nivel, c.periodo, c.codigo?('Cód. '+c.codigo):''
  ].filter(Boolean).join(' · ');
  /* Sin clave validada no hay sesión que mostrar: esconder el estado evita
     que el estudiante lea "registro cerrado" antes de conectarse. */
  if(badge){
    badge.parentNode.style.display=(clave&&sessionStorage.getItem(SESSION_EST)===clave)?'':'none';
  }
}
function vistaEstudiante(app){
  adminMode=false;
  app.innerHTML =
    cabecera('Vista del estudiante') +
    '<p class="np" style="margin-bottom:16px"><button class="s back-button" id="volver">'+I.arrowLeft+'Inicio</button></p>' +
    '<div class="card">' +
      '<h2>'+I.file+'<span id="titEst"></span></h2>' +
      '<p class="mut" id="subEst"></p>' +
      '<p><span class="badge" data-estado id="estadoEst"></span></p>' +
      '<div id="zona"></div>' +
    '</div>' +
    avisoLocal;
  $('#volver').onclick=()=>{ sessionStorage.removeItem(SESSION_EST); location.hash=''; };
  pintarTituloEstudiante();
  zonaFijada=false;
  pintarZonaEstudiante();
  arrancarTic();
}

/* ---------------------------------------------------------------
   Estado de la zona del estudiante. Se recalcula cada segundo para
   que la vista se desbloquee sola cuando el docente abre o cierra
   el registro, y para que refleje el estado que envía el docente.
   --------------------------------------------------------------- */
let zonaEstado=null, zonaFijada=false, modoRemoto=false, reintentando=false;
function estadoZona(){
  const clave=S.sesion.clave||'';
  if(!clave) return 'pedir-clave';
  if(sessionStorage.getItem(SESSION_EST)!==clave) return 'pedir-clave';
  if(sessionStorage.getItem('utch.registro.'+clave)==='1') return 'ya-registrado:'+clave;
  if(!estadoSesion().abierto) return 'cerrado:'+clave;
  return 'formulario:'+clave;
}
function refrescarZona(){
  if(zonaFijada || !$('#zona')) return;
  if(zonaEstado===estadoZona()) return;
  pintarZonaEstudiante();
}

function pintarZonaEstudiante(){
  const zona=$('#zona');
  if(!zona) return;
  zonaEstado=estadoZona();
  const est=estadoSesion();
  const clave=S.sesion.clave||'';
  const claveOk = !!clave && sessionStorage.getItem(SESSION_EST)===clave;

  /* Función auxiliar: crear botón reintentar de forma segura (máximo 1) */
  const crearRetryBtn=(contenedor,onclick)=>{
    if(!contenedor) return null;
    /* Buscar si ya existe un botón reintentar y eliminarlo */
    const existente=contenedor.querySelector('button[data-retry]');
    if(existente) existente.remove();
    /* Crear nuevo botón */
    const btn=document.createElement('button');
    btn.className='s';
    btn.style.marginLeft='10px';
    btn.setAttribute('data-retry','1');
    btn.innerHTML=I.refresh+'Reintentar';
    btn.onclick=()=>{ btn.remove(); onclick(); };
    contenedor.appendChild(btn);
    return btn;
  };

  /* 1) Pedir la clave. NUNCA se bloquea antes de esto: el estudiante
        siempre puede escribir el código que le entregó el docente,
        aunque en su dispositivo no exista ninguna clase abierta. */
  if(!claveOk){
    zona.innerHTML =
      '<label for="claveEst">Clave de acceso entregada por el docente</label>' +
      '<div class="row">' +
        '<input id="claveEst" autocapitalize="characters" autocomplete="off" maxlength="8" placeholder="Ej. 7KQ2MZ" style="letter-spacing:.15em;text-transform:uppercase;font-weight:600">' +
        '<button id="validar">'+I.key+'Validar</button>' +
      '</div>' +
      '<p class="mut" id="msgClave" role="status" style="margin-top:10px"></p>' +
      '<p class="mut">Si el docente abrió la asistencia, la clave le permite firmar ' +
      'desde este dispositivo. El registro es único: no podrá firmar dos veces.</p>';
    const validar=async valor=>{
      const v=clean(valor!=null?valor:$('#claveEst').value,8).toUpperCase();
      if(!v) return;
      const msg=$('#msgClave');
      msg.textContent='Conectando con el docente...';
      const btn=$('#validar');
      btn.disabled=true;
      try{
        /* Primero se intenta la clase abierta en ESTE dispositivo
           (modo quiosco) y, si no existe, se valida el código con la API. */
        if(S.sesion.clave && v===S.sesion.clave && !modoRemoto){
          modoRemoto=false; estadoRemotoRecibido=false;
        }else{
          modoRemoto=true; estadoRemotoRecibido=false;
          const r=await fetch('/api/sessions/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:v})});
          const data=await r.json().catch(()=>null);
          if(!r.ok||!data||!data.ok){
            throw new Error('El código no es válido o la sesión ya no está disponible.');
          }
          if(data.role!=='STUDENT'){
            throw new Error('Este código no es de estudiante. Solicite el código de estudiante al docente.');
          }
          estadoRemotoRecibido=true;
          S.sesion.abierta=true; S.sesion.inicio=Date.now(); S.sesion.minutos=0;
          S.sesion.sessionId=String(data.sessionId||'');
          sessionStorage.setItem(SESSION_API,S.sesion.sessionId);
          if(data.cfg&&typeof data.cfg==='object'){
            /* Reemplazo limpio: no conservar datos de una sesión anterior. */
            for(const k of ['facultad','programa','nivel','periodo','asignatura','codigo','docente','correo']) S.cfg[k]='';
            for(const k of ['facultad','programa','nivel','periodo','asignatura','codigo','docente','correo']){
              if(typeof data.cfg[k]==='string'&&data.cfg[k]) S.cfg[k]=clean(data.cfg[k],160);
            }
          }
        }
        sessionStorage.setItem(SESSION_EST,v);
        S.sesion.clave=v;
        pintarTituloEstudiante();
        pintarZonaEstudiante();
      }catch(err){
        modoRemoto=false;
        msg.textContent=(err&&err.message)||'No se pudo validar la clave.';
        btn.disabled=false;
        $('#claveEst').focus();
        /* Agregar botón de reintentar (máximo 1) */
        crearRetryBtn(btn.parentNode,()=>validar(v));
      }
    };
    $('#validar').onclick=()=>validar();
    $('#claveEst').onkeydown=e=>{ if(e.key==='Enter') validar(); };

    /* Si este dispositivo ya se conectó antes en esta sesión, se
       reconecta solo al docente (por ejemplo, tras recargar). */
    const guardada=sessionStorage.getItem(SESSION_EST);
    if(guardada&&!reintentando){
      reintentando=true;
      $('#claveEst').value=guardada;
      validar(guardada);
    }
    return;
  }

  /* 2) Ya firmó en esta clase */
  if(sessionStorage.getItem('utch.registro.'+clave)==='1'){
    zona.innerHTML =
      '<div class="aviso ok">'+I.shieldCheck+
        '<span><b>Su asistencia ya está registrada en esta clase.</b><br>' +
        '<span class="mut">El registro es único: no se puede firmar más de una vez.</span></span>' +
      '</div>'+
      '<p class="mut">Puede cerrar esta página.</p>';
    return;
  }

  /* 3) El docente cerró el registro */
  if(!est.abierto){
    zona.innerHTML =
      '<div class="aviso warn">'+I.alert+
        '<span>'+esc(est.texto)+' Si ya firmó, su registro quedó guardado.</span></div>' +
      '<p class="mut">Puede cerrar esta página.</p>';
    return;
  }

  /* 4) Formulario de registro */
  const conectado=modoRemoto&&!!S.sesion.sessionId;
  zona.innerHTML =
    '<div class="grid">' +
      '<div><label for="nombres">Nombres y apellidos completos *</label>' +
        '<input id="nombres" maxlength="80" autocomplete="name" placeholder="Ej. Ana María Rentería Palacios"></div>' +
      '<div><label for="ident">Número de identificación *</label>' +
        '<input id="ident" inputmode="numeric" maxlength="15" autocomplete="off" placeholder="Ej. 1076123456"></div>' +
    '</div>' +
    '<label>Firma *</label><div id="pad"></div>' +
    '<div class="aviso">'+I.shield+
      '<span><b>Tratamiento de datos personales:</b> Sus datos se envían directamente al ' +
      'dispositivo del docente durante la clase y se guardan cifrados en ese equipo. ' +
      'No se transmiten a servidores de terceros ni se venden.</span>' +
    '</div>' +
    '<p><button id="enviar">'+I.check+'Enviar asistencia</button> ' +
    '<span id="msg" class="mut" role="status"></span></p>' +
    (conectado?'<p class="mut" style="color:var(--green);font-weight:600;">✓ Conectado al docente</p>':'<p class="mut" style="color:var(--warn);font-weight:600;">⚠ Sin conexión</p>');

  pads.est=sigPad($('#pad'));

  $('#enviar').onclick=async()=>{
    const msg=$('#msg');
    const boton=$('#enviar');
    const estado=estadoSesion();
    if(!estado.abierto){ msg.textContent=estado.texto; return; }

    const nombre=clean($('#nombres').value,80);
    const ident=clean($('#ident').value,20);
    const firma=pads.est.get();

    if(nombre.length<5){ msg.textContent='Escriba sus nombres y apellidos completos.'; return; }
    if(!/^[A-Za-z0-9-]{5,20}$/.test(ident)){ msg.textContent='Número de identificación no válido (5 a 20 caracteres).'; return; }
    if(!firma){ msg.textContent='La firma es obligatoria.'; return; }

    boton.disabled=true;
    msg.textContent='Enviando...';

    /* Registro mediante API con el sessionId validado. Aplica al flujo
       remoto y también al modo quiosco cuando se conoce la sesión: así el
       registro siempre llega a PostgreSQL. Solo sin sessionId se guarda
       puramente local. */
    if(S.sesion.sessionId){
      const ctrl=new AbortController();
      const timeoutId=setTimeout(()=>ctrl.abort(),30000);
      try{
        const r=await fetch('/api/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:S.sesion.sessionId,fullName:nombre,identification:ident,studentSignature:firma}),signal:ctrl.signal});
        clearTimeout(timeoutId);
        const data=await r.json().catch(()=>null);
        if(r.ok&&data&&data.ok){ mostrarExitoEstudiante(nombre,ident); return; }
        const codeErr=data&&(data.code||data.error);
        if(codeErr==='DUPLICATE_IDENTIFICATION'){ mostrarErrorEstudiante('Esa identificación ya tiene una asistencia registrada en esta clase.'); return; }
        if(codeErr==='REGISTRATION_CLOSED'){ mostrarErrorEstudiante('Esta asistencia ya no permite nuevos registros.'); return; }
        if(codeErr==='SESSION_NOT_AVAILABLE'){ S.sesion.abierta=false; mostrarErrorEstudiante('La asistencia ya no está disponible. Solicite un nuevo código al docente.'); pintarZonaEstudiante(); return; }
        mostrarErrorEstudiante('No se pudo registrar la asistencia. Inténtelo nuevamente.');
        crearRetryBtn(boton.parentNode,()=>{ const b=$('#enviar'); if(b) b.click(); });
      }catch(e){
        clearTimeout(timeoutId);
        boton.disabled=false;
        msg.textContent='No se pudo conectar con el servidor. Verifique su conexión e inténtelo nuevamente.';
        crearRetryBtn(boton.parentNode,()=>{ const b=$('#enviar'); if(b) b.click(); });
      }
      return;
    }

    if(S.estudiantes.some(e=>e.ident===ident)){ mostrarErrorEstudiante('Esa identificación ya tiene una asistencia registrada en esta clase.'); return; }
    S.estudiantes.push({
      id:'e'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
      nombre, ident, firma, ts:Date.now()
    });
    await guardar();
    mostrarExitoEstudiante(nombre,ident);
  };
}

/* ---------------------------- DOCENTE ------------------------- */
function vistaDocente(app){
  adminMode=false;
  docenteSessionId=null; docenteInfo=null;
  app.innerHTML =
    cabecera('Acceso del docente') +
    '<p class="np" style="margin-bottom:16px"><button class="s back-button" id="volverDoc">'+I.arrowLeft+'Inicio</button></p>' +
    '<div class="card" style="max-width:520px;margin:0 auto">' +
      '<h2>'+I.teacher+'Acceso del docente</h2>' +
      '<p class="mut">Ingrese el código de asistencia proporcionado por el representante.</p>' +
      '<label for="codigoDocente">Código de asistencia</label>' +
      '<div class="row">' +
        '<input id="codigoDocente" autocapitalize="characters" autocomplete="off" maxlength="8" placeholder="Ej. D8K4P7" style="letter-spacing:.15em;text-transform:uppercase;font-weight:600">' +
        '<button id="ingresarDocente">'+I.key+'Ingresar</button>' +
      '</div>' +
      '<p class="mut" id="msgDocente" role="status" style="margin-top:10px"></p>' +
    '</div>';
  $('#volverDoc').onclick=()=>{ location.hash=''; };
  const ingresar=async()=>{
    const v=clean($('#codigoDocente').value,8).toUpperCase();
    if(!v) return;
    const msg=$('#msgDocente');
    msg.textContent='Conectando...';
    const btn=$('#ingresarDocente');
    btn.disabled=true;
    try{
      const r=await fetch('/api/sessions/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:v})});
      const data=await r.json().catch(()=>null);
      if(!r.ok||!data||!data.ok){
        throw new Error('El código no es válido o la sesión ya no está disponible.');
      }
      if(data.role!=='TEACHER'){
        throw new Error('Este código no es de docente. Solicite el código de docente al representante.');
      }
      docenteSessionId=String(data.sessionId||'');
      docenteInfo={};
      if(data.cfg&&typeof data.cfg==='object'){
        for(const k of ['facultad','programa','nivel','periodo','asignatura','codigo','docente','correo']){
          if(typeof data.cfg[k]==='string'&&data.cfg[k]) S.cfg[k]=clean(data.cfg[k],160);
        }
        for(const k of ['facultad','programa','nivel','periodo','asignatura','codigo','docente','correo','fecha']){
          docenteInfo[k]=(k==='fecha')?hoy():(typeof data.cfg[k]==='string'?data.cfg[k]:'');
        }
      }
      sessionStorage.setItem('utch.docente',v);
      mostrarVistaDocente();
    }catch(err){
      msg.textContent=(err&&err.message)||'No se pudo conectar.';
      btn.disabled=false;
      $('#codigoDocente').focus();
    }
  };
  $('#ingresarDocente').onclick=ingresar;
  $('#codigoDocente').onkeydown=e=>{ if(e.key==='Enter') ingresar(); };
}
function mostrarVistaDocente(){
  const app=$('#app');
  const c=docenteInfo||{};
  app.innerHTML =
    cabecera('Asistencia') +
    '<p class="np" style="margin-bottom:16px"><button class="s back-button" id="volverDoc2">'+I.arrowLeft+'Inicio</button></p>' +
    '<div class="card">' +
      '<h2>'+I.file+'Información de la asistencia</h2>' +
      '<div class="grid">' +
        '<div><label>Asignatura</label><p><b>'+esc(c.asignatura||'-')+'</b></p></div>' +
        '<div><label>Código</label><p><b>'+esc(c.codigo||'-')+'</b></p></div>' +
        '<div><label>Docente</label><p><b>'+esc(c.docente||'-')+'</b></p></div>' +
        '<div><label>Fecha</label><p><b>'+esc(fmtFecha(c.fecha)||'-')+'</b></p></div>' +
        '<div><label>Facultad</label><p><b>'+esc(c.facultad||'-')+'</b></p></div>' +
        '<div><label>Programa</label><p><b>'+esc(c.programa||'-')+'</b></p></div>' +
        '<div><label>Nivel</label><p><b>'+esc(c.nivel||'-')+'</b></p></div>' +
        '<div><label>Período</label><p><b>'+esc(c.periodo||'-')+'</b></p></div>' +
      '</div>' +
    '</div>' +
    '<div class="card">' +
      '<h2>'+I.users+'Estudiantes registrados (<span id="totalEst">0</span>)</h2>' +
      '<div id="hoja"></div>' +
    '</div>' +
    '<div class="card">' +
      '<h2>'+I.pencil+'Firma del docente</h2>' +
      '<div id="padDocente"></div>' +
      '<p style="margin-top:12px">' +
        '<button class="s" id="limpiarFirmaDoc">'+I.eraser+'Limpiar</button> ' +
        '<button id="confirmarFirmaDoc">'+I.check+'Confirmar firma</button>' +
        '<span id="msgFirmaDoc" class="mut" role="status" style="margin-left:10px;"></span>' +
      '</p>' +
    '</div>';
  $('#volverDoc2').onclick=()=>{ location.hash=''; };
  // Mostrar lista
  actualizarListaDocente();
  iniciarPollingApiDocente();
  // Firma
  pads.docente=sigPad($('#padDocente'));
  $('#limpiarFirmaDoc').onclick=()=>{ pads.docente.clear(); };
  $('#confirmarFirmaDoc').onclick=async()=>{
    const firma=pads.docente.get();
    if(!firma){ $('#msgFirmaDoc').textContent='Realice su firma primero.'; return; }
    if(docenteSessionId){
      $('#msgFirmaDoc').textContent='Enviando firma...';
      const ctrl=new AbortController();
      const timeoutId=setTimeout(()=>ctrl.abort(),30000);
      try{
        const r=await fetch('/api/sessions/teacher-signature',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:docenteSessionId,teacherCode:sessionStorage.getItem('utch.docente')||'',teacherSignature:firma}),signal:ctrl.signal});
        clearTimeout(timeoutId);
        const data=await r.json().catch(()=>null);
        if(r.ok&&data&&data.ok){
          S.firmaDoc=firma;
          $('#msgFirmaDoc').textContent='Firma enviada correctamente.';
          actualizarListaDocente();
          return;
        }
        if(data&&data.error==='SESSION_NOT_AVAILABLE'){ $('#msgFirmaDoc').textContent='La asistencia ya no está disponible.'; return; }
        $('#msgFirmaDoc').textContent='No se pudo enviar la firma. Inténtelo nuevamente.';
      }catch(e){
        clearTimeout(timeoutId);
        $('#msgFirmaDoc').textContent='No se pudo conectar con el servidor. Verifique su conexión e inténtelo nuevamente.';
      }
      return;
    }
    S.firmaDoc=firma;
    await guardar();
    $('#msgFirmaDoc').textContent='Firma guardada.';
  };
}
function actualizarListaDocente(){
  const total=$('#totalEst');
  if(total) total.textContent=S.estudiantes.length;
  pintarHoja();
}

/* ----------------- Docente: lista desde API ----------------- */
async function actualizarListaDocenteDesdeAPI(){
  if(!docenteSessionId) return;
  if(pollApiDocenteCtrl){ try{ pollApiDocenteCtrl.abort(); }catch(e){} }
  pollApiDocenteCtrl=new AbortController();
  const sid=docenteSessionId;
  try{
    const r=await fetch('/api/records?sessionId='+encodeURIComponent(sid)+'&teacherCode='+encodeURIComponent(sessionStorage.getItem('utch.docente')||''),{signal:pollApiDocenteCtrl.signal});
    const data=await r.json().catch(()=>null);
    if(!r.ok||!data||!data.ok||!Array.isArray(data.records)) return;
    if(docenteSessionId!==sid) return;
    S.firmaDoc=firmaSegura(data.teacherSignature||'');
    S.estudiantes=data.records.map(f=>{
      let ts=Date.parse(f.createdAt);
      if(isNaN(ts)) ts=Date.now();
      return {
        id:String(f.id||''),
        nombre:clean(f.fullName,80),
        ident:clean(f.identification,20),
        firma:firmaSegura(f.studentSignature),
        ts
      };
    }).filter(f=>f.nombre&&f.ident);
    /* Persistir la lista fresca (igual que el panel del representante)
       para que un estado antiguo no oculte registros recién recibidos. */
    guardarDiferido();
    actualizarListaDocente();
  }catch(e){ /* abort o red: se reintenta en el siguiente ciclo */ }
}
function detenerPollingApiDocente(){
  if(pollApiDocente){ clearInterval(pollApiDocente); pollApiDocente=null; }
  if(pollApiDocenteCtrl){ try{ pollApiDocenteCtrl.abort(); }catch(e){} pollApiDocenteCtrl=null; }
}
function iniciarPollingApiDocente(){
  detenerPollingApiDocente();
  if(!docenteSessionId) return;
  actualizarListaDocenteDesdeAPI();
  pollApiDocente=setInterval(()=>{
    if(!docenteSessionId){ detenerPollingApiDocente(); return; }
    actualizarListaDocenteDesdeAPI();
  },4000);
}

/* -------------------- Conexión del DOCENTE ------------------- */
/* (Migrada a API: ver ingresar() en vistaDocente y actualizarListaDocenteDesdeAPI.) */

function actualizarSelectorMaterias(){
  const select=$('#materiaSelect');
  if(!select) return;
  select.innerHTML='<option value="">Seleccione una materia</option>'+S.materias.map(materia=>
    '<option value="'+esc(materia.id)+'">'+esc(materia.datos.asignatura)+
    (materia.datos.codigo?' · '+esc(materia.datos.codigo):'')+
    (materia.horas?' · '+esc(materia.horas)+' h/sem':'')+'</option>'
  ).join('');
  select.value=S.materiaActiva;
  const boton=$('#guardarMateria');
  if(boton) boton.textContent=S.materiaActiva?'Actualizar materia':'Guardar materia';
}

/* Materias asignadas al representante (GET /api/rep/offerings).
   Reemplaza el selector local; ante fallo conserva el catálogo actual. */
async function cargarOfertasRep(){
  if(sessionStorage.getItem(SESSION_REP)!=='1') return false;
  try{
    const r=await fetch('/api/rep/offerings');
    const data=await r.json().catch(()=>null);
    if(!r.ok||!data||!data.ok||!Array.isArray(data.offerings)||!data.offerings.length) return false;
    S.materias=data.offerings.map(o=>({
      id:'api-'+o.courseOfferingId,
      datos:{
        facultad:o.facultad||'', programa:o.programa||'', nivel:o.nivel||'',
        asignatura:o.asignatura||'', codigo:o.codigo||'', periodo:o.periodo||'',
        cds:'', docente:o.docente||'', temas:''
      },
      correo:o.correo||'', horas:0,
      courseOfferingId:Number(o.courseOfferingId)||0
    }));
    if(!S.materias.some(m=>m.id===S.materiaActiva)) S.materiaActiva='';
    actualizarSelectorMaterias();
    await guardar();
    return true;
  }catch(e){ return false; }
}

/* Lista de asistencias del representante (GET /api/rep/sessions). */
async function cargarAsistenciasRep(){
  const msg=$('#msgAsistencias'), lista=$('#listaAsistencias');
  if(msg) msg.textContent='Cargando...';
  try{
    const r=await fetch('/api/rep/sessions');
    const data=await r.json().catch(()=>null);
    if(!r.ok||!data||!data.ok||!Array.isArray(data.sessions)){
      if(msg) msg.textContent='No se pudo cargar la lista.';
      return;
    }
    if(msg) msg.textContent=data.sessions.length?(''):('Sin asistencias.');
    if(!lista) return;
    lista.innerHTML=data.sessions.map(s=>
      '<div class="row" style="align-items:center;border-top:1px solid var(--line);padding:8px 0">' +
        '<div><b>'+esc(s.asignatura||'Asistencia')+'</b><br>' +
        '<span class="mut">'+esc([s.codigo,s.docente].filter(Boolean).join(' · '))+' · '+esc(s.status)+
        (s.registrationOpen?'':' · registros cerrados')+' · '+esc(String(s.recordCount))+' est.</span></div>' +
        '<button class="s" data-sid="'+esc(s.sessionId)+'">Abrir</button>' +
      '</div>'
    ).join('');
    lista.querySelectorAll('[data-sid]').forEach(b=>{
      b.onclick=()=>seleccionarAsistenciaRep(b.dataset.sid);
    });
  }catch(e){
    if(msg) msg.textContent='No se pudo conectar con el servidor.';
  }
}

/* Selecciona una asistencia propia y continúa trabajando con ella. */
async function seleccionarAsistenciaRep(sessionId){
  const msg=$('#msgAsistencias');
  try{
    const r=await fetch('/api/rep/session?sessionId='+encodeURIComponent(sessionId));
    const data=await r.json().catch(()=>null);
    if(!r.ok||!data||!data.ok||!data.session){
      if(msg) msg.textContent='No se pudo abrir la asistencia.';
      return;
    }
    const s=data.session;
    detenerPollingApi();
    repRegAbiertos=s.registrationOpen!==false;
    S.sesion.sessionId=String(s.sessionId||'');
    S.sesion.clave=String(s.studentCode||'').toUpperCase();
    S.sesion.claveDocente=String(s.teacherCode||'').toUpperCase();
    S.sesion.abierta=(s.status==='OPEN');
    S.sesion.inicio=Date.now(); S.sesion.minutos=0;
    for(const k of ['facultad','programa','nivel','periodo','asignatura','codigo','docente']){
      if(typeof s[k]==='string'&&s[k]) S.cfg[k]=clean(s[k],160);
    }
    S.firmaDoc=firmaSegura(data.session.teacherSignature||'');
    S.firmaRep=firmaSegura(data.session.representativeSignature||'');
    S.estudiantes=(Array.isArray(data.records)?data.records:[]).map(f=>{
      let ts=Date.parse(f.createdAt);
      if(isNaN(ts)) ts=Date.now();
      return {id:String(f.id||''),nombre:clean(f.fullName,80),ident:clean(f.identification,20),firma:firmaSegura(f.studentSignature),ts};
    }).filter(f=>f.nombre&&f.ident);
    await guardar();
    refrescarPanel();
    if(S.sesion.abierta) iniciarPollingApi();
    if(msg) msg.textContent='Asistencia cargada.';
    window.scrollTo(0,0);
  }catch(e){
    if(msg) msg.textContent='No se pudo conectar con el servidor.';
  }
}

async function confirmarCambioAsistencia(){
  if(S.sesion.abierta){
    await uiAlert({kind:'warn',title:'Registro abierto',message:'Cierre el registro de asistencia antes de cambiar la materia o la fecha.'});
    return false;
  }
  if(S.estudiantes.length && !(await uiConfirm({
    title:'Cambiar materia o fecha',
    message:'La lista actual contiene '+S.estudiantes.length+' asistencias. Exporte el reporte antes de cambiar la materia o la fecha. ¿Desea borrarla y continuar?'
  }))) return false;
  detenerPollingApi();
  S.estudiantes=[];
  S.sesion.clave='';
  S.sesion.sessionId='';
  S.sesion.inicio=0;
  repRegAbiertos=true;
  return true;
}

/* ---------------------------- ADMIN -------------------------- */
function vistaAdmin(app){
  if(sessionStorage.getItem(SESSION_REP)!=='1') return loginAdmin(app);
  adminMode=true;
  const c=S.cfg;
  const campo=(k,t,ty='text')=>
    '<div><label for="f_'+k+'">'+esc(t)+'</label>' +
    '<input id="f_'+k+'" type="'+ty+'" data-k="'+k+'" value="'+esc(c[k]||'')+'" maxlength="160"></div>';

  app.innerHTML =
    cabecera('Panel del docente') +
    '<p class="np" style="margin-bottom:16px">' +
      '<button class="s back-button" id="salir">'+I.lock+'Cerrar sesión</button>' +
    '</p>' +

    '<div class="card np">' +
      '<h2>'+I.file+'Materia</h2>' +
      '<label for="materiaSelect">Seleccionar materia guardada</label>' +
      '<div class="row">' +
        '<select id="materiaSelect"><option value="">Seleccione una materia</option></select>' +
        '<button class="s" id="nuevaMateria">Nueva materia</button>' +
        '<button id="guardarMateria">Guardar materia</button>' +
      '</div>' +
      '<p class="mut" id="materiaMsg" role="status" style="margin-top:10px">Seleccione una materia para cargar sus datos, o cree una nueva.</p>' +
      '<div class="grid">' +
        campo('facultad','Facultad') +
        campo('programa','Programa') +
        campo('nivel','Nivel') +
        campo('asignatura','Asignatura') +
        campo('codigo','Código de asignatura') +
        campo('periodo','Periodo académico') +
        campo('cds','CDS') +
        campo('docente','Nombre y apellidos del docente') +
        '<div><label for="f_correo">Correo del docente</label>' +
          '<input id="f_correo" data-k="correo" maxlength="160" value="'+esc(c.correo||'')+'"></div>' +
        '<div><label for="f_horas">Horas semanales</label>' +
          '<input id="f_horas" data-k="horas" type="number" min="0" max="20" value="'+esc(c.horas||'')+'"></div>' +
        '<div class="w"><label for="f_temas">Temas tratados</label>' +
          '<textarea id="f_temas" data-k="temas" maxlength="800" rows="2">'+esc(c.temas||'')+'</textarea></div>' +
      '</div>' +
      '<p class="mut" style="margin-top:14px">El logo institucional es fijo: <b>logo.png</b></p>' +
    '</div>' +

    '<div class="card np">' +
      '<h2>'+I.clock+'Ventana de asistencia</h2>' +
      '<p class="mut">Abra la ventana solo durante la clase. Los estudiantes necesitan la clave para poder firmar.</p>' +
      '<div class="row" style="margin-top:14px">' +
        '<div><label for="min">Duración</label><select id="min">' +
          '<option value="0">Sin límite (hasta detener)</option>' +
          '<option value="5">5 minutos</option>' +
          '<option value="10">10 minutos</option>' +
          '<option value="15">15 minutos</option>' +
          '<option value="20">20 minutos</option>' +
          '<option value="30">30 minutos</option>' +
          '<option value="45">45 minutos</option>' +
        '</select></div>' +
        '<button id="abrir">'+I.play+'Abrir registro</button>' +
        '<button class="s" id="reiniciar">'+I.refresh+'Reiniciar</button>' +
        '<button class="d" id="detener">'+I.stop+'Cerrar</button>' +
      '</div>' +
      '<p style="margin:16px 0 8px"><span class="badge" data-estado></span></p>' +
      '<div class="aviso" id="red" style="margin:10px 0 16px"></div>' +
      '<div class="row">' +
        '<div><label for="clave">Clave de acceso para estudiantes</label>' +
          '<input id="clave" readonly aria-label="Clave de acceso"></div>' +
        '<button class="s" id="copiar">'+I.copy+'Copiar clave</button>' +
        '<button class="s" id="nuevaClave">'+I.key+'Generar nueva</button>' +
      '</div>' +
      '<div class="row" style="margin-top:10px;">' +
        '<div><label for="claveDocente">Clave de acceso para docente (firma)</label>' +
          '<input id="claveDocente" readonly aria-label="Clave de acceso docente"></div>' +
        '<button class="s" id="copiarDocente">'+I.copy+'Copiar clave</button>' +
      '</div>' +
      '<div class="row" style="margin-top:10px;">' +
        '<span id="estadoReg" class="mut" role="status"></span> ' +
        '<button class="s" id="bloquearReg">No permitir más registros</button>' +
      '</div>' +
    '</div>' +

    '<div class="card np">' +
      '<h2>'+I.clock+'Datos de esta asistencia</h2>' +
      '<div class="grid">' +
        campo('fecha','Fecha','date') +
        campo('hora','Hora de inicio','time') +
      '</div>' +
    '</div>' +

    '<div class="card np">' +
      '<h2>'+I.pencil+'Firmas del docente y del representante</h2>' +
      '<div class="row" style="align-items:start">' +
        '<div><label>Firma del docente</label><div id="padDoc"></div>' +
          '<p style="margin-top:12px"><button id="saveDoc">'+I.check+'Guardar firma</button> ' +
          '<button class="d" id="delDoc">'+I.trash+'Quitar</button></p></div>' +
        '<div><label>Firma del representante de clase</label><div id="padRep"></div>' +
          '<p style="margin-top:12px"><button id="saveRep">'+I.check+'Guardar firma</button> ' +
          '<button class="d" id="delRep">'+I.trash+'Quitar</button></p></div>' +
      '</div>' +
    '</div>' +

    '<div class="card np">' +
      '<h2>'+I.database+'Exportar y respaldar</h2>' +
      '<div class="row">' +
        '<button id="pdf">'+I.print+'Exportar a PDF / Imprimir</button>' +
        '<button class="s" id="json">'+I.download+'Respaldo JSON</button>' +
        '<button class="s" id="csv">'+I.download+'Exportar CSV</button>' +
      '</div>' +
      '<label for="importFile">Importar respaldo JSON</label>' +
      '<input type="file" id="importFile" accept="application/json,.json">' +
      '<hr style="border:0;border-top:1px solid var(--line);margin:22px 0 18px">' +
      '<h2 style="color:var(--bad);border-color:transparent">'+I.trash+'Zona de riesgo</h2>' +
      '<p class="mut">Una vez exportado el reporte, puede borrar las materias, firmas y asistencias de este dispositivo. La contraseña de administrador se conserva.</p>' +
      '<div class="row" style="margin-top:12px">' +
        '<button class="d" id="wipe">'+I.trash+'Borrar registros locales</button>' +
      '</div>' +
    '</div>' +

    '<div class="card np">' +
      '<h2>'+I.database+'Mis asistencias</h2>' +
      '<p class="mut">Asistencias creadas por este representante.</p>' +
      '<p><button class="s" id="verAsistencias">'+I.refresh+'Ver asistencias</button> ' +
      '<span id="msgAsistencias" class="mut" role="status"></span></p>' +
      '<div id="listaAsistencias"></div>' +
    '</div>' +

    '<h2 class="np" style="margin:26px 0 12px;font-size:1.05rem">Vista previa del formato oficial</h2>' +
    '<div class="aviso np" id="avisoHoja" style="margin:0 0 12px"></div>' +
    '<div class="wrap"><div id="hoja"></div></div>';

  $('#salir').onclick=async()=>{
    detenerPollingApi();
    try{
      await fetch('/api/rep/logout',{method:'POST'});
    }catch(e){}
    sessionStorage.removeItem(SESSION_REP);
    adminMode=false; location.hash='';
  };

  actualizarSelectorMaterias();
  cargarOfertasRep();
  $('#verAsistencias').onclick=()=>cargarAsistenciasRep();
  $('#materiaSelect').onchange=async e=>{
    const id=e.target.value;
    const materia=S.materias.find(item=>item.id===id);
    if(!materia || id===S.materiaActiva){ e.target.value=S.materiaActiva; return; }
    if(!(await confirmarCambioAsistencia())){ e.target.value=S.materiaActiva; return; }
    S.materiaActiva=id;
    /* Cargar datos comunes (se aplican a todas las asignaturas) */
    S.cfg.facultad=DATOS_COMUNES.facultad;
    S.cfg.programa=DATOS_COMUNES.programa;
    S.cfg.nivel=DATOS_COMUNES.nivel;
    S.cfg.periodo=DATOS_COMUNES.periodo;
    /* Cargar datos específicos de la materia */
    for(const k of MATERIA_CAMPOS){
      if(k==='facultad'||k==='programa'||k==='nivel'||k==='periodo') continue; /* Ya cargados */
      S.cfg[k]=materia.datos[k]||'';
      const input=$('#f_'+k);
      if(input) input.value=materia.datos[k]||'';
    }
    /* Cargar datos comunes en los campos */
    const facultadInput=$('#f_facultad');
    const programaInput=$('#f_programa');
    const nivelInput=$('#f_nivel');
    const periodoInput=$('#f_periodo');
    if(facultadInput) facultadInput.value=DATOS_COMUNES.facultad;
    if(programaInput) programaInput.value=DATOS_COMUNES.programa;
    if(nivelInput) nivelInput.value=DATOS_COMUNES.nivel;
    if(periodoInput) periodoInput.value=DATOS_COMUNES.periodo;
    /* Cargar correo y horas (campos adicionales) */
    S.cfg.correo=materia.correo||'';
    S.cfg.horas=materia.horas||'';
    const correoInput=$('#f_correo');
    const horasInput=$('#f_horas');
    if(correoInput) correoInput.value=materia.correo||'';
    if(horasInput) horasInput.value=materia.horas||'';
    const detalleDocente=[materia.correo,materia.horas?materia.horas+' horas semanales':''].filter(Boolean).join(' · ');
    $('#materiaMsg').textContent='Materia cargada. Para esta asistencia, indique la fecha y la hora de inicio.'+
      (detalleDocente?' '+detalleDocente+'.':'');
    await guardar();
    pintarHoja();
  };
  $('#nuevaMateria').onclick=async()=>{
    if(!(await confirmarCambioAsistencia())) return;
    S.materiaActiva='';
    for(const k of MATERIA_CAMPOS){
      S.cfg[k]='';
      const input=$('#f_'+k);
      if(input) input.value='';
    }
    S.cfg.correo='';
    S.cfg.horas='';
    const correoInput=$('#f_correo');
    const horasInput=$('#f_horas');
    if(correoInput) correoInput.value='';
    if(horasInput) horasInput.value='';
    actualizarSelectorMaterias();
    $('#materiaMsg').textContent='Complete los datos y pulse Guardar materia.';
    await guardar();
    pintarHoja();
  };
  $('#guardarMateria').onclick=async()=>{
    const datos={};
    for(const k of MATERIA_CAMPOS){
      const valor=$('#f_'+k).value;
      datos[k]=k==='temas'?cleanMulti(valor,800):clean(valor,160);
    }
    if(!datos.asignatura){
      $('#materiaMsg').textContent='Escriba el nombre de la asignatura antes de guardar.';
      $('#f_asignatura').focus();
      return;
    }
    /* Obtener correo y horas */
    const correo=$('#f_correo').value.trim();
    const horas=parseInt($('#f_horas').value)||0;
    let materia=S.materias.find(item=>item.id===S.materiaActiva);
    if(materia){
      materia.datos=datos;
      materia.correo=correo;
      materia.horas=horas;
    } else {
      const id='m'+Date.now().toString(36)+Math.random().toString(36).slice(2,10);
      materia={id,datos,correo,horas};
      S.materias.push(materia);
      S.materiaActiva=id;
    }
    for(const k of MATERIA_CAMPOS) S.cfg[k]=datos[k];
    S.cfg.correo=correo;
    S.cfg.horas=horas;
    actualizarSelectorMaterias();
    $('#materiaMsg').textContent='Materia guardada. En adelante puede seleccionarla y completar solo la fecha y la hora.';
    await guardar();
    pintarHoja();
  };

  $$('[data-k]').forEach(inp=>{
    inp.addEventListener('input',()=>{
      const k=inp.dataset.k;
      if(k==='fecha') return;
      if(k==='temas') S.cfg[k]=cleanMulti(inp.value,800);
      else if(k==='horas') S.cfg[k]=parseInt(inp.value)||0;
      else S.cfg[k]=clean(inp.value,160);
      pintarHoja(); guardarDiferido();
    });
  });

  $('#f_fecha').addEventListener('change',async e=>{
    const fecha=e.target.value;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha===S.cfg.fecha) return;
    if(!(await confirmarCambioAsistencia())){ e.target.value=S.cfg.fecha; return; }
    S.cfg.fecha=fecha;
    await guardar();
    pintarHoja();
  });

  $('#min').value=String(S.sesion.minutos||0);
  $('#min').onchange=e=>{ S.sesion.minutos=+e.target.value||0; guardarDiferido(); };
  $('#abrir').onclick=async()=>{
    const btnAbrir=$('#abrir');
    if(btnAbrir) btnAbrir.disabled=true;
    const materiaAbierta=S.materias.find(item=>item.id===S.materiaActiva);
    const ofertaAbierta=materiaAbierta&&Number(materiaAbierta.courseOfferingId)||0;
    if(!ofertaAbierta){
      redMensaje='Seleccione una asignatura válida antes de abrir la asistencia.';
      pintarRed();
      if(btnAbrir) btnAbrir.disabled=false;
      return;
    }
    try{
      /* Crear la asistencia en el servidor: los códigos los genera la API. */
      const r=await fetch('/api/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({courseOfferingId:ofertaAbierta})});
      const data=await r.json().catch(()=>null);
      if(!r.ok||!data||!data.ok||!data.session||!data.session.id||!data.session.studentCode||!data.session.teacherCode){
        throw new Error('api');
      }
      S.sesion.abierta=true; S.sesion.inicio=Date.now();
      S.sesion.sessionId=String(data.session.id);
      S.sesion.clave=String(data.session.studentCode).toUpperCase();
      S.sesion.claveDocente=String(data.session.teacherCode).toUpperCase();
      repRegAbiertos=true;
      redMensaje='';
      await guardar(); refrescarPanel();
      iniciarPollingApi();
    }catch(e){
      redMensaje='No se pudo crear la asistencia en el servidor. Verifique su conexión e inténtelo nuevamente.';
      pintarRed();
      if(btnAbrir) btnAbrir.disabled=false;
    }
  };
  $('#reiniciar').onclick=async()=>{
    if(!S.sesion.abierta) return;
    S.sesion.inicio=Date.now(); await guardar(); refrescarPanel();
    pintarRed();
  };
  $('#detener').onclick=async()=>{
    if(cierreEnCurso) return;
    if(!(await uiConfirm({kind:'danger',title:'Cerrar asistencia definitivamente',okText:'Sí, cerrar',message:'¿Deseas cerrar definitivamente esta asistencia?\n\nDespués de cerrarla:\n- no se podrán registrar nuevos estudiantes;\n- el docente ya no podrá firmar;\n- la asistencia quedará disponible para consulta durante 24 horas;\n- posteriormente será eliminada automáticamente.'}))) return;
    cierreEnCurso=true;
    const detBtn=$('#detener'); if(detBtn) detBtn.disabled=true;
    try{
      const sid=S.sesion.sessionId||'';
      if(sid){
        let r=null, data=null;
        try{
          r=await fetch('/api/sessions/close',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:sid})});
          data=await r.json().catch(()=>null);
        }catch(e){ r=null; data=null; }
        if(!r||!r.ok||!data||!data.ok){
          const codeErr=data&&data.error;
          /* Sesión ya cerrada/inexistente en el servidor: se continúa con el
             cierre local para dejar un estado consistente. */
          if(!(codeErr==='SESSION_ALREADY_CLOSED'||codeErr==='SESSION_NOT_FOUND')){
            redMensaje='No se pudo cerrar la asistencia en el servidor. Verifique su conexión e inténtelo nuevamente.';
            pintarRed();
            return;
          }
        }
      }
      detenerPollingApi();
      S.sesion.abierta=false;
      S.sesion.clave='';           // Invalida código estudiantes
      S.sesion.claveDocente='';    // Invalida código docente
      S.sesion.sessionId='';
      repRegAbiertos=true;
      S.sesion.inicio=0;
      S.estudiantes=[];
      S.firmaDoc='';
      S.firmaRep='';
      if(pads.doc) pads.doc.clear();
      if(pads.rep) pads.rep.clear();
      await guardar();
      refrescarPanel();
      await espera(900);
      pintarRed();
    }finally{
      cierreEnCurso=false;
    }
  };
  $('#nuevaClave').onclick=async()=>{
    detenerPollingApi();
    const btnNueva=$('#nuevaClave'); if(btnNueva) btnNueva.disabled=true;
    const materiaNueva=S.materias.find(item=>item.id===S.materiaActiva);
    const ofertaNueva=materiaNueva&&Number(materiaNueva.courseOfferingId)||0;
    if(!ofertaNueva){
      redMensaje='Seleccione una asignatura válida antes de generar una nueva asistencia.';
      pintarRed();
      if(btnNueva) btnNueva.disabled=false;
      iniciarPollingApi();
      return;
    }
    try{
      const sidViejo=S.sesion.sessionId||'';
      if(sidViejo){
        try{
          await fetch('/api/sessions/close',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:sidViejo})});
        }catch(e){}
      }
      const r=await fetch('/api/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({courseOfferingId:ofertaNueva})});
      const data=await r.json().catch(()=>null);
      if(!r.ok||!data||!data.ok||!data.session||!data.session.id||!data.session.studentCode||!data.session.teacherCode){
        throw new Error('api');
      }
      S.sesion.sessionId=String(data.session.id);
      S.sesion.clave=String(data.session.studentCode).toUpperCase();
      S.sesion.claveDocente=String(data.session.teacherCode).toUpperCase();
      repRegAbiertos=true;
      redMensaje='';
      await guardar(); refrescarPanel();
      iniciarPollingApi();
    }catch(e){
      redMensaje='No se pudo generar una nueva asistencia en el servidor. Verifique su conexión e inténtelo nuevamente.';
      pintarRed();
      iniciarPollingApi();
    }
  };
  $('#copiar').onclick=async()=>{
    const b=$('#copiar');
    try{ await navigator.clipboard.writeText(S.sesion.clave||''); b.innerHTML=I.check+'Copiada'; }
    catch(e){ b.innerHTML=I.copy+'Seleccione y copie'; }
    setTimeout(()=>{ b.innerHTML=I.copy+'Copiar clave'; },1800);
  };
  $('#copiarDocente').onclick=async()=>{
    const b=$('#copiarDocente');
    try{ await navigator.clipboard.writeText(S.sesion.claveDocente||''); b.innerHTML=I.check+'Copiada'; }
    catch(e){ b.innerHTML=I.copy+'Seleccione y copie'; }
    setTimeout(()=>{ b.innerHTML=I.copy+'Copiar clave'; },1800);
  };
  $('#bloquearReg').onclick=async()=>{
    const sid=S.sesion.sessionId||'';
    if(!sid||!S.sesion.abierta) return;
    if(!(await uiConfirm({kind:'warn',title:'Impedir nuevos registros',okText:'Sí, impedir',message:'¿Deseas impedir nuevos registros de estudiantes?\nLos estudiantes que ya están registrados permanecerán en la asistencia. El docente todavía podrá ingresar y firmar.'}))) return;
    const b=$('#bloquearReg'); if(b) b.disabled=true;
    try{
      const r=await fetch('/api/rep/sessions/'+encodeURIComponent(sid)+'/block-registration',{method:'POST'});
      const data=await r.json().catch(()=>null);
      if(r.ok&&data&&data.ok){
        repRegAbiertos=!((data.session&&data.session.registrationOpen)===false);
      }
    }catch(e){}
    if(b) b.disabled=false;
    pintarEstadoReg();
    actualizarListaDesdeAPI();
  };

  pads.doc=sigPad($('#padDoc'));
  pads.rep=sigPad($('#padRep'));
  if(S.firmaDoc) pads.doc.set(S.firmaDoc);
  if(S.firmaRep) pads.rep.set(S.firmaRep);
  $('#saveDoc').onclick=async()=>{ const g=pads.doc.get(); if(g){ S.firmaDoc=g; await guardar(); pintarHoja(); } };
  $('#delDoc').onclick=async()=>{ S.firmaDoc=''; pads.doc.clear(); await guardar(); pintarHoja(); };
  $('#saveRep').onclick=async()=>{ const g=pads.rep.get(); if(g){ S.firmaRep=g; await guardar(); pintarHoja(); } };
  $('#delRep').onclick=async()=>{ S.firmaRep=''; pads.rep.clear(); await guardar(); pintarHoja(); };

  $('#pdf').onclick=()=>{
    tituloPDF=document.title;
    document.title='Asistencia_'+fmtFecha(S.cfg.fecha||hoy());
    prepararImpresion().then(()=>setTimeout(()=>{ ajustarHojaUnaPagina(); window.print(); },60));
  };
  $('#json').onclick=()=>{
    const data=JSON.stringify({
      app:'UTCH Registro de Asistencia', version:2,
      exportado:new Date().toISOString(), ...S
    },null,2);
    descargar('respaldo_asistencia_'+(S.cfg.codigo||'clase')+'_'+(S.cfg.fecha||hoy())+'.json',
      new Blob([data],{type:'application/json'}));
  };
  $('#csv').onclick=()=>{
    const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const lineas=['No.,Nombre,Identificación,Hora de registro'];
    S.estudiantes.forEach((f,i)=>lineas.push(
      [i+1,q(f.nombre),q(f.ident),q(new Date(f.ts).toLocaleTimeString())].join(',')
    ));
    descargar('asistencia_'+(S.cfg.codigo||'clase')+'_'+(S.cfg.fecha||hoy())+'.csv',
      new Blob(['\ufeff'+lineas.join('\n')],{type:'text/csv;charset=utf-8'}));
  };
  $('#importFile').onchange=e=>{
    const f=e.target.files&&e.target.files[0];
    if(!f) return;
    const r=new FileReader();
    r.onload=async()=>{
      try{
        const o=JSON.parse(r.result);
        if(!o||typeof o!=='object'||!Array.isArray(o.estudiantes)) throw new Error('formato');
        if(!(await uiConfirm({title:'Importar respaldo',message:'¿Reemplazar los datos actuales por el contenido del respaldo?'}))) return;
        S=normalizar(o); await guardar(); render();
        await uiAlert({kind:'success',title:'Respaldo importado',message:'Respaldo importado correctamente.'});
      }catch(err){ await uiAlert({kind:'error',title:'Respaldo no válido',message:'El archivo no es un respaldo válido.'}); }
    };
    r.readAsText(f); e.target.value='';
  };

  $('#wipe').onclick=async()=>{
    if(!(await uiConfirm({kind:'danger',title:'Borrar todo',okText:'Sí, continuar',message:'Esto borrará DEFINITIVAMENTE todas las materias, firmas y asistencias de este dispositivo. ¿Continuar?'}))) return;
    const t=await uiPrompt({title:'Confirmar borrado',message:'Escriba BORRAR (en mayúsculas) para confirmar:',okText:'Borrar todo',placeholder:'BORRAR'});
    if(t!=='BORRAR') return;
    detenerPollingApi();
    [DATA_STORE,KEY_STORE].forEach(k=>localStorage.removeItem(k));
    sessionStorage.removeItem(SESSION_REP);
    sessionStorage.removeItem(SESSION_EST);
    S=DEFAULTS(); await guardar();
    await uiAlert({kind:'success',title:'Datos eliminados',message:'Todos los datos locales han sido eliminados.'});
    adminMode=false; location.hash=''; render();
  };

  refrescarPanel();
  arrancarTic();
  iniciarPollingApi();
}

/* ----------------- Representante: lista desde API -----------------
   Fuente de verdad PostgreSQL. Un solo intervalo, sin duplicados. */
async function actualizarListaDesdeAPI(){
  if(!adminMode||!S.sesion.sessionId) return;
  if(pollApiCtrl){ try{ pollApiCtrl.abort(); }catch(e){} }
  pollApiCtrl=new AbortController();
  const sid=S.sesion.sessionId;
  try{
    const r=await fetch('/api/records?sessionId='+encodeURIComponent(sid),{signal:pollApiCtrl.signal});
    const data=await r.json().catch(()=>null);
    if(!r.ok||!data||!data.ok||!Array.isArray(data.records)) return;
    if(!adminMode||S.sesion.sessionId!==sid) return;
    if(typeof data.registrationOpen === 'boolean') repRegAbiertos=data.registrationOpen;
    S.firmaDoc=firmaSegura(data.teacherSignature||'');
    S.estudiantes=data.records.map(f=>{
      let ts=Date.parse(f.createdAt);
      if(isNaN(ts)) ts=Date.now();
      return {
        id:String(f.id||''),
        nombre:clean(f.fullName,80),
        ident:clean(f.identification,20),
        firma:firmaSegura(f.studentSignature),
        ts
      };
    }).filter(f=>f.nombre&&f.ident);
    /* Persistir la lista fresca para que focus/storage (sincronizar) no
       revierta a una versión antigua sin los registros recién recibidos. */
    guardarDiferido();
    pintarHoja();
    pintarEstadoReg();
  }catch(e){ /* abort o red: se reintenta en el siguiente ciclo */ }
}
function detenerPollingApi(){
  if(pollApi){ clearInterval(pollApi); pollApi=null; }
  if(pollApiCtrl){ try{ pollApiCtrl.abort(); }catch(e){} pollApiCtrl=null; }
}
function iniciarPollingApi(){
  detenerPollingApi();
  if(!adminMode||!S.sesion.abierta||!S.sesion.sessionId) return;
  actualizarListaDesdeAPI();
  pollApi=setInterval(()=>{
    if(!adminMode||!S.sesion.abierta||!S.sesion.sessionId){ detenerPollingApi(); return; }
    actualizarListaDesdeAPI();
  },4000);
}

function pintarEstadoReg(){
  const txt=$('#estadoReg'), btn=$('#bloquearReg');
  if(txt) txt.textContent=!S.sesion.sessionId ? '' : (!S.sesion.abierta ? 'Asistencia cerrada.' : (repRegAbiertos?'Registros permitidos.':'Registros cerrados.'));
  if(btn){
    btn.disabled=!S.sesion.abierta||!S.sesion.sessionId||!repRegAbiertos;
    btn.textContent=repRegAbiertos?'No permitir más registros':'Registros cerrados';
  }
}
function refrescarPanel(){
  const el=$('#clave');
  if(el) el.value=S.sesion.clave||'Sin generar';
  const elDoc=$('#claveDocente');
  if(elDoc) elDoc.value=S.sesion.claveDocente||'Sin generar';
  const abrir=$('#abrir'), det=$('#detener'), re=$('#reiniciar');
  if(abrir){
    abrir.disabled=!!S.sesion.abierta;
    det.disabled=!S.sesion.abierta;
    re.disabled=!S.sesion.abierta;
  }
  const b=$('#copiar');
  if(b) b.disabled=!S.sesion.clave;
  const bDoc=$('#copiarDocente');
  if(bDoc) bDoc.disabled=!S.sesion.claveDocente;
  const e=estadoSesion();
  $$('[data-estado]').forEach(x=>{
    x.innerHTML=(e.abierto?I.clock:I.lock)+esc(e.texto);
    x.className='badge '+(e.abierto?'ok':'no');
  });
  pintarRed();
  pintarHoja();
  pintarEstadoReg();
}

/* ============================================================
   LOGIN ADMIN — Solo ingreso, el PIN ya está en el código
   ============================================================ */
/* ---------------- Ruta administrativa (representantes) ---------------- */
let adminSecret=null;
function vistaRutaAdmin(app){
  adminMode=false;
  let ofs=[], listaReps=[], cats={periodos:[],niveles:[],grupos:[],asignaturas:[],docentes:[]},
      filt={periodoId:'',nivelId:'',q:''};
  app.innerHTML =
    cabecera('Administración') +
    '<p class="mut" style="text-align:center;margin-bottom:16px">Representantes y ofertas académicas</p>' +
    '<div class="card adm-wrap">' +
      '<h2>'+I.lock+'Administración de representantes</h2>' +
      '<div id="admLogin">' +
        '<label for="admSecret">Clave administrativa</label>' +
        '<div class="row">' +
          '<input id="admSecret" type="password" maxlength="256" autocomplete="off">' +
          '<button id="admEntrar">'+I.key+'Entrar</button>' +
        '</div>' +
        '<p class="mut" id="admMsg" role="status" style="margin-top:10px"></p>' +
      '</div>' +
      '<div id="admPanel" hidden>' +
        '<div class="adm-sec">' +
          '<div class="adm-sec-head"><h3>Representantes</h3><span class="count" id="admRepCount">0</span></div>' +
          '<p class="adm-sec-sub">Cuentas con acceso de representante y sus ofertas asignadas.</p>' +
          '<div class="adm-toolbar"><button id="admNuevoRep">+ Nuevo representante</button></div>' +
          '<div class="adm-rep-grid" id="admLista"></div>' +
        '</div>' +
        '<hr class="adm-sep">' +
        '<div class="adm-sec">' +
          '<div class="adm-sec-head"><h3>Ofertas académicas</h3><span class="count" id="admOfCount">0</span></div>' +
          '<p class="adm-sec-sub">Catálogo en PostgreSQL (período → nivel → ofertas). Crear aquí nuevas ofertas y asignarlas a representantes.</p>' +
          '<div class="adm-toolbar"><button id="admNuevaOf">+ Crear oferta académica</button></div>' +
          '<div class="adm-filtros">' +
            '<div><label for="admFPer">Período</label><select id="admFPer"><option value="">Todos</option></select></div>' +
            '<div><label for="admFNiv">Nivel</label><select id="admFNiv"><option value="">Todos</option></select></div>' +
            '<div><label for="admFQ">Buscar</label><input id="admFQ" maxlength="60" placeholder="Nombre o código" autocomplete="off"></div>' +
          '</div>' +
          '<div id="admOfertas"></div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div id="admModal"></div>';
  const headers=()=>({'Content-Type':'application/json','x-admin-secret':adminSecret||''});
  const api=async(url,opt)=>{
    const r=await fetch(url,Object.assign({headers:headers()},opt||{}));
    const data=await r.json().catch(()=>null);
    if(!r.ok||!data||!data.ok) throw new Error((data&&data.error)||('http-'+r.status));
    return data;
  };
  const nombreOf=o=>(o.asignatura||('Oferta '+o.courseOfferingId));
  const nombreNivel=n=>(n?(n+' SEMESTRE'):'—');
  const pintarFiltros=()=>{
    const perOpts=cats.periodos.length?cats.periodos:Array.from(new Map(ofs.filter(o=>o.periodoId).map(o=>[o.periodoId,o.periodo])).entries()).map(([id,nombre])=>({id,nombre}));
    const nivOpts=cats.niveles.length?cats.niveles:Array.from(new Map(ofs.filter(o=>o.nivelId).map(o=>[o.nivelId,o.nivel])).entries()).map(([id,nombre])=>({id,nombre}));
    $('#admFPer').innerHTML='<option value="">Todos</option>'+perOpts.map(p=>'<option value="'+p.id+'"'+(String(filt.periodoId)===String(p.id)?' selected':'')+'>'+esc(p.nombre)+'</option>').join('');
    $('#admFNiv').innerHTML='<option value="">Todos</option>'+nivOpts.map(p=>'<option value="'+p.id+'"'+(String(filt.nivelId)===String(p.id)?' selected':'')+'>'+esc(p.nombre)+'</option>').join('');
    if($('#admFQ')&&$('#admFQ').value!==filt.q) $('#admFQ').value=filt.q;
  };
  const ofsFiltradas=()=>{
    const q=filt.q.trim().toLowerCase();
    return ofs.filter(o=>
      (!filt.periodoId||String(o.periodoId)===String(filt.periodoId)) &&
      (!filt.nivelId||String(o.nivelId)===String(filt.nivelId)) &&
      (!q||(o.asignatura||'').toLowerCase().includes(q)||(o.codigo||'').toLowerCase().includes(q))
    );
  };
  const tarjetaOferta=(o,checkHtml)=>{
    return '<div class="adm-card">' +
      '<div class="adm-of-top"><p class="adm-of-name">'+esc(nombreOf(o))+'</p><span class="adm-code">'+esc(o.codigo||'—')+'</span></div>' +
      '<p class="adm-of-meta">'+(o.docente?esc(o.docente):'<span class="mut">Sin docente asignado</span>')+'</p>' +
      '<p class="adm-of-meta">'+esc(o.grupo?('Grupo '+o.grupo):'Grupo —')+(o.programa?' · '+esc(o.programa):'')+'</p>' +
      '<p class="adm-of-id">Oferta #'+o.courseOfferingId+'</p>' +
      (checkHtml||'') +
    '</div>';
  };
  const pintarOfertas=()=>{
    const lista=ofsFiltradas();
    const cnt=$('#admOfCount'); if(cnt) cnt.textContent=String(lista.length);
    const grupos={};
    lista.forEach(o=>{
      const k=(o.periodo||'—')+'|||'+(o.nivel||'—');
      (grupos[k]=grupos[k]||[]).push(o);
    });
    const keys=Object.keys(grupos).sort();
    $('#admOfertas').innerHTML=keys.length?keys.map(k=>{
      const per=grupos[k][0].periodo||'—', niv=grupos[k][0].nivel;
      return '<div class="adm-grupo">'+esc(per)+' <span class="n">· '+esc(nombreNivel(niv))+' · '+grupos[k].length+' oferta(s)</span></div>'+
        '<div class="adm-grid">'+grupos[k].map(tarjetaOferta).join('')+'</div>';
    }).join(''):'<p class="mut" style="margin-top:12px">Sin ofertas para este filtro.</p>';
  };
  const pintarReps=()=>{
    const porId={}; ofs.forEach(o=>{porId[o.courseOfferingId]=o;});
    const cnt=$('#admRepCount'); if(cnt) cnt.textContent=String(listaReps.length);
    $('#admLista').innerHTML=listaReps.length?listaReps.map(p=>{
      const ids=(p.courseOfferingIds||[]);
      const det=ids.map(id=>porId[id]?porId[id].asignatura+' ('+porId[id].codigo+')':('Oferta '+id));
      const resumen=det.slice(0,3).join(' · ')+(det.length>3?' <b>+'+(det.length-3)+' más</b>':'');
      return '<div class="adm-rep-card">' +
        '<div class="adm-rep-head"><p class="adm-rep-name">'+esc(p.name)+'</p>' +
        '<span class="adm-badge'+(p.active?' on':'')+'">'+(p.active?'ACTIVO':'INACTIVO')+'</span></div>' +
        '<p class="adm-rep-user">'+esc(p.username)+'</p>' +
        '<p class="adm-rep-count">'+ids.length+' oferta(s) asignada(s)</p>' +
        (det.length?'<p class="adm-rep-list">'+resumen+'</p>':'<p class="adm-rep-list">Sin ofertas asignadas.</p>') +
        '<div class="adm-rep-actions"><button class="s" data-edit="'+esc(p.id)+'">Editar</button> ' +
        '<button class="s" data-act="'+esc(p.id)+'">'+(p.active?'Desactivar':'Activar')+'</button></div>' +
      '</div>';
    }).join(''):'<p class="mut">Sin representantes.</p>';
  };
  const recargar=async()=>{
    const [dR,dO]=await Promise.all([
      api('/api/admin/representatives'),
      api('/api/admin/offerings')
    ]);
    ofs=dO.offerings||[];
    listaReps=dR.representatives||[];
    if(dO.catalogs) cats=dO.catalogs;
    pintarFiltros(); pintarOfertas(); pintarReps();
  };
  const modal=(titulo,cuerpo,onAceptar)=>{
    const m=$('#admModal');
    m.innerHTML='<div class="adm-modal"><div class="box"><h2>'+titulo+'</h2><div id="admMBody">'+cuerpo+'</div>' +
      '<p style="margin-top:14px"><button id="admMOk">Guardar</button> <button class="s" id="admMCancel">Cancelar</button> ' +
      '<span id="admMMsg" class="mut" role="status"></span></p></div></div>';
    m.querySelector('.adm-modal').onclick=e=>{ if(e.target.classList.contains('adm-modal')) m.innerHTML=''; };
    $('#admMCancel').onclick=()=>{ m.innerHTML=''; };
    $('#admMOk').onclick=onAceptar;
  };
  const modalOfertas=(sel)=>{
    const grupos={};
    ofs.forEach(o=>{
      const k=(o.periodo||'—')+'|||'+(o.nivel||'—');
      (grupos[k]=grupos[k]||[]).push(o);
    });
    const keys=Object.keys(grupos).sort();
    return keys.map(k=>{
      const per=grupos[k][0].periodo||'—', niv=grupos[k][0].nivel;
      return '<div class="adm-grupo">'+esc(per)+' <span class="n">· '+esc(nombreNivel(niv))+'</span></div>'+
        '<div class="adm-grid">'+grupos[k].map(o=>
          '<div class="adm-card'+(sel.has(o.courseOfferingId)?' sel':'')+'" data-card="'+o.courseOfferingId+'">' +
            '<label class="pick"><input type="checkbox" data-of value="'+o.courseOfferingId+'"'+(sel.has(o.courseOfferingId)?' checked':'')+'>' +
            '<span><b>'+esc(nombreOf(o))+'</b><br><span class="mut">'+esc(o.codigo||'')+(o.docente?' · '+esc(o.docente):'')+'</span></span></label>' +
          '</div>'
        ).join('')+'</div>';
    }).join('')||'<p class="mut">Sin ofertas.</p>';
  };
  $('#admEntrar').onclick=async()=>{
    adminSecret=$('#admSecret').value;
    $('#admSecret').value='';
    const m=$('#admMsg');
    try{
      await recargar();
      m.textContent='';
      $('#admPanel').hidden=false;
    }catch(e){
      adminSecret=null;
      m.textContent='Clave incorrecta o sin conexión.';
    }
  };
  $('#admFPer').onchange=e=>{ filt.periodoId=e.target.value; pintarOfertas(); };
  $('#admFNiv').onchange=e=>{ filt.nivelId=e.target.value; pintarOfertas(); };
  $('#admFQ').oninput=e=>{ filt.q=e.target.value; pintarOfertas(); };
  $('#admNuevaOf').onclick=()=>abrirModalOferta();
  $('#admNuevoRep').onclick=()=>abrirModalRep(null);
  async function abrirModalOferta(){
    const perOpts=cats.periodos.length?cats.periodos:Array.from(new Map(ofs.filter(o=>o.periodoId).map(o=>[o.periodoId,o.periodo])).entries()).map(([id,nombre])=>({id,nombre}));
    const nivOpts=cats.niveles.length?cats.niveles:Array.from(new Map(ofs.filter(o=>o.nivelId).map(o=>[o.nivelId,o.nivel])).entries()).map(([id,nombre])=>({id,nombre}));
    const gruposDe=(perId,nivId)=>cats.grupos.filter(g=>(!perId||String(g.periodoId)===String(perId))&&(!nivId||String(g.nivelId)===String(nivId)));
    modal('Crear oferta académica',
      '<div class="grid">' +
      '<div class="w"><label>Asignatura existente (opcional: si la elige, se reutiliza; si no, complete nombre y código nuevos)</label><select id="mSub">'+
        '<option value="">— Nueva asignatura —</option>'+cats.asignaturas.map(s=>'<option value="'+s.id+'">'+esc(s.codigo+' · '+s.nombre)+'</option>').join('')+'</select></div>' +
      '<div><label>Nombre de la asignatura *</label><input id="mNombre" maxlength="160" placeholder="Ej. BASES DE DATOS"></div>' +
      '<div><label>Código *</label><input id="mCodigo" maxlength="40" autocomplete="off" placeholder="Ej. 2720808" style="text-transform:uppercase"></div>' +
      '<div><label>Período académico *</label><select id="mPeriodo">'+perOpts.map(p=>'<option value="'+p.id+'">'+esc(p.nombre)+'</option>').join('')+'</select></div>' +
      '<div><label>Nivel / semestre *</label><select id="mNivel">'+nivOpts.map(n=>'<option value="'+n.id+'">'+esc(n.nombre)+'</option>').join('')+'</select></div>' +
      '<div><label>Grupo</label><select id="mGrupo"></select></div>' +
      '<div><label>Docente (opcional)</label><select id="mDocente"><option value="">— Sin asignar —</option>'+cats.docentes.map(d=>'<option value="'+d.id+'">'+esc(d.nombre)+'</option>').join('')+'</select></div>' +
      '</div><p class="mut" style="margin-top:10px">La oferta se guarda en PostgreSQL (subjects → curriculum_subjects → course_offerings) y devuelve su ID real. Si el grupo no existe para período+nivel, se crea automáticamente.</p>',
      async()=>{
        const m=$('#admMMsg');
        try{
          const subId=Number($('#mSub').value)||0;
          const periodoId=Number($('#mPeriodo').value)||0;
          const nivelId=Number($('#mNivel').value)||0;
          const grupoId=Number($('#mGrupo').value)||0;
          const docenteUserId=Number($('#mDocente').value)||0;
          const cuerpo=subId
            ? {subjectId:subId,periodoId,nivelId}
            : {nombre:$('#mNombre').value,codigo:$('#mCodigo').value,periodoId,nivelId};
          if(grupoId) cuerpo.groupId=grupoId;
          if(docenteUserId) cuerpo.docenteUserId=docenteUserId;
          const r=await fetch('/api/admin/offerings',{method:'POST',headers:headers(),body:JSON.stringify(cuerpo)});
          const data=await r.json().catch(()=>null);
          if(!r.ok||!data||!data.ok){
            const e=data&&data.error;
            m.textContent=e==='SUBJECT_CODE_EXISTS'?'Ese código ya existe: elija la asignatura existente en la lista.'
              :e==='NO_GROUP_FOR_COMBINATION'?'No hay grupo para esa combinación.'
              :e==='OFFERING_NOT_AVAILABLE'?'Oferta no disponible.'
              :'No se pudo crear ('+(e||('http-'+r.status))+').';
            return;
          }
          $('#admModal').innerHTML='';
          await recargar();
          if(data.duplicated) await uiAlert({kind:'info',title:'Oferta existente',message:'Esa oferta ya existía. Se muestra su ID real: '+data.offering.courseOfferingId});
          else await uiAlert({kind:'success',title:'Oferta creada',message:'Oferta creada. ID real: '+data.offering.courseOfferingId});
        }catch(e){ m.textContent='No se pudo conectar.'; }
      });
    const refrescarGrupos=()=>{
      const perId=$('#mPeriodo')?$('#mPeriodo').value:'', nivId=$('#mNivel')?$('#mNivel').value:'';
      const gs=gruposDe(perId,nivId);
      const sel=$('#mGrupo');
      if(sel) sel.innerHTML='<option value="">Automático</option>'+gs.map(g=>'<option value="'+g.id+'">'+esc(g.nombre+(g.periodo?' · '+g.periodo:'')+(g.nivel?' · '+g.nivel:''))+'</option>').join('');
    };
    const subSel=$('#mSub');
    const syncSub=()=>{
      const esNueva=!subSel.value;
      $('#mNombre').disabled=!esNueva; $('#mCodigo').disabled=!esNueva;
    };
    if(subSel){ subSel.onchange=syncSub; syncSub(); }
    $('#mPeriodo').onchange=refrescarGrupos; $('#mNivel').onchange=refrescarGrupos;
    refrescarGrupos();
  }
  async function abrirModalRep(rep){
    const sel=new Set(rep?(rep.courseOfferingIds||[]):[]);
    modal(rep?'Editar representante':'Nuevo representante',
      '<div class="grid">' +
      '<div><label>Nombre *</label><input id="mRepName" maxlength="120" value="'+esc(rep?rep.name:'')+'"></div>' +
      '<div><label>Usuario *</label><input id="mRepUser" maxlength="160" autocomplete="off" value="'+esc(rep?rep.username:'')+'"'+(rep?' disabled':'')+'></div>' +
      (rep?'':'<div><label>Contraseña (mín. 8) *</label><input id="mRepPass" type="password" maxlength="256" autocomplete="new-password"></div>') +
      '</div><div style="margin-top:14px"><b>Ofertas académicas</b><p class="mut">Seleccione las tarjetas. Se guardan en attendance_representative_offerings.</p><div id="mRepOfs">'+modalOfertas(sel)+'</div></div>',
      async()=>{
        const msg=$('#admMMsg');
        const ids=Array.from(document.querySelectorAll('#mRepOfs input[data-of]:checked')).map(i=>Number(i.value));
        try{
          if(!rep){
            const r=await fetch('/api/admin/representatives',{method:'POST',headers:headers(),body:JSON.stringify({name:$('#mRepName').value,username:$('#mRepUser').value,password:$('#mRepPass').value,courseOfferingIds:ids,active:true})});
            const data=await r.json().catch(()=>null);
            if(!r.ok||!data||!data.ok){ msg.textContent=data&&data.error==='USERNAME_EXISTS'?'El usuario ya existe.':'No se pudo crear ('+((data&&data.error)||('http-'+r.status))+').'; return; }
          }else{
            const r=await fetch('/api/admin/representatives',{method:'PATCH',headers:headers(),body:JSON.stringify({id:rep.id,courseOfferingIds:ids})});
            const data=await r.json().catch(()=>null);
            if(!r.ok||!data||!data.ok){ msg.textContent='No se pudo guardar ('+((data&&data.error)||('http-'+r.status))+').'; return; }
          }
          $('#admModal').innerHTML='';
          await recargar();
        }catch(e){ msg.textContent='No se pudo conectar.'; }
      });
    $('#mRepOfs').addEventListener('change',e=>{
      const box=e.target.closest('input[data-of]');
      if(!box) return;
      const card=e.target.closest('[data-card]');
      if(card) card.classList.toggle('sel',box.checked);
    });
    $('#mRepOfs').addEventListener('click',e=>{
      const card=e.target.closest('[data-card]');
      if(!card||e.target.tagName==='INPUT') return;
      const box=card.querySelector('input[data-of]');
      if(box){ box.checked=!box.checked; card.classList.toggle('sel',box.checked); }
    });
  }
  $('#admLista').addEventListener('click',async e=>{
    const b=e.target.closest('[data-edit],[data-act]');
    if(!b) return;
    if(b.dataset.edit){
      const rep=listaReps.find(x=>x.id===b.dataset.edit);
      if(rep) abrirModalRep(rep);
      return;
    }
    if(b.dataset.act){
      const rep=listaReps.find(x=>x.id===b.dataset.act);
      b.disabled=true;
      try{
        const r=await fetch('/api/admin/representatives',{method:'PATCH',headers:headers(),body:JSON.stringify({id:b.dataset.act,active:!(rep&&rep.active)})});
        if(r.ok){ await recargar(); }
      }catch(err){}
      b.disabled=false;
    }
  });
}

function loginAdmin(app){
  adminMode=false;

  app.innerHTML =
    cabecera('Acceso del docente') +
    '<p class="np" style="margin-bottom:16px"><button class="s back-button" id="volver">'+I.arrowLeft+'Inicio</button></p>' +
    '<div class="card" style="max-width:520px;margin:0 auto">' +
      '<h2>'+I.lock+'Acceso restringido</h2>' +
      '<label for="repUser">Usuario del representante</label>' +
      '<input id="repUser" maxlength="64" autocomplete="username" style="margin-bottom:10px">' +
      '<label for="repPass">Contraseña</label>' +
      '<div class="row">' +
        '<input id="repPass" type="password" maxlength="128" autocomplete="current-password" style="letter-spacing:.1em">' +
        '<button id="entrar">'+I.key+'Entrar</button>' +
      '</div>' +
      '<p class="mut" id="pinMsg" role="status" style="margin-top:12px"></p>' +
      '<p class="mut" id="lockMsg" role="status" style="color:var(--bad);font-weight:600"></p>' +
      '<p class="mut">Tras <b>'+MAX_INTENTOS+' intentos fallidos</b>, el acceso se bloquea 5 minutos.</p>' +
    '</div>';

  $('#volver').onclick=()=>{ location.hash=''; };

  const entrar=async()=>{
    const msg=$('#pinMsg');
    const s=estaBloqueado();
    if(s>0){ msg.textContent='Bloqueado. Espere '+s+' s.'; return; }
    const u=$('#repUser').value.trim();
    const v=$('#repPass').value;
    if(!u||!v){ msg.textContent='Ingrese su usuario y contraseña.'; $('#repUser').focus(); return; }
    msg.textContent='Verificando...';
    $('#entrar').disabled=true;
    try{
      const r=await fetch('/api/rep/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:v})});
      const data=await r.json().catch(()=>null);
      if(!r.ok||!data||!data.ok){
        throw new Error('Usuario o contraseña incorrectos.');
      }
      const m=await fetch('/api/rep/me');
      const me=await m.json().catch(()=>null);
      if(!m.ok||!me||!me.ok){
        throw new Error('No se pudo confirmar la sesión.');
      }
      limpiarFallos();
      sessionStorage.setItem(SESSION_REP,'1'); render();
    } catch(err) {
      const o=registrarFallo();
      if(o.until && o.until>Date.now()){
        msg.textContent='Demasiados intentos fallidos. Bloqueado 5 minutos.';
      } else {
        msg.textContent=(err&&err.message)||'Usuario o contraseña incorrectos. Intento '+o.n+' de '+MAX_INTENTOS+'.';
      }
      $('#repPass').value='';
      $('#entrar').disabled=false; $('#repUser').focus();
    }
  };
  $('#entrar').onclick=entrar;
  $('#repUser').onkeydown=e=>{ if(e.key==='Enter') entrar(); };
  $('#repPass').onkeydown=e=>{ if(e.key==='Enter') entrar(); };
  $('#repUser').focus();
}

/* ------------------- Hoja institucional ---------------------- */
/* Réplica del formato oficial F-GCA-24 (Legal, una sola hoja). */
const PIE_INSTITUCIONAL='pie-utch.jpg';
/* Alto útil de una hoja Legal con los márgenes de impresión (8.5in x 14in) */
const ALTO_HOJA_PX=(14*25.4-12)*96/25.4*0.99;   /* con margen de seguridad */
const FILA_MIN=12, FILA_MAX=42;                /* alto de fila: encoge, nunca desaparece */
const ZOOM_MIN=0.70;                           /* reducción máxima, aún legible */
/* La hoja oficial debe salir SIEMPRE en una sola página. Se busca el mayor
   alto de fila que, junto con la parte fija (encabezado, datos, firmas y
   pie), cabe en la Legal reducing lo mínimo. */
function ajustarHojaUnaPagina(){
  const h=$('#hoja');
  if(!h) return 1;
  const limite=ALTO_HOJA_PX;
  h.style.zoom='1';                              /* neutraliza el zoom de pantalla */
  const cuerpo=$('#hoja tbody.filas');
  const n=cuerpo?cuerpo.rows.length:0;
  const alto=()=>h.getBoundingClientRect().height;
  const fila=a=>h.style.setProperty('--fila',a+'px');
  if(!n||!alto()){ h.style.removeProperty('--fila'); h.style.removeProperty('zoom'); return 1; }

  fila(FILA_MAX);
  if(alto()<=limite){ h.style.removeProperty('zoom'); return 1; }   /* cabe y queda fiel */

  const fijo=alto()-n*FILA_MAX;                  /* parte que no depende de las filas */
  const caben=Math.floor((limite/ZOOM_MIN-fijo)/n);
  fila(Math.max(FILA_MIN,Math.min(FILA_MAX,caben)));
  let z=1;                                        /* ajuste final por si sobra borde */
  for(let i=0;i<5 && alto()>limite;i++){
    z=Math.max(.4,z*limite/alto());
    h.style.zoom=String(z);
  }
  if(z>=1){ h.style.removeProperty('zoom'); return 1; }
  return z;
}
/* Las imágenes deben estar cargadas antes de medir: si el pie mide 0,
   la hoja se calcularía corta y se imprimiría en dos páginas. */
function esperarImagenes(){
  const ims=$$('#hoja img');
  return Promise.all(ims.map(im=>im.complete&&im.naturalWidth
    ? Promise.resolve()
    : new Promise(r=>{ im.onload=im.onerror=()=>r(); setTimeout(r,2500); })));
}
function prepararImpresion(){
  pintarHoja();
  return esperarImagenes().then(ajustarHojaUnaPagina);
}
function precargarImagenes(){
  [LOGO_SRC,PIE_INSTITUCIONAL].forEach(src=>{
    const im=new Image(); im.src=src;
  });
}
function avisoHoja(){
  const el=$('#avisoHoja');
  if(!el) return;
  const n=S.estudiantes.length;
  if(n>=36){
    el.innerHTML=I.alert+'<span>Hay <b>'+n+'</b> asistencias. Para que todo quepa en <b>una sola hoja</b> ' +
      'las filas se imprimen más estrechas. Si la legibilidad es prioridad, exporte además el CSV.</span>';
    el.className='aviso warn np';
  } else {
    el.innerHTML=I.check+'<span>Todo el registro cabe en <b>una sola hoja</b> tamaño Legal, ' +
      'igual que el formato oficial. Ya hay <b>'+n+'</b> asistencia(s) registrada(s).</span>';
    el.className='aviso ok np';
  }
}
function pintarHoja(){
  const h=$('#hoja');
  if(!h) return;
  h.innerHTML=hojaHTML();
  h.querySelectorAll('[data-del]').forEach(b=>{
    b.onclick=async()=>{
      if(!(await uiConfirm({kind:'danger',title:'Eliminar registro',okText:'Sí, eliminar',message:'¿Eliminar este registro de asistencia?'}))) return;
      S.estudiantes=S.estudiantes.filter(x=>x.id!==b.dataset.del);
      await guardar(); pintarHoja();
    };
  });
  avisoHoja();
}

function hojaHTML(){
  const c=S.cfg;
  const logoSrc = LOGO_SRC;   /* 🔒 SIEMPRE logo.png */
  const total=Math.max(12,Math.min(60,S.estudiantes.length+1));
  const etiqueta=(t,v)=>'<td class="lbl">'+t+'</td><td>'+esc(v)+'</td>';
  let filas='';
  for(let i=0;i<total;i++){
    const f=S.estudiantes[i];
    const del=adminMode&&f?' <button class="del np" data-del="'+esc(f.id)+'" title="Eliminar registro">'+I.x+'</button>':'';
    filas+='<tr>' +
      '<td class="n">'+(i+1)+'.</td>' +
      '<td>'+(f?esc(f.nombre)+del:'')+'</td>' +
      '<td class="id">'+(f?esc(f.ident):'')+'</td>' +
      '<td class="f">'+(f&&f.firma?'<img src="'+esc(f.firma)+'" alt="Firma">':'')+'</td>' +
    '</tr>';
  }
  return '' +
  /* Encabezado institucional (idéntico al del documento Word) */
  '<table class="enc"><tr>' +
    '<td style="width:16%;padding:0 4px 0 0"><img src="'+esc(logoSrc)+'" alt="Universidad Tecnológica del Chocó" style="max-height:52px;width:auto"></td>' +
    '<td class="inst">' +
      'UNIVERSIDAD TECNOLÓGICA DEL CHOCÓ<br>' +
      '<span class="sub">Diego Luis Córdoba</span><br>' +
      '<span class="pro">PROCESO GESTIÓN CURRICULAR Y ACADÉMICA</span>' +
    '</td>' +
    '<td class="meta" style="width:16%;text-align:right">Código: F-GCA-24<br>Versión: 1<br>Fecha: 14-01-2023</td>' +
  '</tr></table>' +

  '<div class="tit">Formato de Registro de Asistencia a Clases</div>' +

  /* Datos de la clase */
  '<table>' +
    '<tr><td class="lbl">FACULTAD</td><td style="width:16%">'+esc(c.facultad)+'</td><td class="lbl">PROGRAMA</td><td colspan="3">'+esc(c.programa)+'</td></tr>' +
    '<tr>'+etiqueta('NIVEL',c.nivel)+etiqueta('ASIGNATURA',c.asignatura)+etiqueta('CÓDIGO DE ASIGNATURA',c.codigo)+'</tr>' +
    '<tr>'+etiqueta('PERIODO ACADÉMICO',c.periodo)+etiqueta('CDS',c.cds)+etiqueta('FECHA',fmtFecha(c.fecha)+(c.hora?' · '+c.hora:''))+'</tr>' +
    '<tr><td class="lbl">NOMBRE Y APELLIDOS DEL DOCENTE</td><td colspan="5">'+esc(c.docente)+'</td></tr>' +
    '<tr><td class="lbl">TEMAS TRATADOS</td><td colspan="5" class="temas">'+esc(c.temas)+'</td></tr>' +
  '</table>' +

  /* Listado de estudiantes */
  '<table style="margin-top:4px">' +
    '<tr>' +
      '<th style="width:5%">No.</th>' +
      '<th style="width:47%">NOMBRES Y APELLIDOS DEL ESTUDIANTE</th>' +
      '<th style="width:22%">NÚMERO DE IDENTIFICACIÓN</th>' +
      '<th style="width:26%">FIRMA</th>' +
    '</tr>' +
    '<tbody class="filas">' +
  filas +
  '</tbody>' +
  '</table>' +

  /* Firmas - con espacio mínimo garantizado después de la tabla */
  '<div class="pie" style="margin-top:96px;break-inside:avoid;page-break-inside:avoid;">' +
    '<div>'+(S.firmaDoc?'<img src="'+esc(S.firmaDoc)+'" alt="Firma del docente">':'')+'FIRMA DEL DOCENTE</div>' +
    '<div>'+(S.firmaRep?'<img src="'+esc(S.firmaRep)+'" alt="Firma del representante">':'')+'FIRMA DEL REPRESENTANTE</div>' +
  '</div>' +

  /* Control de cambios - con espacio y sin partirse entre páginas */
  '<div class="cc" style="margin-top:20px;break-inside:avoid;page-break-inside:avoid;">CONTROL DE CAMBIOS</div>' +
  '<table class="ctl" style="break-inside:avoid;page-break-inside:avoid;">' +
    '<tr><th style="width:20%">FECHA</th><th>CAMBIO</th><th style="width:15%">VERSIÓN</th></tr>' +
    '<tr><td>14-01-2023</td><td>Lanzamiento del formato</td><td style="text-align:center">01</td></tr>' +
  '</table>' +
  '<table class="ctl" style="margin-top:3px;break-inside:avoid;page-break-inside:avoid;"><tr>' +
    '<td class="firma"><b>Elaboró:</b> Leidy Lorena Cuesta Mena<br>Cargo: Profesional Universitario<br>Fecha: 14-01-2023</td>' +
    '<td class="firma"><b>Revisó:</b> Ana Silvia Rentería<br>Cargo: Vicerrectora de Docencia<br>Fecha: 14-01-2023</td>' +
    '<td class="firma"><b>Aprobó:</b> Tamara Mery Ketty<br>Cargo: Coordinadora de Calidad<br>Fecha: 14-01-2023</td>' +
  '</tr></table>' +

  /* Pie institucional del documento oficial */
  '<div class="pie-inst"><img src="'+esc(PIE_INSTITUCIONAL)+'" alt="Universidad Tecnológica del Chocó Diego Luis Córdoba, Nit. 891.680.009-4, Quibdó, Chocó (Colombia)"></div>';
}

/* ------------- Modal propio (reemplaza alert/confirm/prompt) -------------
   uiConfirm({title,message,okText,cancelText,kind}) -> Promise<boolean>
   uiAlert({title,message,okText,kind})               -> Promise<void>
   uiPrompt({title,message,okText,cancelText,placeholder}) -> Promise<string|null>
   kinds: info | success | error | warn | danger. Las llamadas se encolan:
   nunca hay dos modales visibles a la vez. */
const UI_TITULOS={info:'Información',success:'Éxito',error:'Error',warn:'Advertencia',danger:'Confirmación'};
let uiCola=[], uiAbierto=false, uiOverflowPrevio='';
function uiRaiz(){
  let r=$('#uiModal');
  if(!r){ r=document.createElement('div'); r.id='uiModal'; document.body.appendChild(r); }
  return r;
}
function uiMostrar(sig){
  uiAbierto=true;
  uiOverflowPrevio=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const raiz=uiRaiz();
  const esConfirm=(sig.tipo==='confirm'||sig.tipo==='prompt');
  const titulo=sig.title||UI_TITULOS[sig.kind]||UI_TITULOS.info;
  raiz.innerHTML=
    '<div class="ui-overlay" data-ui="overlay">'+
      '<div class="ui-panel ui-'+sig.kind+'" role="dialog" aria-modal="true" aria-label="'+esc(titulo)+'">'+
        '<h3 class="ui-title">'+esc(titulo)+'</h3>'+
        (sig.message?'<p class="ui-msg">'+esc(sig.message)+'</p>':'')+
        (sig.tipo==='prompt'?'<input class="ui-input" id="uiInput" maxlength="40" autocomplete="off" placeholder="'+esc(sig.placeholder||'')+'">':'')+
        '<div class="ui-actions">'+
          (esConfirm?'<button type="button" class="s" data-ui="cancel">'+esc(sig.cancelText||'Cancelar')+'</button>':'')+
          '<button type="button" data-ui="ok">'+esc(sig.okText||(esConfirm?'Aceptar':'Cerrar'))+'</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  let resuelto=false;
  const cerrar=(valor)=>{
    if(resuelto) return; resuelto=true;
    raiz.innerHTML='';
    uiAbierto=false;
    document.body.style.overflow=uiOverflowPrevio;
    sig.resolver(valor);
    if(uiCola.length) setTimeout(()=>uiMostrar(uiCola.shift()),30);
  };
  const valorOk=()=>{
    if(sig.tipo==='prompt'){
      const inp=raiz.querySelector('#uiInput');
      return inp?inp.value:'';
    }
    return sig.tipo==='confirm'?true:undefined;
  };
  const valorCancel=()=>sig.tipo==='prompt'?null:(sig.tipo==='confirm'?false:undefined);
  raiz.querySelector('[data-ui="ok"]').onclick=()=>cerrar(valorOk());
  const btnCancel=raiz.querySelector('[data-ui="cancel"]');
  if(btnCancel) btnCancel.onclick=()=>cerrar(valorCancel());
  raiz.querySelector('[data-ui="overlay"]').onclick=e=>{
    if(e.target&&e.target.getAttribute&&e.target.getAttribute('data-ui')==='overlay') cerrar(valorCancel());
  };
  raiz.querySelector('.ui-panel').onkeydown=e=>{
    if(e.key==='Escape'){ e.preventDefault(); cerrar(valorCancel()); }
    else if(e.key==='Enter'){ e.preventDefault(); cerrar(valorOk()); }
  };
  const foco=esConfirm?btnCancel:raiz.querySelector('[data-ui="ok"]');
  if(foco&&foco.focus) setTimeout(()=>{ try{ foco.focus(); }catch(_){} },30);
}
function uiEncolar(sig){
  return new Promise(resolver=>{
    const s={tipo:sig.tipo,kind:sig.kind||'info',title:sig.title,message:sig.message,
             okText:sig.okText,cancelText:sig.cancelText,placeholder:sig.placeholder,resolver};
    if(uiAbierto) uiCola.push(s); else uiMostrar(s);
  });
}
function uiConfirm(o){
  o=o||{};
  return uiEncolar({tipo:'confirm',kind:o.kind||'warn',title:o.title,message:o.message,okText:o.okText,cancelText:o.cancelText});
}
function uiAlert(o){
  o=o||{};
  return uiEncolar({tipo:'alert',kind:o.kind||'info',title:o.title,message:o.message,okText:o.okText});
}
function uiPrompt(o){
  o=o||{};
  return uiEncolar({tipo:'prompt',kind:o.kind||'danger',title:o.title,message:o.message,okText:o.okText,cancelText:o.cancelText,placeholder:o.placeholder});
}

/* --------------------------- Arranque ------------------------ */
(async function init(){
  await cargar();
  precargarImagenes();
  window.addEventListener('hashchange',render);
  /* Expandir/contraer el bloque de privacidad en móvil. */
  document.addEventListener('click',e=>{
    const b=e.target&&e.target.closest?e.target.closest('.privacy-toggle'):null;
    if(!b) return;
    const card=b.closest('.privacy-card');
    if(!card) return;
    const abierta=card.classList.toggle('open');
    b.setAttribute('aria-expanded',abierta?'true':'false');
    b.innerHTML=abierta?'Ver menos información &lt;':'Ver más información &gt;';
  });
  window.addEventListener('storage',alCambiarAlmacenamiento);
  window.addEventListener('focus',()=>{ if(!saveTimer) sincronizar(); });
  window.addEventListener('beforeprint',()=>{ if(adminMode){ pintarHoja(); ajustarHojaUnaPagina(); } });
  window.addEventListener('afterprint',()=>{ const h=$('#hoja'); if(h){ h.style.removeProperty('zoom'); h.style.removeProperty('--fila'); } if(tituloPDF){ document.title=tituloPDF; tituloPDF=null; } });
  render();
  if(!(globalThis.crypto && crypto.subtle)){
    document.body.insertAdjacentHTML('afterbegin',
      '<p class="mut np" style="text-align:center;margin:8px">Este navegador no soporta Web Crypto; ' +
      'el cifrado AES no está disponible. Use un navegador moderno.</p>');
  }
})();