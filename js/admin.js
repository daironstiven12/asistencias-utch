"use strict";
/* ============================================================
   PANEL ADMINISTRATIVO UTCH — vista /ruta-administrativa.
   Autocontenido: no depende de js/app.js. Usa los mismos
   endpoints y contratos (GET/PATCH representatives, GET/POST
   offerings) protegidos con ADMIN_SECRET (header x-admin-secret).
   La clave se guarda solo en sessionStorage (por pestaña) y se
   limpia al cerrar sesión. Nunca va incrustada en el código.
   ============================================================ */
const $a = (s, r=document) => r.querySelector(s);
const escA = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
));

const I = {
  lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  key:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  users:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  grid:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  out:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
  hist:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  doc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>',
  book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  link:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  calendar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  alert:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  refresh:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  eye:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
};

/* Iniciales y presentación (solo visual; no modifican los datos). */
function inicialesA(valor){
  const partes=String(valor||'').trim().split(/\s+/).filter(Boolean);
  if(!partes.length) return '?';
  const a=partes[0].charAt(0);
  const b=partes.length>1?partes[partes.length-1].charAt(0):'';
  return (a+b).toLocaleUpperCase('es');
}
function tituloCasoA(valor){
  return String(valor||'').toLocaleLowerCase('es')
    .replace(/(^|[\s'’.-])([a-záéíóúüñ])/g,(m,p,c)=>p+c.toLocaleUpperCase('es'));
}
function vacioA(texto){
  return '<div class="adm-empty">'+I.info+'<span class="adm-empty-t">'+escA(texto)+'</span></div>';
}
/* Cierre visual de modales (botón X). No interviene en la lógica de guardado. */
document.addEventListener('click',e=>{
  const x=e.target&&e.target.closest?e.target.closest('#admModal [data-close]'):null;
  if(!x) return;
  const m=document.getElementById('admModal');
  if(m) m.innerHTML='';
});

/* ------------- Modal propio (copia autocontenida) ------------- */
const UI_TITULOS_A={info:'Información',success:'Éxito',error:'Error',warn:'Advertencia',danger:'Confirmación'};
let uiColaA=[], uiAbiertoA=false, uiOverflowA='';
function uiMostrarA(sig){
  uiAbiertoA=true;
  uiOverflowA=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const raiz=$a('#uiModal');
  const esConfirm=(sig.tipo==='confirm'||sig.tipo==='prompt');
  const titulo=sig.title||UI_TITULOS_A[sig.kind]||UI_TITULOS_A.info;
  const uiIco=sig.kind==='success'?I.check:(sig.kind==='error'||sig.kind==='danger'||sig.kind==='warn')?I.alert:I.info;
  raiz.innerHTML=
    '<div class="ui-overlay" data-ui="overlay">'+
      '<div class="ui-panel ui-'+sig.kind+'" role="dialog" aria-modal="true" aria-label="'+escA(titulo)+'">'+
        '<div class="ui-icon" aria-hidden="true">'+uiIco+'</div>'+
        '<h3 class="ui-title">'+escA(titulo)+'</h3>'+
        (sig.message?'<p class="ui-msg">'+escA(sig.message)+'</p>':'')+
        (sig.tipo==='prompt'?'<input class="ui-input" id="uiInputA" maxlength="40" autocomplete="off" placeholder="'+escA(sig.placeholder||'')+'">':'')+
        '<div class="ui-actions">'+
          (esConfirm?'<button type="button" class="s" data-ui="cancel">'+escA(sig.cancelText||'Cancelar')+'</button>':'')+
          '<button type="button" data-ui="ok">'+escA(sig.okText||(esConfirm?'Aceptar':'Cerrar'))+'</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  let resuelto=false;
  const cerrar=(valor)=>{
    if(resuelto) return; resuelto=true;
    raiz.innerHTML='';
    uiAbiertoA=false;
    document.body.style.overflow=uiOverflowA;
    sig.resolver(valor);
    if(uiColaA.length) setTimeout(()=>uiMostrarA(uiColaA.shift()),30);
  };
  const valorOk=()=>{
    if(sig.tipo==='prompt'){
      const inp=raiz.querySelector('#uiInputA');
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
function uiEncolarA(sig){
  return new Promise(resolver=>{
    const s={tipo:sig.tipo,kind:sig.kind||'info',title:sig.title,message:sig.message,
             okText:sig.okText,cancelText:sig.cancelText,placeholder:sig.placeholder,resolver};
    if(uiAbiertoA) uiColaA.push(s); else uiMostrarA(s);
  });
}
const uiConfirmA=o=>{ o=o||{}; return uiEncolarA({tipo:'confirm',kind:o.kind||'warn',title:o.title,message:o.message,okText:o.okText,cancelText:o.cancelText}); };
const uiAlertA=o=>{ o=o||{}; return uiEncolarA({tipo:'alert',kind:o.kind||'info',title:o.title,message:o.message,okText:o.okText}); };

/* ---------------- Estado y API ---------------- */
const ADM_KEY='utch.sesion.adminSecret';
let adminSecret=sessionStorage.getItem(ADM_KEY)||'';
let ofs=[], listaReps=[], listaDoc=[], cats={periodos:[],niveles:[],grupos:[],asignaturas:[],docentes:[]};
let vista='resumen', busRep='', busOf='', filtPer='', filtNiv='', filtGrupo='';
const selDel=new Set();

function motivoBaja(reason){
  if(reason==='NOT_FOUND') return 'ya no existe';
  if(reason==='HAS_SESSIONS') return 'tiene sesiones o registros de asistencia';
  if(reason==='HAS_ASSIGNMENTS') return 'está asignada a representantes';
  return reason||'error';
}

const headers=()=>({'Content-Type':'application/json','x-admin-secret':adminSecret||''});
async function api(url,opt){
  let r;
  try{
    r=await fetch(url,Object.assign({headers:headers()},opt||{}));
  }catch(e){
    const err=new Error('sin respuesta del servidor (posible problema de conexión)');
    err.code='NETWORK';
    throw err;
  }
  const data=await r.json().catch(()=>null);
  if(!r.ok||!data||!data.ok){
    const e=new Error((data&&data.error)||('http-'+r.status));
    e.code=(data&&data.error)||null;
    e.status=r.status;
    e.detail=data&&data.detail;
    e.data=data;
    throw e;
  }
  return data;
}
async function recargar(){
  const [dR,dO,dD]=await Promise.all([
    api('/api/admin/representatives'),
    api('/api/admin/offerings'),
    api('/api/admin/docentes')
  ]);
  ofs=dO.offerings||[];
  const vivos=new Set(ofs.map(o=>o.courseOfferingId));
  for(const id of Array.from(selDel)){ if(!vivos.has(id)) selDel.delete(id); }
  listaReps=dR.representatives||[];
  listaDoc=(dD.docentes||[]).slice().sort((a,b)=>String(a.nombre||'').localeCompare(String(b.nombre||'')));
  if(dO.catalogs) cats=dO.catalogs;
}
function irLogin(mensaje){
  adminSecret='';
  try{ sessionStorage.removeItem(ADM_KEY); }catch(e){}
  renderLogin(mensaje||'');
}
const porId=()=>{ const m={}; ofs.forEach(o=>{ m[o.courseOfferingId]=o; }); return m; };
const nombreOf=o=>(o.asignatura||('Oferta '+o.courseOfferingId));

/* ---------------- Login ---------------- */
function renderLogin(mensaje){
  $a('#adminApp').innerHTML=
    '<div class="adm-login"><div class="card">'+
      '<img class="adm-login-logo" src="img/logo-v2.png" alt="Sistema de Asistencia">'+
      '<h2>'+I.lock+'Administración</h2>'+
      '<p class="adm-login-sub">Representantes y ofertas académicas.</p>'+
      '<label for="admSecret">Clave administrativa</label>'+
      '<div class="adm-pass"><input id="admSecret" type="password" maxlength="256" autocomplete="off" aria-label="Clave administrativa">'+
        '<button type="button" class="adm-pass-toggle" id="admTogglePass" aria-label="Mostrar clave" aria-pressed="false">'+I.eye+'</button></div>'+
      '<button id="admEntrar" class="adm-login-btn">'+I.key+'Entrar</button>'+
      '<div class="adm-msg-row'+(mensaje?' is-info':'')+'" id="admMsgRow"><span class="adm-msg-ico" aria-hidden="true">'+I.info+'</span>'+
        '<p class="adm-msg" id="admMsg" role="status">'+escA(mensaje||'')+'</p></div>'+
      '<p class="adm-login-foot">Acceso exclusivo para la administración del sistema.</p>'+
    '</div></div>';
  const cab=$a('#adminHeader'), pie=$a('#site-footer');
  if(cab) cab.hidden=false;
  if(typeof montarFooter==='function') montarFooter('#site-footer');
  const pass=$a('#admSecret'), ver=$a('#admTogglePass');
  ver.onclick=()=>{
    const mostrar=pass.type==='password';
    pass.type=mostrar?'text':'password';
    ver.innerHTML=mostrar?I.eyeOff:I.eye;
    ver.setAttribute('aria-label',mostrar?'Ocultar clave':'Mostrar clave');
    ver.setAttribute('aria-pressed',mostrar?'true':'false');
    pass.focus();
  };
  const entrar=async()=>{
    adminSecret=$a('#admSecret').value.trim();
    $a('#admSecret').value='';
    try{
      await recargar();
      try{ sessionStorage.setItem(ADM_KEY,adminSecret); }catch(e){}
      vista='resumen';
      renderApp();
    }catch(e){
      adminSecret='';
      const fila=$a('#admMsgRow');
      if(fila){ fila.classList.remove('is-info'); fila.classList.add('is-error'); }
      const ico=$a('#admMsgRow .adm-msg-ico');
      if(ico) ico.innerHTML=I.alert;
      $a('#admMsg').textContent=(e&&e.code==='UNAUTHORIZED')?'Clave incorrecta.':'Sin conexión con el servidor.';
    }
  };
  $a('#admEntrar').onclick=entrar;
  $a('#admSecret').onkeydown=e=>{ if(e.key==='Enter') entrar(); };
  $a('#admSecret').focus();
}

/* ---------------- Layout ---------------- */
const VISTAS=[['resumen','Resumen'],['reps','Representantes'],['docentes','Docentes'],['ofertas','Ofertas académicas'],['historial','Historial'],['nueva','Nueva oferta']];
function iconoVista(v){
  return v==='resumen'?I.home:(v==='reps'?I.users:(v==='docentes'?I.doc:(v==='historial'?I.hist:(v==='ofertas'?I.book:I.plus))));
}
function renderApp(){
  if(histTic){ clearInterval(histTic); histTic=null; }
  /* El panel con sidebar no lleva el pie público del login. */
  const cab=$a('#adminHeader'), pie=$a('#site-footer');
  if(cab) cab.hidden=true;
  if(pie){ pie.innerHTML=''; pie.hidden=true; }
  const tit=(VISTAS.find(v=>v[0]===vista)||['',''])[1];
  const navBtn=v=>'<button data-v="'+v[0]+'" class="'+(vista===v[0]?'active':'')+'">'+iconoVista(v[0])+escA(v[1])+'</button>';
  $a('#adminApp').innerHTML=
    '<div class="adm-layout" id="admLayout">'+
      '<div class="adm-scrim" id="admScrim"></div>'+
      '<aside class="adm-side" aria-label="Menú de administración">'+
        '<div class="adm-brand"><div class="adm-brand-logo"><img src="img/logo-v2.png" alt="Sistema de Asistencia"></div>'+
          '<div class="adm-brand-txt"><b>Sistema de Asistencia</b><span>Administración · UTCH</span></div></div>'+
        '<nav class="adm-nav">'+
          '<p class="adm-nav-title">General</p>'+
          VISTAS.slice(0,3).map(navBtn).join('')+
          '<p class="adm-nav-title">Académico</p>'+
          VISTAS.slice(3).map(navBtn).join('')+
          '<div class="sep"></div>'+
          '<button data-v="__salir" class="danger">'+I.out+'Cerrar sesión</button>'+
        '</nav>'+
      '</aside>'+
      '<div class="adm-main">'+
        '<header class="adm-top">'+
          '<button class="s adm-burger" id="admBurger" aria-label="Abrir menú">'+I.menu+'</button>'+
          '<div class="adm-top-txt"><div class="crumb">Administración / <span>'+escA(tit)+'</span></div>'+
            '<h1>'+escA(tit)+'</h1></div>'+
          '<div class="adm-user"><span class="adm-avatar" aria-hidden="true">AD</span>'+
            '<span class="adm-user-txt"><small>Rol</small><b>Administrador</b></span></div>'+
        '</header>'+
        '<div class="adm-body" id="admBody"></div>'+
      '</div>'+
    '</div>';
  $a('#adminApp').querySelectorAll('[data-v]').forEach(b=>{
    b.onclick=()=>{
      if(b.dataset.v==='__salir'){ irLogin('Sesión administrativa cerrada.'); return; }
      vista=b.dataset.v;
      $a('#admLayout').classList.remove('menu-open');
      renderApp();
    };
  });
  $a('#admBurger').onclick=()=>{ $a('#admLayout').classList.toggle('menu-open'); };
  $a('#admScrim').onclick=()=>{ $a('#admLayout').classList.remove('menu-open'); };
  if(vista==='resumen') vistaResumen();
  else if(vista==='reps') vistaReps();
  else if(vista==='docentes') vistaDocentes();
  else if(vista==='ofertas') vistaOfertas();
  else if(vista==='historial') vistaHistorial();
  else vistaNueva();
}

/* ---------------- Resumen ---------------- */
function vistaResumen(){
  const activos=listaReps.filter(r=>r.active).length;
  const asignaciones=listaReps.reduce((n,r)=>n+((r.courseOfferingIds||[]).length),0);
  const porPeriodo={};
  ofs.forEach(o=>{ const k=o.periodo||'—'; porPeriodo[k]=(porPeriodo[k]||0)+1; });
  const maxPer=Math.max(1,...Object.keys(porPeriodo).map(k=>porPeriodo[k]));
  $a('#admBody').innerHTML=
    '<p class="adm-sec-sub">Estado actual del sistema, calculado con datos reales de PostgreSQL.</p>'+
    '<div class="adm-stats">'+
      '<div class="adm-stat kpi-blue"><span class="adm-stat-ico" aria-hidden="true">'+I.users+'</span><div class="n">'+activos+'</div><div class="l">Representantes activos</div></div>'+
      '<div class="adm-stat kpi-teal"><span class="adm-stat-ico" aria-hidden="true">'+I.doc+'</span><div class="n">'+listaReps.length+'</div><div class="l">Representantes totales</div></div>'+
      '<div class="adm-stat kpi-navy"><span class="adm-stat-ico" aria-hidden="true">'+I.book+'</span><div class="n">'+ofs.length+'</div><div class="l">Ofertas académicas</div></div>'+
      '<div class="adm-stat kpi-green"><span class="adm-stat-ico" aria-hidden="true">'+I.link+'</span><div class="n">'+asignaciones+'</div><div class="l">Asignaciones</div></div>'+
    '</div>'+
    '<div class="adm-cols"><div class="adm-panel"><h3>'+I.calendar+'Ofertas por período</h3>'+
      (Object.keys(porPeriodo).sort().map(k=>'<div class="adm-kv"><div class="adm-kv-main"><b>'+escA(k)+'</b><span>'+porPeriodo[k]+' oferta(s)</span></div>'+
        '<div class="adm-kv-right"><span class="adm-mini" aria-hidden="true"><span style="width:'+Math.max(12,Math.round(porPeriodo[k]/maxPer*100))+'%"></span></span></div></div>').join('')||vacioA('Sin ofertas registradas.'))+
    '</div>'+
    '<div class="adm-panel"><h3>'+I.users+'Representantes</h3>'+
      (listaReps.map(r=>'<div class="adm-kv"><div class="adm-kv-main"><b>'+escA(r.name)+'</b><span>'+((r.courseOfferingIds||[]).length)+' oferta(s)</span></div>'+
        '<div class="adm-kv-right"><span class="adm-badge'+(r.active?' on':'')+'"><span class="dot"></span>'+(r.active?'ACTIVO':'INACTIVO')+'</span></div></div>').join('')||vacioA('Sin representantes registrados.'))+
    '</div></div>';
}

/* ---------------- Representantes ---------------- */
function repsFiltrados(){
  const q=busRep.trim().toLowerCase();
  if(!q) return listaReps;
  return listaReps.filter(r=>(r.name||'').toLowerCase().includes(q)||(r.username||'').toLowerCase().includes(q));
}
function vistaReps(){
  const mapa=porId();
  const lista=repsFiltrados();
  const nActivos=listaReps.filter(r=>r.active).length;
  const nInactivos=listaReps.length-nActivos;
  $a('#admBody').innerHTML=
    '<p class="adm-sec-sub">Cuentas con acceso de representante y sus ofertas asignadas.</p>'+
    '<div class="adm-toolbar"><button id="admNuevoRep">'+I.plus+' Nuevo representante</button>'+
      '<input type="search" id="admBusRep" maxlength="60" placeholder="Buscar por nombre o usuario" value="'+escA(busRep)+'" autocomplete="off">'+
      '<div class="adm-seg" role="group" aria-label="Filtrar por estado">'+
        '<input type="radio" name="admRepFiltro" id="admRepTodos" checked><label for="admRepTodos">Todos <span>'+listaReps.length+'</span></label>'+
        '<input type="radio" name="admRepFiltro" id="admRepActivos"><label for="admRepActivos">Activos <span>'+nActivos+'</span></label>'+
        '<input type="radio" name="admRepFiltro" id="admRepInactivos"><label for="admRepInactivos">Inactivos <span>'+nInactivos+'</span></label>'+
      '</div></div>'+
    '<div class="adm-rep-grid">'+
      (lista.map(p=>{
        const ids=(p.courseOfferingIds||[]);
        const det=ids.map(id=>mapa[id]?(mapa[id].asignatura+' ('+mapa[id].codigo+')'):('Oferta '+id));
        return '<article class="adm-rep-card '+(p.active?'is-active':'is-inactive')+'" data-active="'+(p.active?'1':'0')+'">'+
          '<div class="adm-rep-head"><div class="adm-rep-id">'+
            '<span class="adm-avatar" aria-hidden="true">'+escA(inicialesA(p.name))+'</span>'+
            '<div class="adm-rep-idt"><p class="adm-rep-name">'+escA(p.name)+'</p>'+
              '<p class="adm-rep-user">'+escA(p.username)+'</p></div>'+
          '</div></div>'+
          '<div class="adm-rep-meta"><p class="adm-rep-count"><b>'+ids.length+'</b> oferta(s) asignada(s)</p>'+
            '<span class="adm-badge'+(p.active?' on':'')+'"><span class="dot"></span>'+(p.active?'ACTIVO':'INACTIVO')+'</span></div>'+
          '<div class="adm-chips">'+
            (det.length
              ? det.slice(0,3).map(d=>'<span class="adm-chip" title="'+escA(d)+'">'+escA(d)+'</span>').join('')+
                (det.length>3?'<span class="adm-chip more">+'+(det.length-3)+' más</span>':'')
              : '<span class="adm-chip empty">Sin ofertas asignadas.</span>')+
          '</div>'+
          '<hr class="adm-dash">'+
          '<div class="adm-rep-actions"><button class="s" data-edit="'+escA(p.id)+'">'+I.edit+'Editar</button> '+
          '<button class="'+(p.active?'d':'btn-ok-soft')+'" data-act="'+escA(p.id)+'">'+(p.active?I.lock:I.check)+(p.active?'Desactivar':'Activar')+'</button></div>'+
        '</article>';
      }).join('')||vacioA('Sin representantes para esta búsqueda.'))+
    '</div><div id="admModal"></div>';
  $a('#admNuevoRep').onclick=()=>abrirModalRep(null);
  $a('#admBusRep').oninput=e=>{ busRep=e.target.value; vistaReps(); const b=$a('#admBusRep'); b.focus(); b.setSelectionRange(b.value.length,b.value.length); };
  $a('#admBody').querySelectorAll('[data-edit],[data-act]').forEach(b=>{
    b.onclick=async()=>{
      if(b.dataset.edit){
        const rep=listaReps.find(x=>x.id===b.dataset.edit);
        if(rep) abrirModalRep(rep);
        return;
      }
      const rep=listaReps.find(x=>x.id===b.dataset.act);
      b.disabled=true;
      try{
        await api('/api/admin/representatives',{method:'PATCH',headers:headers(),body:JSON.stringify({id:b.dataset.act,active:!(rep&&rep.active)})});
        await recargar();
        vistaReps();
      }catch(e){
        if(e&&e.code==='UNAUTHORIZED') irLogin('Sesión administrativa vencida. Ingrese de nuevo.');
        else await uiAlertA({kind:'error',title:'No se pudo guardar',message:'No se pudo cambiar el estado.'});
        vistaReps();
      }
    };
  });
}
function gruposOfertas(lista){
  const g={};
  lista.forEach(o=>{ const k=(o.periodo||'—')+'|||'+(o.nivel||'—'); (g[k]=g[k]||[]).push(o); });
  return Object.keys(g).sort().map(k=>({titulo:k.split('|||'),items:g[k]}));
}
function abrirModalRep(rep){
  const sel=new Set(rep?(rep.courseOfferingIds||[]):[]);
  const grupos=gruposOfertas(ofs);
  /* Niveles presentes en las ofertas disponibles, ordenados por número.
     El filtro solo alterna la visualización de los grupos; las casillas
     y el guardado no cambian. */
  const nivPorId={};
  ofs.forEach(o=>{
    if(o.nivelId==null||nivPorId[o.nivelId]) return;
    nivPorId[o.nivelId]={id:o.nivelId,nombre:o.nivel||('Nivel '+o.nivelId),
      numero:(o.nivelNumero==null?null:Number(o.nivelNumero))};
  });
  const niveles=Object.values(nivPorId).sort((a,b)=>
    (a.numero==null||b.numero==null)
      ? String(a.nombre).localeCompare(String(b.nombre))
      : (a.numero-b.numero));
  const idNivelGr=o=>(o&&o.nivelId!=null)?o.nivelId:'';
  $a('#admModal').innerHTML=
    '<div class="adm-modal"><div class="box"><button type="button" class="adm-modal-x" data-close aria-label="Cerrar">'+I.x+'</button><h2>'+(rep?'Editar representante':'Nuevo representante')+'</h2>'+
      '<div class="grid">'+
      '<div><label>Nombre *</label><input id="mRepName" maxlength="120" value="'+escA(rep?rep.name:'')+'"></div>'+
      '<div><label>Usuario *</label><input id="mRepUser" maxlength="160" autocomplete="off" value="'+escA(rep?rep.username:'')+'"'+(rep?' disabled':'')+'></div>'+
      (rep?'':'<div><label>Contraseña (mín. 8) *</label><input id="mRepPass" type="password" maxlength="256" autocomplete="new-password"></div>')+
      '</div><div style="margin-top:14px"><b>Ofertas académicas</b><p class="mut">Solo las asignadas aparecen marcadas; las demás siguen disponibles.</p>'+
      '<div style="margin:10px 0 4px;max-width:280px"><label for="mRepSem">Filtrar por semestre</label>'+
      '<select id="mRepSem"><option value="">Todos los semestres</option>'+
      niveles.map(n=>'<option value="'+n.id+'">'+escA(n.nombre+' semestre')+'</option>').join('')+
      '</select></div>'+
      (grupos.map(gr=>
        '<div class="adm-grupo" data-nivel="'+idNivelGr(gr.items[0])+'">'+escA(gr.titulo[0])+' <span class="n">· '+escA(gr.titulo[1]?gr.titulo[1]+' SEMESTRE':'—')+'</span></div>'+
        '<div class="adm-pick-grid" data-nivel="'+idNivelGr(gr.items[0])+'">'+gr.items.map(o=>
          '<label class="adm-pick'+(sel.has(o.courseOfferingId)?' sel':'')+'"><input type="checkbox" data-of value="'+o.courseOfferingId+'"'+(sel.has(o.courseOfferingId)?' checked':'')+'>'+
          '<span><b>'+escA(nombreOf(o))+'</b><br><span class="mut">'+escA(o.codigo||'')+(o.docente?' · '+escA(o.docente):'')+'</span></span></label>'
        ).join('')+'</div>'
      ).join('')||'<p class="mut">Sin ofertas.</p>')+
      '</div>'+
      '<div class="adm-modal-foot"><span id="admMMsg" class="adm-msg" role="status"></span>'+
      '<div class="adm-modal-actions"><button class="s" id="admMCancel">Cancelar</button><button id="admMOk">Guardar</button></div></div></div></div>';
  $a('#admModal').querySelector('.adm-modal').onclick=e=>{ if(e.target.classList.contains('adm-modal')) $a('#admModal').innerHTML=''; };
  $a('#admMCancel').onclick=()=>{ $a('#admModal').innerHTML=''; };
  $a('#mRepSem').onchange=e=>{
    const v=e.target.value;
    $a('#admModal').querySelectorAll('[data-nivel]').forEach(el=>{
      el.style.display=(!v||String(el.getAttribute('data-nivel'))===String(v))?'':'none';
    });
  };
  $a('#admModal').querySelectorAll('input[data-of]').forEach(box=>{
    box.onchange=()=>{ box.closest('.adm-pick').classList.toggle('sel',box.checked); };
  });
  $a('#admMOk').onclick=async()=>{
    const msg=$a('#admMMsg');
    const ids=Array.from($a('#admModal').querySelectorAll('input[data-of]:checked')).map(i=>Number(i.value));
    try{
      if(!rep){
        await api('/api/admin/representatives',{method:'POST',headers:headers(),body:JSON.stringify({name:$a('#mRepName').value,username:$a('#mRepUser').value,password:$a('#mRepPass').value,courseOfferingIds:ids,active:true})});
      }else{
        await api('/api/admin/representatives',{method:'PATCH',headers:headers(),body:JSON.stringify({id:rep.id,courseOfferingIds:ids})});
      }
      $a('#admModal').innerHTML='';
      await recargar();
      vistaReps();
      await uiAlertA({kind:'success',title:'Guardado',message:'Asignaciones guardadas correctamente.'});
    }catch(e){
      if(e&&e.code==='USERNAME_EXISTS') msg.textContent='El usuario ya existe.';
      else if(e&&e.code==='UNAUTHORIZED'){ $a('#admModal').innerHTML=''; irLogin('Sesión administrativa vencida. Ingrese de nuevo.'); }
      else msg.textContent='No se pudo guardar ('+((e&&e.code)||'error')+').';
    }
  };
}

/* ---------------- Docentes ---------------- */
let busDoc='', filtDocEstado='', filtDocAsig='', filtDocAsigQ='', filtDocNivel='', filtDocGrupo='', filtDocOrden='nombre', docPage=1;
const DOC_PAGE_SIZE=10;
let guardandoDoc=false, cambiandoEstadoDoc=false, eliminandoDoc=false;
function docentesFiltrados(){
  const q=busDoc.trim().toLowerCase();
  const aq=filtDocAsigQ.trim().toLowerCase();
  let lista=listaDoc.filter(d=>
    (!q||(d.nombre||'').toLowerCase().includes(q)||(d.correo||'').toLowerCase().includes(q)) &&
    (!filtDocEstado||String(d.estado||'')===filtDocEstado) &&
    (!filtDocAsig||(filtDocAsig==='con'?(d.ofertasCount||0)>0:(d.ofertasCount||0)===0)) &&
    (!aq||(d.ofertas||[]).some(o=>String(o).toLowerCase().includes(aq))) &&
    (!filtDocNivel||(d.nivelesIds||[]).map(String).includes(String(filtDocNivel))) &&
    (!filtDocGrupo||(d.gruposIds||[]).map(String).includes(String(filtDocGrupo)))
  );
  const porNombre=(a,b)=>String(a.nombre||'').localeCompare(String(b.nombre||''));
  if(filtDocOrden==='estado') lista=lista.slice().sort((a,b)=>((b.estado==='ACTIVE')-(a.estado==='ACTIVE'))||porNombre(a,b));
  else if(filtDocOrden==='ofertas') lista=lista.slice().sort((a,b)=>((b.ofertasCount||0)-(a.ofertasCount||0))||porNombre(a,b));
  else lista=lista.slice().sort(porNombre);
  return lista;
}
function vistaDocentes(){
  const total=listaDoc.length;
  const activos=listaDoc.filter(d=>d.estado==='ACTIVE').length;
  const inactivos=total-activos;
  const sinOfertas=listaDoc.filter(d=>!(d.ofertasCount>0)).length;
  const lista=docentesFiltrados();
  const pages=Math.max(1,Math.ceil(lista.length/DOC_PAGE_SIZE));
  if(docPage>pages) docPage=pages;
  const ini=(docPage-1)*DOC_PAGE_SIZE;
  const pagina=lista.slice(ini,ini+DOC_PAGE_SIZE);
  $a('#admBody').innerHTML=
    '<p class="adm-sec-sub">Gestiona el catálogo de docentes utilizado en las ofertas académicas.</p>'+
    '<div class="adm-stats">'+
      '<div class="adm-stat kpi-blue"><span class="adm-stat-ico" aria-hidden="true">'+I.doc+'</span><div class="n">'+total+'</div><div class="l">Docentes totales</div></div>'+
      '<div class="adm-stat kpi-green"><span class="adm-stat-ico" aria-hidden="true">'+I.check+'</span><div class="n">'+activos+'</div><div class="l">Activos</div></div>'+
      '<div class="adm-stat kpi-teal"><span class="adm-stat-ico" aria-hidden="true">'+I.users+'</span><div class="n">'+inactivos+'</div><div class="l">Inactivos</div></div>'+
      '<div class="adm-stat kpi-navy"><span class="adm-stat-ico" aria-hidden="true">'+I.book+'</span><div class="n">'+sinOfertas+'</div><div class="l">Sin ofertas</div></div>'+
    '</div>'+
    '<div class="adm-filters adm-filters-doc">'+
      '<div class="adm-filter-row">'+
        '<div class="adm-field adm-field-btn"><button id="admNuevoDoc">'+I.plus+' Nuevo docente</button></div>'+
        '<div class="adm-field adm-field-search"><label for="admBusDoc">Buscar</label>'+
          '<input type="search" id="admBusDoc" maxlength="60" placeholder="Buscar por nombre o correo..." value="'+escA(busDoc)+'" autocomplete="off"></div>'+
        '<div class="adm-field"><label for="admFDocEstado">Estado</label>'+
          '<select id="admFDocEstado" aria-label="Filtrar por estado"><option value="">Estado: todos</option>'+
          '<option value="ACTIVE"'+(filtDocEstado==='ACTIVE'?' selected':'')+'>Activos</option>'+
          '<option value="INACTIVE"'+(filtDocEstado==='INACTIVE'?' selected':'')+'>Inactivos</option></select></div>'+
        '<div class="adm-field"><label for="admFDocAsig">Asignación</label>'+
          '<select id="admFDocAsig" aria-label="Filtrar por asignación"><option value="">Asignación: todas</option>'+
          '<option value="con"'+(filtDocAsig==='con'?' selected':'')+'>Con ofertas</option>'+
          '<option value="sin"'+(filtDocAsig==='sin'?' selected':'')+'>Sin ofertas</option></select></div>'+
        '<div class="adm-field"><label for="admFDocAsigQ">Asignatura</label>'+
          '<input type="search" id="admFDocAsigQ" maxlength="60" placeholder="Asignatura..." value="'+escA(filtDocAsigQ)+'" autocomplete="off"></div>'+
        '<div class="adm-field"><label for="admFDocNiv">Nivel</label>'+
          '<select id="admFDocNiv" aria-label="Filtrar por nivel"><option value="">Nivel: todos</option>'+cats.niveles.map(n=>'<option value="'+n.id+'"'+(String(filtDocNivel)===String(n.id)?' selected':'')+'>'+escA(n.nombre)+'</option>').join('')+'</select></div>'+
      '</div>'+
      '<div class="adm-filter-row">'+
        '<div class="adm-field"><label for="admFDocGru">Grupo</label>'+
          '<select id="admFDocGru" aria-label="Filtrar por grupo"><option value="">Grupo: todos</option>'+cats.grupos.map(g=>'<option value="'+g.id+'"'+(String(filtDocGrupo)===String(g.id)?' selected':'')+'>'+escA(g.nombre)+'</option>').join('')+'</select></div>'+
        '<div class="adm-field"><label for="admFDocOrd">Orden</label>'+
          '<select id="admFDocOrd" aria-label="Ordenar"><option value="nombre"'+(filtDocOrden==='nombre'?' selected':'')+'>A–Z</option>'+
          '<option value="estado"'+(filtDocOrden==='estado'?' selected':'')+'>Por estado</option>'+
          '<option value="ofertas"'+(filtDocOrden==='ofertas'?' selected':'')+'>Por n.º ofertas</option></select></div>'+
        '<div class="adm-field adm-f-clear"><button class="s" id="admFLimpiar">'+I.refresh+'Limpiar filtros</button></div>'+
      '</div>'+
    '</div>'+
    '<p class="adm-result">'+lista.length+' resultado(s).</p>'+
    '<div class="adm-rep-grid">'+
      (pagina.map(d=>{
        const activo=d.estado==='ACTIVE';
        const det=(d.ofertas||[]).slice(0,3);
        return '<article class="adm-rep-card '+(activo?'is-active':'is-inactive')+'">'+
          '<div class="adm-rep-head"><div class="adm-rep-id">'+
            '<span class="adm-avatar" aria-hidden="true">'+escA(inicialesA(d.nombre))+'</span>'+
            '<div class="adm-rep-idt"><p class="adm-rep-name">'+escA(tituloCasoA(d.nombre))+'</p>'+
              '<p class="adm-rep-user">'+escA(d.correo||'Sin correo')+'</p></div>'+
          '</div></div>'+
          '<div class="adm-rep-meta"><p class="adm-rep-count"><b>'+(d.ofertasCount||0)+'</b> oferta(s) asignada(s)</p>'+
            '<span class="adm-badge'+(activo?' on':'')+'"><span class="dot"></span>'+(activo?'ACTIVO':'INACTIVO')+'</span></div>'+
          '<div class="adm-chips">'+
            (det.length
              ? det.map(o=>'<span class="adm-chip" title="'+escA(o)+'">'+escA(o)+'</span>').join('')+
                ((d.ofertas||[]).length>3?'<span class="adm-chip more">+'+((d.ofertas||[]).length-3)+' más</span>':'')
              : '<span class="adm-chip empty">Sin ofertas asignadas.</span>')+
          '</div>'+
          '<hr class="adm-dash">'+
          '<div class="adm-rep-actions"><button class="s" data-edit-doc="'+d.userId+'">'+I.edit+'Editar</button> '+
          '<button class="'+(activo?'d':'btn-ok-soft')+'" data-act-doc="'+d.userId+'">'+(activo?I.lock:I.check)+(activo?'Desactivar':'Activar')+'</button> '+
          '<button class="d" data-del-doc="'+d.userId+'">'+I.trash+'Eliminar</button></div>'+
        '</article>';
      }).join('')||vacioA('Sin docentes para estos filtros.'))+
    '</div>'+
    '<div class="adm-pag"><button class="s" id="docPrev"'+(docPage<=1?' disabled':'')+'>← Anterior</button>'+
    '<span class="mut">Página <b>'+docPage+'</b> de <b>'+pages+'</b></span>'+
    '<button class="s" id="docNext"'+(docPage>=pages?' disabled':'')+'>Siguiente →</button></div>'+
    '<div id="admModal"></div>';
  $a('#admNuevoDoc').onclick=abrirModalDoc;
  const refiltrar=()=>{ docPage=1; vistaDocentes(); };
  $a('#admBusDoc').oninput=e=>{ busDoc=e.target.value; refiltrar(); const b=$a('#admBusDoc'); b.focus(); b.setSelectionRange(b.value.length,b.value.length); };
  $a('#admFDocAsigQ').oninput=e=>{ filtDocAsigQ=e.target.value; refiltrar(); };
  $a('#admFDocEstado').onchange=e=>{ filtDocEstado=e.target.value; refiltrar(); };
  $a('#admFDocAsig').onchange=e=>{ filtDocAsig=e.target.value; refiltrar(); };
  $a('#admFDocNiv').onchange=e=>{ filtDocNivel=e.target.value; refiltrar(); };
  $a('#admFDocGru').onchange=e=>{ filtDocGrupo=e.target.value; refiltrar(); };
  $a('#admFDocOrd').onchange=e=>{ filtDocOrden=e.target.value; vistaDocentes(); };
  $a('#admFLimpiar').onclick=()=>{ busDoc=''; filtDocEstado=''; filtDocAsig=''; filtDocAsigQ=''; filtDocNivel=''; filtDocGrupo=''; filtDocOrden='nombre'; docPage=1; vistaDocentes(); };
  $a('#docPrev').onclick=()=>{ if(docPage>1){ docPage--; vistaDocentes(); } };
  $a('#docNext').onclick=()=>{ if(docPage<pages){ docPage++; vistaDocentes(); } };
  $a('#admBody').querySelectorAll('[data-edit-doc]').forEach(b=>{ b.onclick=()=>abrirModalEditarDoc(Number(b.dataset.editDoc)); });
  $a('#admBody').querySelectorAll('[data-act-doc]').forEach(b=>{ b.onclick=()=>cambiarEstadoDoc(Number(b.dataset.actDoc),b); });
  $a('#admBody').querySelectorAll('[data-del-doc]').forEach(b=>{ b.onclick=()=>eliminarDoc(Number(b.dataset.delDoc),b); });
}
function abrirModalEditarDoc(userId){
  const d=listaDoc.find(x=>Number(x.userId)===Number(userId));
  if(!d) return;
  $a('#admModal').innerHTML=
    '<div class="adm-modal"><div class="box"><button type="button" class="adm-modal-x" data-close aria-label="Cerrar">'+I.x+'</button><h2>Editar docente</h2>'+
      '<div class="grid">'+
      '<div><label>Nombre completo *</label><input id="mDocNameE" maxlength="160" value="'+escA(d.nombre||'')+'" autocomplete="off"></div>'+
      '<div><label>Correo institucional *</label><input id="mDocMailE" maxlength="160" value="'+escA(d.correo||'')+'" autocomplete="off"></div>'+
      '<div><label>Estado</label><select id="mDocEstadoE"><option value="ACTIVE"'+(d.estado==='ACTIVE'?' selected':'')+'>Activo</option><option value="INACTIVE"'+(d.estado!=='ACTIVE'?' selected':'')+'>Inactivo</option></select></div>'+
      '</div>'+
      '<p class="mut" style="margin-top:10px">No se modifican asignaciones, usuario de acceso ni contraseña.</p>'+
      '<div class="adm-modal-foot"><span id="admMMsg" class="adm-msg" role="status"></span>'+
      '<div class="adm-modal-actions"><button class="s" id="admMCancel">Cancelar</button><button id="admMOk">Guardar docente</button></div></div></div></div>';
  $a('#admModal').querySelector('.adm-modal').onclick=e=>{ if(e.target.classList.contains('adm-modal')) $a('#admModal').innerHTML=''; };
  $a('#admMCancel').onclick=()=>{ $a('#admModal').innerHTML=''; };
  $a('#admMOk').onclick=async e=>{
    if(guardandoDoc) return;
    guardandoDoc=true;
    const fin=botonCarga(e.currentTarget||$a('#admMOk'),'Guardando docente…');
    const msg=$a('#admMMsg');
    try{
      await api('/api/admin/docentes',{method:'PATCH',headers:headers(),body:JSON.stringify({userId,nombre:$a('#mDocNameE').value,correo:$a('#mDocMailE').value,estado:$a('#mDocEstadoE').value})});
      $a('#admModal').innerHTML='';
      await recargar();
      vistaDocentes();
      await uiAlertA({kind:'success',title:'Docente actualizado',message:'Los datos del docente se guardaron correctamente.'});
    }catch(err){
      if(err&&err.code==='EMAIL_EXISTS') msg.textContent='Ese correo ya pertenece a otro docente.';
      else if(err&&err.code==='UNAUTHORIZED'){ $a('#admModal').innerHTML=''; irLogin('Sesión administrativa vencida. Ingrese de nuevo.'); }
      else msg.textContent='No se pudo guardar ('+((err&&err.code)||'error')+'). Revise nombre, correo y estado.';
    }finally{
      guardandoDoc=false;
      if(fin) fin();
    }
  };
}
async function cambiarEstadoDoc(userId, btn){
  if(cambiandoEstadoDoc) return;
  const d=listaDoc.find(x=>Number(x.userId)===Number(userId));
  if(!d) return;
  const activar=d.estado!=='ACTIVE';
  if(!activar){
    const ok=await uiConfirmA({kind:'warn',title:(activar?'Activar':'Desactivar')+' docente',okText:activar?'Sí, activar':'Sí, desactivar',
      message:'¿Desea '+(activar?'activar':'desactivar')+' a '+d.nombre+' ('+(d.correo||'sin correo')+')?\nSus '+(d.ofertasCount||0)+' oferta(s) asignada(s) se conservan.'});
    if(!ok) return;
  }
  cambiandoEstadoDoc=true;
  const fin=botonCarga(btn,activar?'Activando…':'Actualizando estado…');
  try{
    await api('/api/admin/docentes',{method:'PATCH',headers:headers(),body:JSON.stringify({userId,estado:activar?'ACTIVE':'INACTIVE'})});
    await recargar();
    vistaDocentes();
  }catch(e){
    if(e&&e.code==='UNAUTHORIZED') irLogin('Sesión administrativa vencida. Ingrese de nuevo.');
    else await uiAlertA({kind:'error',title:'No se pudo cambiar el estado',message:'No se pudo actualizar ('+((e&&e.code)||'error')+').'});
  }finally{
    cambiandoEstadoDoc=false;
    if(fin) fin();
  }
}
async function eliminarDoc(userId, btn){
  if(eliminandoDoc) return;
  const d=listaDoc.find(x=>Number(x.userId)===Number(userId));
  if(!d) return;
  const ok=await uiConfirmA({kind:'danger',title:'Eliminar docente',okText:'Sí, eliminar',
    message:'Se eliminará definitivamente a '+d.nombre+' ('+(d.correo||'sin correo')+').\nEsta acción es irreversible y no toca ofertas, sesiones ni registros.'});
  if(!ok) return;
  eliminandoDoc=true;
  const fin=botonCarga(btn,'Eliminando docente…');
  try{
    await api('/api/admin/docentes',{method:'DELETE',headers:headers(),body:JSON.stringify({userId})});
    await recargar();
    vistaDocentes();
    await uiAlertA({kind:'success',title:'Docente eliminado',message:'El docente fue eliminado correctamente.'});
  }catch(e){
    if(e&&e.code==='UNAUTHORIZED') irLogin('Sesión administrativa vencida. Ingrese de nuevo.');
    else if(e&&e.code==='HAS_DEPENDENCIES'){
      await uiAlertA({kind:'warn',title:'No se puede eliminar',
        message:'El docente tiene dependencias registradas y no puede eliminarse. Como alternativa, desactívelo: sus ofertas y su historial se conservan.'});
    }
    else await uiAlertA({kind:'error',title:'No se pudo eliminar',message:'No se pudo completar la eliminación ('+((e&&e.code)||'error')+').'});
  }finally{
    eliminandoDoc=false;
    if(fin) fin();
  }
}
function abrirModalDoc(){
  $a('#admModal').innerHTML=
    '<div class="adm-modal"><div class="box"><button type="button" class="adm-modal-x" data-close aria-label="Cerrar">'+I.x+'</button><h2>Nuevo docente</h2>'+
      '<p class="mut">El docente queda como registro académico interno, sin acceso a la aplicación.</p>'+
      '<div class="grid">'+
      '<div><label>Nombre completo *</label><input id="mDocName" maxlength="160" placeholder="Ej. ARISLEYDA RENTERIA CASTRO" autocomplete="off"></div>'+
      '<div><label>Correo institucional *</label><input id="mDocMail" maxlength="160" placeholder="Ej. nombre@utch.edu.co" autocomplete="off"></div>'+
      '</div>'+
      '<div class="adm-modal-foot"><span id="admMMsg" class="adm-msg" role="status"></span>'+
      '<div class="adm-modal-actions"><button class="s" id="admMCancel">Cancelar</button><button id="admMOk">Crear docente</button></div></div></div></div>';
  $a('#admModal').querySelector('.adm-modal').onclick=e=>{ if(e.target.classList.contains('adm-modal')) $a('#admModal').innerHTML=''; };
  $a('#admMCancel').onclick=()=>{ $a('#admModal').innerHTML=''; };
  $a('#admMOk').onclick=async()=>{
    const msg=$a('#admMMsg');
    try{
      const data=await api('/api/admin/docentes',{method:'POST',headers:headers(),body:JSON.stringify({nombre:$a('#mDocName').value,correo:$a('#mDocMail').value})});
      $a('#admModal').innerHTML='';
      await recargar();
      vistaDocentes();
      await uiAlertA({kind:'success',title:data.docente.created?'Docente creado':'Docente existente',
        message:(data.docente.created?'Docente creado: ':'El docente ya existía: ')+data.docente.nombre+' ('+data.docente.correo+').'});
    }catch(e){
      if(e&&e.code==='NAME_MISMATCH') msg.textContent='Ese correo ya pertenece a otro docente.';
      else if(e&&e.code==='UNAUTHORIZED'){ $a('#admModal').innerHTML=''; irLogin('Sesión administrativa vencida. Ingrese de nuevo.'); }
      else msg.textContent='No se pudo crear ('+((e&&e.code)||'error')+').';
    }
  };
}

/* ---------------- Ofertas ---------------- */
function ofsFiltradas(){
  const q=busOf.trim().toLowerCase();
  return ofs.filter(o=>
    (!filtPer||String(o.periodoId)===String(filtPer)) &&
    (!filtNiv||String(o.nivelId)===String(filtNiv)) &&
    (!q||(o.asignatura||'').toLowerCase().includes(q)||(o.codigo||'').toLowerCase().includes(q))
  );
}
function ofsFiltradas(){
  const q=busOf.trim().toLowerCase();
  return ofs.filter(o=>
    (!filtPer||String(o.periodoId)===String(filtPer)) &&
    (!filtNiv||String(o.nivelId)===String(filtNiv)) &&
    (!filtGrupo||String(o.grupoId)===String(filtGrupo)) &&
    (!q||(o.asignatura||'').toLowerCase().includes(q)||(o.codigo||'').toLowerCase().includes(q))
  );
}
function gruposDisponibles(){
  const m=new Map();
  ofs.forEach(o=>{ if(o.grupoId!=null&&!m.has(String(o.grupoId))) m.set(String(o.grupoId),o.grupo||('Grupo '+o.grupoId)); });
  return Array.from(m.entries()).map(([id,nombre])=>({id,nombre}));
}
function vistaOfertas(){
  const lista=ofsFiltradas();
  const mapaRep={};
  listaReps.forEach(r=>{ (r.courseOfferingIds||[]).forEach(id=>{ (mapaRep[id]=mapaRep[id]||[]).push(r.name); }); });
  const grupos=gruposOfertas(lista);
  const gruposFiltro=gruposDisponibles();
  const nSel=Array.from(selDel).filter(id=>lista.some(o=>o.courseOfferingId===id)).length;
  $a('#admBody').innerHTML=
    '<p class="adm-sec-sub">Catálogo en PostgreSQL (período → nivel → ofertas). Marque ofertas para eliminarlas de forma selectiva.</p>'+
    '<div class="adm-filters adm-filters-offers"><div class="adm-filter-row">'+
      '<div class="adm-field adm-field-btn"><button id="admIrNueva">'+I.plus+' Crear oferta académica</button></div>'+
      '<div class="adm-field"><label for="admFPer">Período</label>'+
        '<select id="admFPer" aria-label="Filtrar por período"><option value="">Período: todos</option>'+cats.periodos.map(p=>'<option value="'+p.id+'"'+(String(filtPer)===String(p.id)?' selected':'')+'>'+escA(p.nombre)+'</option>').join('')+'</select></div>'+
      '<div class="adm-field"><label for="admFNiv">Nivel</label>'+
        '<select id="admFNiv" aria-label="Filtrar por nivel"><option value="">Nivel: todos</option>'+cats.niveles.map(p=>'<option value="'+p.id+'"'+(String(filtNiv)===String(p.id)?' selected':'')+'>'+escA(p.nombre)+'</option>').join('')+'</select></div>'+
      '<div class="adm-field"><label for="admFGru">Grupo</label>'+
        '<select id="admFGru" aria-label="Filtrar por grupo"><option value="">Grupo: todos</option>'+gruposFiltro.map(g=>'<option value="'+g.id+'"'+(String(filtGrupo)===String(g.id)?' selected':'')+'>'+escA(g.nombre)+'</option>').join('')+'</select></div>'+
      '<div class="adm-field adm-field-search"><label for="admFQ">Buscar</label>'+
        '<input type="search" id="admFQ" maxlength="60" placeholder="Buscar nombre o código" value="'+escA(busOf)+'" autocomplete="off"></div>'+
      '<div class="adm-field adm-f-clear"><button class="s" id="admLimpiar">'+I.refresh+'Limpiar filtros</button></div>'+
    '</div></div>'+
    '<div class="adm-selbar" id="admSelBar"><span id="admSelCount"><b>'+nSel+'</b> seleccionada(s)</span>'+
      '<button class="s" id="admSelVis">'+I.check+'Seleccionar visibles</button>'+
      '<button class="s" id="admDesel">Deseleccionar</button>'+
      '<button class="adm-btn-danger" id="admEliminar"'+(nSel?'':' disabled')+'>'+I.trash+'Eliminar seleccionadas</button></div>'+
    (grupos.map(gr=>
      '<div class="adm-grupo"><span class="adm-grupo-t">'+escA(gr.titulo[0])+'</span>'+
        '<span class="adm-grupo-sub">· '+escA(gr.titulo[1]?gr.titulo[1]+' SEMESTRE':'—')+'</span>'+
        '<span class="adm-grupo-line" aria-hidden="true"></span>'+
        '<span class="adm-pill">'+gr.items.length+' oferta(s)</span></div>'+
      '<div class="adm-of-grid">'+gr.items.map(o=>{
        const marcada=selDel.has(o.courseOfferingId);
        const reps=mapaRep[o.courseOfferingId]||[];
        return '<article class="adm-of-card'+(marcada?' sel':'')+'">'+
          '<label class="adm-of-check"><input type="checkbox" data-del value="'+o.courseOfferingId+'"'+(marcada?' checked':'')+' aria-label="Seleccionar '+escA(nombreOf(o))+'">'+
            '<span class="adm-check-ui" aria-hidden="true"></span><span class="adm-check-txt">Seleccionar</span></label>'+
          '<div class="adm-of-top"><p class="adm-of-name">'+escA(nombreOf(o))+'</p><span class="adm-code">'+escA(o.codigo||'—')+'</span></div>'+
          '<p class="adm-of-meta adm-of-docente">'+(o.docente?escA(o.docente):'Sin docente asignado')+'</p>'+
          '<p class="adm-of-meta">'+escA([o.grupo?('Grupo '+o.grupo):null,o.programa].filter(Boolean).join(' · ')||'—')+'</p>'+
          '<p class="adm-of-id">Oferta #'+o.courseOfferingId+'</p>'+
          '<div class="adm-of-reps"><span class="adm-of-reps-lbl">Representantes:</span>'+
            (reps.length?reps.map(n=>'<span class="adm-chip" title="'+escA(n)+'">'+escA(n)+'</span>').join(''):'<span class="adm-chip empty">—</span>')+
          '</div>'+
        '</article>';
      }).join('')+'</div>'
    ).join('')||vacioA('Sin ofertas para este filtro.'));
  $a('#admIrNueva').onclick=()=>{ vista='nueva'; renderApp(); };
  $a('#admFPer').onchange=e=>{ filtPer=e.target.value; vistaOfertas(); };
  $a('#admFNiv').onchange=e=>{ filtNiv=e.target.value; vistaOfertas(); };
  $a('#admFGru').onchange=e=>{ filtGrupo=e.target.value; vistaOfertas(); };
  $a('#admFQ').oninput=e=>{ busOf=e.target.value; vistaOfertas(); const b=$a('#admFQ'); b.focus(); b.setSelectionRange(b.value.length,b.value.length); };
  $a('#admLimpiar').onclick=()=>{ filtPer=''; filtNiv=''; filtGrupo=''; busOf=''; vistaOfertas(); };
  $a('#admBody').querySelectorAll('input[data-del]').forEach(box=>{
    box.onchange=()=>{
      const id=Number(box.value);
      if(box.checked) selDel.add(id); else selDel.delete(id);
      box.closest('.adm-of-card').classList.toggle('sel',box.checked);
      refrescarSelBar();
    };
  });
  const refrescarSelBar=()=>{
    const n=Array.from(selDel).filter(id=>lista.some(o=>o.courseOfferingId===id)).length;
    $a('#admSelBar').hidden=false;
    $a('#admSelCount').innerHTML='<b>'+n+'</b> seleccionada(s)';
    const btnEli=$a('#admEliminar');
    if(btnEli) btnEli.disabled=n===0;
  };
  $a('#admSelVis').onclick=()=>{ lista.forEach(o=>selDel.add(o.courseOfferingId)); vistaOfertas(); };
  $a('#admDesel').onclick=()=>{ selDel.clear(); vistaOfertas(); };
  $a('#admEliminar').onclick=eliminarSeleccionadas;
}
async function eliminarSeleccionadas(){
  const ids=Array.from(selDel);
  if(!ids.length) return;
  const mapa={};
  ofs.forEach(o=>{ mapa[o.courseOfferingId]=o; });
  const detalle=ids.map(id=>mapa[id]?('· '+mapa[id].asignatura+' ('+mapa[id].codigo+')'):('· Oferta #'+id)).join('\n');
  const ok=await uiConfirmA({kind:'danger',title:'Eliminar ofertas académicas',okText:'Sí, eliminar',cancelText:'Cancelar',
    message:'Se van a eliminar '+ids.length+' oferta(s):\n'+detalle+'\n\nEsta acción es irreversible. Solo se eliminan ofertas sin sesiones, registros ni representantes asignados; las asignaciones de docente vinculadas se retiran y el docente se conserva.'});
  if(!ok) return;
  const btn=$a('#admEliminar');
  if(btn) btn.disabled=true;
  try{
    const data=await api('/api/admin/offerings',{method:'DELETE',headers:headers(),body:JSON.stringify({ids})});
    for(const d of (data.deleted||[])) selDel.delete(d.id);
    await recargar();
    vistaOfertas();
    const lineas=[];
    for(const d of (data.deleted||[])) lineas.push('✓ '+d.asignatura+' ('+d.codigo+') — eliminada.');
    for(const r of (data.rejected||[])){
      const o=mapa[r.id];
      lineas.push('✗ '+(o?(o.asignatura+' ('+o.codigo+')'):('Oferta #'+r.id))+' — no eliminada: '+motivoBaja(r.reason)+(r.detail?' ('+r.detail+')':'')+'.');
    }
    if(data.removedTeacherLinks) lineas.push('Se retiraron '+data.removedTeacherLinks+' asignación(es) de docente vinculada(s); los docentes se conservan.');
    await uiAlertA({kind:(data.rejected||[]).length?'warn':'success',title:'Resultado de la eliminación',message:lineas.join('\n')||'Sin cambios.'});
  }catch(e){
    if(e&&e.code==='UNAUTHORIZED') irLogin('Sesión administrativa vencida. Ingrese de nuevo.');
    else await uiAlertA({kind:'error',title:'No se pudo eliminar',message:'No se pudo completar la eliminación ('+((e&&e.code)||'error')+'). No se realizaron cambios parciales inesperados: revise el detalle por oferta.'});
    vistaOfertas();
  }
}

/* ---------------- Historial de asistencias ---------------- */
let hist={desde:'',hasta:'',q:'',nivelId:'',grupoId:'',repId:'',status:'',page:1,pageSize:10,total:0,pages:1,data:[]};
let histTic=null;
function fmtDuracion(ms){
  if(ms==null||isNaN(ms)||ms<0) return '—';
  const m=Math.floor(ms/60000);
  if(m<1) return 'menos de 1 min';
  const d=Math.floor(m/1440), h=Math.floor((m%1440)/60), mm=m%60;
  if(d>0) return d+' día(s) '+h+' h';
  if(h>0) return h+' h '+mm+' min';
  return mm+' min';
}
function duracionSesion(s){
  if(!s||!s.createdAt) return '—';
  const ini=new Date(s.createdAt).getTime();
  if(isNaN(ini)) return '—';
  if(s.status==='OPEN') return null;
  if(!s.closedAt) return '—';
  const fin=new Date(s.closedAt).getTime();
  return isNaN(fin)?'—':fmtDuracion(fin-ini);
}
function arrancarTicHist(){
  if(histTic){ clearInterval(histTic); histTic=null; }
  histTic=setInterval(()=>{
    const nodos=document.querySelectorAll('[data-tiempo]');
    if(!nodos.length) return;
    const ahora=Date.now();
    nodos.forEach(el=>{
      const ini=new Date(el.getAttribute('data-desde')).getTime();
      if(!isNaN(ini)) el.textContent=fmtDuracion(ahora-ini);
    });
  },1000);
}

function fmtBogota(iso, conHora){  if(!iso) return '—';
  const d=new Date(iso);
  if(isNaN(d)) return '—';
  try{
    return new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',day:'2-digit',month:'2-digit',year:'numeric',
      ...(conHora?{hour:'2-digit',minute:'2-digit'}:{})}).format(d);
  }catch(e){ return String(iso).slice(0,10); }
}
function fmtSoloFechaBogota(iso){
  if(!iso) return 'clase';
  try{
    const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
    return String(p||'clase').slice(0,10);
  }catch(e){ return 'clase'; }
}
function badgeEstado(st){
  return '<span class="adm-badge'+(st==='OPEN'?' on':'')+'"><span class="dot"></span>'+(st==='OPEN'?'ABIERTA':'CERRADA')+'</span>';
}
async function cargarHistorial(){
  const pg0=$a('#histPag');
  if(pg0) pg0.textContent='Consultando historial…';
  const bP=$a('#histPrev'), bN=$a('#histNext');
  if(bP) bP.disabled=true;
  if(bN) bN.disabled=true;
  const seq=(hist._seq=(hist._seq||0)+1);
  const q=new URLSearchParams({page:String(hist.page),pageSize:String(hist.pageSize)});
  if(hist.desde) q.set('desde',hist.desde);
  if(hist.hasta) q.set('hasta',hist.hasta);
  if(hist.q.trim()) q.set('q',hist.q.trim());
  if(hist.nivelId) q.set('nivelId',hist.nivelId);
  if(hist.grupoId) q.set('grupoId',hist.grupoId);
  if(hist.repId) q.set('repId',hist.repId);
  if(hist.status) q.set('status',hist.status);
  const data=await api('/api/admin/sesiones?'+q.toString());
  if(seq!==hist._seq) return;
  hist.total=data.total||0;
  hist.pages=data.pages||1;
  hist.page=data.page||1;
  hist.data=data.sesiones||[];
  pintarHistorial();
}
/* Indicador de carga en un botón: deshabilita y muestra spinner + texto.
   Devuelve función para restaurar. Si ya está ocupado, devuelve null. */
function botonCarga(btn, texto){
  if(!btn||btn.disabled) return null;
  const orig=btn.innerHTML;
  btn.disabled=true;
  btn.innerHTML='<span class="spin" aria-hidden="true"></span>'+escA(texto);
  let listo=false;
  return ()=>{ if(listo) return; listo=true; btn.disabled=false; btn.innerHTML=orig; };
}
function filaHist(s){
  const enVivo=s.status==='OPEN';
  const tiempo=enVivo
    ? '<span data-tiempo data-desde="'+escA(s.createdAt||'')+'">'+escA(fmtDuracion(Date.now()-new Date(s.createdAt||Date.now()).getTime()))+'</span>'
    : escA(duracionSesion(s));
  return '<tr data-sid="'+escA(s.sessionId)+'">'+
    '<td data-label="Apertura">'+escA(fmtBogota(s.createdAt,true))+'</td>'+
    '<td data-label="Tiempo">'+tiempo+'</td>'+
    '<td data-label="Asignatura"><b>'+escA(s.asignatura||'—')+'</b><br><span class="mut">'+escA(s.codigo||'')+'</span></td>'+
    '<td data-label="Nivel/Grupo">'+escA([s.nivel,s.grupo?('Grupo '+s.grupo):null].filter(Boolean).join(' · ')||'—')+'</td>'+
    '<td data-label="Representante">'+escA(s.representante||'—')+'</td>'+
    '<td data-label="Estado">'+badgeEstado(s.status)+'</td>'+
    '<td data-label="Est.">'+s.recordCount+'</td>'+
    '<td data-label="Acciones" class="nowrap"><button class="s" data-ver="'+escA(s.sessionId)+'">'+I.eye+'Ver</button> '+
    '<button class="d" data-borrar="'+escA(s.sessionId)+'">'+I.trash+'Eliminar</button></td>'+
  '</tr>';
}
function pintarHistorial(){
  const ini=(hist.page-1)*hist.pageSize+1;
  const fin=Math.min(hist.total,ini+hist.data.length-1);
  const tb=$a('#histBody');
  if(tb) tb.innerHTML=hist.data.length?hist.data.map(filaHist).join(''):'<tr><td colspan="8">'+vacioA('Sin resultados para estos filtros.')+'</td></tr>';
  tb.querySelectorAll('[data-ver]').forEach(b=>{ b.onclick=()=>verDetalleHist(b.dataset.ver,b); });
  tb.querySelectorAll('[data-borrar]').forEach(b=>{ b.onclick=()=>eliminarSesionHist(b.dataset.borrar,b); });
  const pg=$a('#histPag');
  if(pg) pg.innerHTML=hist.total
    ? 'Página <b>'+hist.page+'</b> de <b>'+hist.pages+'</b> · '+hist.total+' resultado(s)'+(hist.data.length?' (viendo '+(hist.data.length?ini:0)+'–'+fin+')':'')
    : 'Sin resultados.';
  const bP=$a('#histPrev'), bN=$a('#histNext');
  if(bP) bP.disabled=hist.page<=1;
  if(bN) bN.disabled=hist.page>=hist.pages;
}
function vistaHistorial(){
  $a('#admBody').innerHTML=
    '<p class="adm-sec-sub">Sesiones de asistencia registradas en el servidor, de la más reciente a la más antigua.</p>'+
    '<div class="adm-filters adm-filters-hist"><div class="adm-filter-row">'+
      '<div class="adm-field adm-f-date"><label for="hDesde">Desde</label>'+
        '<input type="date" id="hDesde" aria-label="Fecha inicial" value="'+escA(hist.desde)+'"></div>'+
      '<div class="adm-field adm-f-date"><label for="hHasta">Hasta</label>'+
        '<input type="date" id="hHasta" aria-label="Fecha final" value="'+escA(hist.hasta)+'"></div>'+
      '<div class="adm-field adm-f-q"><label for="hQ">Asignatura o código</label>'+
        '<input type="search" id="hQ" maxlength="60" placeholder="Asignatura o código" value="'+escA(hist.q)+'" autocomplete="off"></div>'+
      '<div class="adm-field adm-f-select"><label for="hNivel">Nivel</label>'+
        '<select id="hNivel" aria-label="Filtrar por nivel"><option value="">Nivel: todos</option>'+cats.niveles.map(n=>'<option value="'+n.id+'"'+(String(hist.nivelId)===String(n.id)?' selected':'')+'>'+escA(n.nombre)+'</option>').join('')+'</select></div>'+
      '<div class="adm-field adm-f-select"><label for="hGrupo">Grupo</label>'+
        '<select id="hGrupo" aria-label="Filtrar por grupo"><option value="">Grupo: todos</option>'+cats.grupos.map(g=>'<option value="'+g.id+'"'+(String(hist.grupoId)===String(g.id)?' selected':'')+'>'+escA(g.nombre)+'</option>').join('')+'</select></div>'+
      '<div class="adm-field adm-f-select"><label for="hRep">Representante</label>'+
        '<select id="hRep" aria-label="Filtrar por representante"><option value="">Representante: todos</option>'+listaReps.map(r=>'<option value="'+r.id+'"'+(String(hist.repId)===String(r.id)?' selected':'')+'>'+escA(r.name)+'</option>').join('')+'</select></div>'+
      '<div class="adm-field adm-f-select"><label for="hStatus">Estado</label>'+
        '<select id="hStatus" aria-label="Filtrar por estado"><option value="">Estado: todas</option>'+
        '<option value="OPEN"'+(hist.status==='OPEN'?' selected':'')+'>Abiertas</option>'+
        '<option value="CLOSED"'+(hist.status==='CLOSED'?' selected':'')+'>Cerradas</option></select></div>'+
      '<div class="adm-field adm-f-page"><label for="hPageSize">Registros por página</label>'+
        '<select id="hPageSize" aria-label="Resultados por página">'+[10,25,50].map(n=>'<option value="'+n+'"'+(hist.pageSize===n?' selected':'')+'>'+n+' / pág.</option>').join('')+'</select></div>'+
      '<div class="adm-field adm-f-clear"><button class="s" id="hLimpiar">'+I.refresh+'Limpiar filtros</button></div>'+
    '</div></div>'+
    '<div class="adm-table-wrap"><table class="adm-table"><thead><tr>'+
      '<th>Apertura</th><th>Tiempo</th><th>Asignatura</th><th>Nivel/Grupo</th><th>Representante</th><th>Estado</th><th>Est.</th><th>Acciones</th>'+
    '</tr></thead><tbody id="histBody"></tbody></table></div>'+
    '<div class="adm-pag"><button class="s" id="histPrev">← Anterior</button><span id="histPag" class="mut"></span><button class="s" id="histNext">Siguiente →</button></div>'+
    '<div id="admModal"></div>';
  const recargarPagina=()=>{ hist.page=1; cargarHistorial().catch(mostrarErrorHist); };
  const mostrarErrorHist=async e=>{
    if(e&&e.code==='UNAUTHORIZED') irLogin('Sesión administrativa vencida. Ingrese de nuevo.');
    else await uiAlertA({kind:'error',title:'No se pudo cargar',
      message:'No se pudo cargar el historial ('+((e&&e.code)||'error')+(e&&e.status?' · HTTP '+e.status:'')+(e&&e.detail?' · '+e.detail:'')+').'});
  };
  $a('#hDesde').onchange=e=>{ hist.desde=e.target.value; recargarPagina(); };
  $a('#hHasta').onchange=e=>{ hist.hasta=e.target.value; recargarPagina(); };
  $a('#hQ').oninput=e=>{ hist.q=e.target.value; clearTimeout(hist._t); hist._t=setTimeout(recargarPagina,400); };
  $a('#hNivel').onchange=e=>{ hist.nivelId=e.target.value; recargarPagina(); };
  $a('#hGrupo').onchange=e=>{ hist.grupoId=e.target.value; recargarPagina(); };
  $a('#hRep').onchange=e=>{ hist.repId=e.target.value; recargarPagina(); };
  $a('#hStatus').onchange=e=>{ hist.status=e.target.value; recargarPagina(); };
  $a('#hPageSize').onchange=e=>{ hist.pageSize=Number(e.target.value)||10; recargarPagina(); };
  $a('#hLimpiar').onclick=()=>{ hist.desde=''; hist.hasta=''; hist.q=''; hist.nivelId=''; hist.grupoId=''; hist.repId=''; hist.status=''; hist.page=1; vistaHistorial(); cargarHistorial().catch(()=>{}); };
  $a('#histPrev').onclick=()=>{ if(hist.page>1){ hist.page--; cargarHistorial().catch(()=>{}); } };
  $a('#histNext').onclick=()=>{ if(hist.page<hist.pages){ hist.page++; cargarHistorial().catch(()=>{}); } };
  arrancarTicHist();
  cargarHistorial().catch(mostrarErrorHist);
}
/* Planilla con el mismo formato institucional de la vista del
   representante/docente (hojaHTML): mismos bloques, estilos de #hoja
   y pie institucional. Sin botones de borrado; solo lectura.
   Siempre 30 filas (hasta 40 si hay más registros) y, si la sesión
   está cerrada, las filas vacías se anulan con un zigzag por columna. */
const FILAS_MIN_ADMIN=30, FILAS_MAX_ADMIN=40;
function ajustarNombresHojaAdmin(root){
  const celdas=root?root.querySelectorAll('.nom-txt'):document.querySelectorAll('#hoja .nom-txt');
  celdas.forEach(tx=>{
    tx.style.fontSize='';
    const pasos=[12,11,10.5,10,9.5,9,8.5,8,7.5,7,6.5,6];
    for(let i=0;i<pasos.length;i++){
      tx.style.fontSize=pasos[i]+'pt';
      if(tx.scrollWidth<=tx.clientWidth+1) break;
    }
  });
}
function hojaAdmin(s, regs){
  const lbl=t=>'<td class="lbl">'+t+'</td>';
  const fecha=fmtBogota(s.createdAt)+(s.closedAt?' · '+fmtBogota(s.closedAt,true):'');
  const total=regs.length<=FILAS_MIN_ADMIN?FILAS_MIN_ADMIN:Math.min(regs.length,FILAS_MAX_ADMIN);
  const cerrada=String(s.status||'').toUpperCase()==='CLOSED';
  let filas='';
  for(let i=0;i<total;i++){
    const f=regs[i]||null;
    const anulada=cerrada&&!f;
    filas+='<tr'+(anulada?' class="fila-anulada"':'')+'>' +
      '<td class="n">'+(i+1)+'.</td>' +
      '<td class="nom"><span class="nom-txt">'+(f?escA(f.fullName||''):'')+'</span></td>' +
      '<td class="id">'+(f?escA(f.identification||''):'')+'</td>' +
      '<td class="f">'+(f&&f.studentSignature?'<div class="firma-celda"><img src="'+escA(f.studentSignature)+'" alt="Firma"></div>':'')+'</td>' +
    '</tr>';
  }
  return '' +
  '<table class="enc">' +
    '<tr class="enc-cab">' +
      '<td class="enc-logo"><img src="logo.png" alt="Universidad Tecnológica del Chocó"></td>' +
      '<td class="inst">' +
        'UNIVERSIDAD TECNOLÓGICA DEL CHOCÓ<br>' +
        '<span class="sub">Diego Luis Córdoba</span>' +
        '<span class="pro">PROCESO GESTIÓN CURRICULAR Y ACADÉMICA</span>' +
      '</td>' +
      '<td class="meta">Código: F-GCA-24<br>Versión: 1<br>Fecha: 14-01-2023</td>' +
    '</tr>' +
    '<tr class="enc-tit"><td colspan="3">FORMATO DE REGISTRO DE ASISTENCIA A CLASES</td></tr>' +
  '</table>' +
  '<table class="datos">' +
    '<colgroup><col style="width:20%"><col style="width:14%"><col style="width:15%"><col style="width:24%"><col style="width:14%"><col style="width:13%"></colgroup>' +
    '<tr>'+lbl('FACULTAD')+'<td>'+escA(s.facultad||'')+'</td>'+lbl('PROGRAMA')+'<td colspan="3">'+escA(s.programa||'')+'</td></tr>' +
    '<tr>'+lbl('NIVEL')+'<td>'+escA(s.nivel||'')+'</td>'+lbl('ASIGNATURA')+'<td>'+escA(s.asignatura||'')+'</td>'+lbl('CÓDIGO DE ASIGNATURA')+'<td>'+escA(s.codigo||'')+'</td></tr>' +
    '<tr>'+lbl('PERIODO ACADÉMICO')+'<td>'+escA(s.periodo||'')+'</td>'+lbl('CDS')+'<td></td>'+lbl('FECHA')+'<td>'+escA(fecha)+'</td></tr>' +
    '<tr>'+lbl('NOMBRE Y APELLIDOS DEL DOCENTE')+'<td colspan="5">'+escA(s.docente||'')+'</td></tr>' +
    '<tr>'+lbl('TEMAS TRATADOS')+'<td colspan="5" class="temas"><div class="temas-txt">—</div></td></tr>' +
  '</table>' +
  '<div class="tabla-wrap"><table class="tabla-est">' +
    '<colgroup><col style="width:4.5%"><col style="width:48%"><col style="width:26%"><col style="width:21%"></colgroup>' +
    '<thead><tr>' +
      '<th style="width:4.5%">No.</th>' +
      '<th style="width:48%">NOMBRES Y APELLIDOS DEL ESTUDIANTE</th>' +
      '<th style="width:26%">NÚMERO DE IDENTIFICACIÓN</th>' +
      '<th style="width:21%">FIRMA</th>' +
    '</tr></thead>' +
    '<tbody class="filas">' + filas + '</tbody>' +
  '</table></div>' +
  '<div class="pie">' +
    '<div><div class="sig-img">'+(s.teacherSignature?'<img src="'+escA(s.teacherSignature)+'" alt="Firma del docente">':'')+'</div>' +
      '<div class="sig-linea">FIRMA DEL DOCENTE</div></div>' +
    '<div><div class="sig-img">'+(s.representativeSignature?'<img src="'+escA(s.representativeSignature)+'" alt="Firma del representante">':'')+'</div>' +
      '<div class="sig-linea">FIRMA DEL REPRESENTANTE</div></div>' +
  '</div>' +
  '<div class="franja">' +
    '<div class="cambios">' +
      '<div class="cc-tit">CONTROL DE CAMBIOS</div>' +
      '<table>' +
        '<tr><th style="width:29%">FECHA</th><th>CAMBIO</th><th style="width:22%">VERSIÓN</th></tr>' +
        '<tr><td>14-01-2023</td><td>Lanzamiento del formato</td><td style="text-align:center">01</td></tr>' +
      '</table>' +
    '</div>' +
    '<div class="elaboro">' +
      '<div class="elab"><b>Elaboró:</b> Leidy Lorena Cuesta Mena<br>Cargo: Profesional Universitario<br>Fecha: 14-01-2023</div>' +
      '<div class="elab"><b>Revisó:</b> Ana Silvia Rentería<br>Cargo: Vicerrectora de Docencia<br>Fecha: 14-01-2023</div>' +
      '<div class="elab"><b>Aprobó:</b> Tamara Mery Ketty<br>Cargo: Coordinadora de Calidad<br>Fecha: 14-01-2023</div>' +
    '</div>' +
  '</div>' +
  '<div class="pie-inst"><img src="pie-utch.jpg" alt="Universidad Tecnológica del Chocó Diego Luis Córdoba, Nit. 891.680.009-4, Quibdó, Chocó (Colombia)"></div>';
}
let hojaAdmActual='';
function hojaPrintSheet(){
  let el=document.getElementById('admPrintSheet');
  if(!el){ el=document.createElement('div'); el.id='admPrintSheet'; document.body.appendChild(el); }
  return el;
}
async function verDetalleHist(id, btn){
  const fin=btn?botonCarga(btn,'Cargando planilla…'):null;
  let d;
  try{
    d=await api('/api/admin/sesiones?id='+encodeURIComponent(id));
  }catch(e){
    if(fin) fin();
    if(e&&e.code==='UNAUTHORIZED') return irLogin('Sesión administrativa vencida. Ingrese de nuevo.');
    return uiAlertA({kind:'error',title:'No se pudo cargar',message:'No se pudo cargar el detalle ('+((e&&e.code)||'error')+').'});
  }
  if(fin) fin();
  const s=d.sesion, regs=d.registros||[];
  hojaAdmActual=hojaAdmin(s,regs);
  const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  $a('#admModal').innerHTML=
    '<div class="adm-modal"><div class="box box-wide"><button type="button" class="adm-modal-x" data-close aria-label="Cerrar">'+I.x+'</button><h2>'+escA(s.asignatura||'Asistencia')+' '+badgeEstado(s.status)+'</h2>'+
      '<p class="mut">'+escA([s.codigo,s.periodo,s.grupo?('Grupo '+s.grupo):null].filter(Boolean).join(' · '))+' · '+regs.length+' registro(s)</p>'+
      '<div class="wrap"><div id="hoja">'+hojaAdmActual+'</div></div>'+
      '<div class="adm-modal-foot"><div class="adm-modal-actions">'+
      '<button class="s" id="admDPdf">'+I.download+'Descargar PDF</button>'+
      '<button class="s" id="admDCsv">Descargar CSV</button>'+
      '<button class="s" id="admDJson">Descargar JSON</button>'+
      '<button class="d" id="admDEli">'+I.trash+'Eliminar asistencia</button>'+
      '<button class="s" id="admDCerrar">Cerrar</button></div></div></div></div>';
  ajustarNombresHojaAdmin($a('#admModal #hoja'));
  const descargar=(nombre,blob)=>{
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  };
  const nombreBase='asistencia_'+(s.codigo||'clase')+'_'+fmtSoloFechaBogota(s.createdAt);
  $a('#admDCerrar').onclick=()=>{ $a('#admModal').innerHTML=''; };
  $a('#admModal').querySelector('.adm-modal').onclick=e=>{ if(e.target.classList.contains('adm-modal')) $a('#admModal').innerHTML=''; };
  $a('#admDPdf').onclick=e=>{
    const btn=e.currentTarget;
    const finBtn=botonCarga(btn,'Generando PDF…');
    try{
      hojaPrintSheet().innerHTML='<div id="hoja">'+hojaAdmActual+'</div>';
      ajustarNombresHojaAdmin(hojaPrintSheet());
      const tituloOrig=document.title;
      document.title=nombreBase;
      document.body.classList.add('adm-print');
      const restaurar=()=>{
        document.title=tituloOrig;
        document.body.classList.remove('adm-print');
        hojaPrintSheet().innerHTML='';
      };
      window.addEventListener('afterprint',restaurar,{once:true});
      setTimeout(restaurar,3000);
      window.print();
    }finally{
      if(finBtn) finBtn();
    }
  };
  $a('#admDCsv').onclick=()=>{
    const lineas=['No.,Nombre,Identificación,Hora de registro (Bogotá)'];
    regs.forEach((r,i)=>lineas.push([i+1,q(r.fullName),q(r.identification),q(fmtBogota(r.createdAt,true))].join(',')));
    descargar(nombreBase+'.csv',
      new Blob(['\ufeff'+lineas.join('\n')],{type:'text/csv;charset=utf-8'}));
  };
  $a('#admDJson').onclick=()=>{
    descargar(nombreBase+'.json',
      new Blob([JSON.stringify({exportado:new Date().toISOString(),sesion:s,registros:regs.map(r=>({nombre:r.fullName,identificacion:r.identification,registrado:r.createdAt}))},null,2)],{type:'application/json'}));
  };
  $a('#admDEli').onclick=e=>eliminarSesionHist(id,e.currentTarget);
}
let eliminandoSesion=false;
async function eliminarSesionHist(id, btn){
  if(eliminandoSesion) return;
  let info=null, regs=[];
  try{
    const d=await api('/api/admin/sesiones?id='+encodeURIComponent(id));
    info=d.sesion; regs=d.registros||[];
  }catch(e){
    if(e&&e.code==='UNAUTHORIZED') return irLogin('Sesión administrativa vencida. Ingrese de nuevo.');
    return uiAlertA({kind:'error',title:'No se pudo cargar',message:'No se pudo verificar la asistencia ('+((e&&e.code)||'error')+').'});
  }
  const ok=await uiConfirmA({kind:'danger',title:'Eliminar asistencia',okText:'Sí, eliminar',cancelText:'Cancelar',
    message:'Se eliminará definitivamente:\n· '+(info.asignatura||'Asistencia')+' ('+(info.codigo||'—')+')\n· Fecha: '+fmtBogota(info.createdAt,true)+'\n· Grupo: '+(info.grupo||'—')+'\n· Registros: '+regs.length+'\n\nEsta acción es irreversible y no toca asignaturas, docentes ni representantes.'});
  if(!ok) return;
  eliminandoSesion=true;
  const finBtn=btn?botonCarga(btn,'Eliminando asistencia…'):null;
  try{
    const data=await api('/api/admin/sesiones',{method:'DELETE',headers:headers(),body:JSON.stringify({ids:[id]})});
    if((data.eliminadas||[]).length){
      await uiAlertA({kind:'success',title:'Asistencia eliminada',message:'Se eliminó la asistencia con '+(data.eliminadas[0].registros||0)+' registro(s).'});
    }else{
      const r=(data.rechazadas||[])[0];
      await uiAlertA({kind:'warn',title:'No se eliminó',message:'Motivo: '+(r?(r.reason||'error'):'desconocido')+'.'});
      return;
    }
    $a('#admModal').innerHTML='';
    if(hist.page>1 && hist.data.length<=1) hist.page--;
    vistaHistorial();
  }catch(e){
    if(e&&e.code==='UNAUTHORIZED') irLogin('Sesión administrativa vencida. Ingrese de nuevo.');
    else await uiAlertA({kind:'error',title:'No se pudo eliminar',message:'No se pudo completar la eliminación ('+((e&&e.code)||'error')+').'});
  }finally{
    eliminandoSesion=false;
    if(finBtn) finBtn();
  }
}

/* ---------------- Nueva oferta ---------------- */
function vistaNueva(){
  $a('#admBody').innerHTML=
    '<p class="adm-sec-sub">Se guarda en PostgreSQL (subjects → curriculum_subjects → course_offerings) y devuelve su ID real.</p>'+
    '<div class="adm-form"><div class="grid">'+
      '<div class="w"><label>Asignatura existente (opcional)</label><select id="mSub">'+
        '<option value="">— Nueva asignatura —</option>'+cats.asignaturas.map(s=>'<option value="'+s.id+'">'+escA(s.codigo+' · '+s.nombre)+'</option>').join('')+'</select></div>'+
      '<div><label>Nombre de la asignatura *</label><input id="mNombre" maxlength="160" placeholder="Ej. BASES DE DATOS"></div>'+
      '<div><label>Código *</label><input id="mCodigo" maxlength="40" autocomplete="off" placeholder="Ej. 2720808" style="text-transform:uppercase"></div>'+
      '<div><label>Período académico *</label><select id="mPeriodo">'+cats.periodos.map(p=>'<option value="'+p.id+'">'+escA(p.nombre)+'</option>').join('')+'</select></div>'+
      '<div><label>Nivel / semestre *</label><select id="mNivel">'+cats.niveles.map(n=>'<option value="'+n.id+'">'+escA(n.nombre)+'</option>').join('')+'</select></div>'+
      '<div><label>Grupo</label><select id="mGrupo"></select></div>'+
      '<div><label>Docente (opcional)</label><select id="mDocente"><option value="">— Sin asignar —</option>'+listaDoc.filter(d=>d.estado==='ACTIVE').map(d=>'<option value="'+d.userId+'">'+escA(d.nombre+(d.correo?' — '+d.correo:''))+'</option>').join('')+'</select></div>'+
    '</div>'+
    '<p style="margin-top:14px"><button id="mCrear">Crear oferta</button> <span id="mMsg" class="mut" role="status"></span></p></div>'+
    '<hr class="adm-sep"><h3>Importar asignaturas</h3>'+
    '<p class="adm-sec-sub">Puedes cargar varias asignaturas mediante un archivo JSON. Se usa el período seleccionado arriba y grupo automático.</p>'+
    '<div class="adm-toolbar"><button id="mSelJson">Seleccionar JSON</button>'+
      '<button class="s" id="mPlantilla">Descargar plantilla JSON</button>'+
      '<input type="file" id="mFileJson" accept=".json,application/json" hidden></div>'+
    '<div id="mPreview"></div>'+
    '<div id="mImportRow" hidden><p><button id="mImportar">Importar seleccionadas</button> <span id="mProg" class="mut" role="status"></span></p></div>';
  const gruposDe=(perId,nivId)=>cats.grupos.filter(g=>(!perId||String(g.periodoId)===String(perId))&&(!nivId||String(g.nivelId)===String(nivId)));
  const refrescarGrupos=()=>{
    const gs=gruposDe($a('#mPeriodo').value,$a('#mNivel').value);
    $a('#mGrupo').innerHTML='<option value="">Automático</option>'+gs.map(g=>'<option value="'+g.id+'">'+escA(g.nombre+(g.periodo?' · '+g.periodo:'')+(g.nivel?' · '+g.nivel:''))+'</option>').join('');
  };
  const syncSub=()=>{
    const esNueva=!$a('#mSub').value;
    $a('#mNombre').disabled=!esNueva; $a('#mCodigo').disabled=!esNueva;
  };
  $a('#mSub').onchange=syncSub; syncSub();
  $a('#mPeriodo').onchange=refrescarGrupos; $a('#mNivel').onchange=refrescarGrupos;
  refrescarGrupos();
  $a('#mCrear').onclick=async()=>{
    const m=$a('#mMsg');
    try{
      const subId=Number($a('#mSub').value)||0;
      const cuerpo=subId
        ? {subjectId:subId,periodoId:Number($a('#mPeriodo').value)||0,nivelId:Number($a('#mNivel').value)||0}
        : {nombre:$a('#mNombre').value,codigo:$a('#mCodigo').value,periodoId:Number($a('#mPeriodo').value)||0,nivelId:Number($a('#mNivel').value)||0};
      const grupoId=Number($a('#mGrupo').value)||0;
      const docenteUserId=Number($a('#mDocente').value)||0;
      if(grupoId) cuerpo.groupId=grupoId;
      if(docenteUserId) cuerpo.docenteUserId=docenteUserId;
      const data=await api('/api/admin/offerings',{method:'POST',headers:headers(),body:JSON.stringify(cuerpo)});
      await recargar();
      await uiAlertA({kind:'success',title:data.duplicated?'Oferta existente':'Oferta creada',
        message:(data.duplicated?'Esa oferta ya existía. ID real: ':'Oferta creada. ID real: ')+data.offering.courseOfferingId});
      vista='ofertas'; renderApp();
    }catch(e){
      if(e&&e.code==='UNAUTHORIZED') irLogin('Sesión administrativa vencida. Ingrese de nuevo.');
      else if(e&&e.code==='LEVEL_MISMATCH'&&e.data) m.textContent='Esa asignatura ya está registrada en nivel '+(e.data.nivelAsignatura||'?')+'. Para cambiarla de nivel use el procedimiento de corrección.';
      else m.textContent='No se pudo crear ('+((e&&e.code)||'error')+').';
    }
  };
  /* ---------- Importación masiva desde JSON (reutiliza POST offerings) ---------- */
  const normTxt=v=>String(v||'').replace(/\s+/g,' ').trim();
  const normCod=v=>normTxt(v).toUpperCase();
  const nivelPorNumero=n=>cats.niveles.find(x=>Number(x.numero)===n)||null;
  const docentePorNombre=n=>{
    const t=normTxt(n).toUpperCase();
    if(!t) return null;
    return cats.docentes.find(d=>normTxt(d.nombre).toUpperCase()===t)||null;
  };
  const existentesCod=()=>new Set(cats.asignaturas.map(s=>normCod(s.codigo)));
  let filasJson=[];
  const pintarPreview=()=>{
    const pv=$a('#mPreview');
    if(!pv) return;
    if(!filasJson.length){ pv.innerHTML=''; $a('#mImportRow').hidden=true; return; }
    const validas=filasJson.filter(f=>!f.error).length;
    pv.innerHTML='<p class="mut"><b>'+filasJson.length+'</b> asignatura(s) encontrada(s) · <b>'+validas+'</b> válida(s).</p>'+
      '<div class="adm-pick-grid">'+filasJson.map((f,i)=>
        '<label class="adm-pick'+(!f.error&&f.sel?' sel':'')+'">'+
        '<input type="checkbox" data-json="'+i+'"'+(!f.error&&f.sel?' checked':'')+(f.error?' disabled':'')+'>'+
        '<span><b>'+escA(f.nombre||('Fila '+(i+1)))+'</b><br><span class="mut">'+escA((f.codigo||'—')+' · '+(f.nivelNombre||('nivel '+f.nivel)))+
        (f.existe?' · ya existe: se reutilizará':'')+(f.docenteNombre?' · '+escA(f.docenteNombre):'')+'</span>'+
        (f.error?'<br><span style="color:var(--bad);font-weight:700">'+escA(f.error)+'</span>':'')+'</span></label>'
      ).join('')+'</div>';
    pv.querySelectorAll('input[data-json]').forEach(box=>{
      box.onchange=()=>{ filasJson[Number(box.dataset.json)].sel=box.checked; box.closest('.adm-pick').classList.toggle('sel',box.checked); };
    });
    $a('#mImportRow').hidden=!filasJson.some(f=>!f.error);
  };
  $a('#mSelJson').onclick=()=>{ $a('#mFileJson').click(); };
  $a('#mPlantilla').onclick=()=>{
    const blob=new Blob([JSON.stringify([{nombre:'NOMBRE DE LA ASIGNATURA',codigo:'0000000',nivel:1,docente:''}],null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download='asignaturas-plantilla.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),3000);
  };
  $a('#mFileJson').onchange=e=>{
    const f=e.target.files&&e.target.files[0];
    e.target.value='';
    if(!f) return;
    const r=new FileReader();
    r.onload=()=>{
      filasJson=[];
      try{
        const data=JSON.parse(r.result);
        if(!Array.isArray(data)) throw new Error('El archivo debe contener un array JSON.');
        const vistos=new Set(), ex=existentesCod();
        filasJson=data.map((it,i)=>{
          const fila={sel:true,error:'',nombre:'',codigo:'',nivel:0,nivelNombre:'',nivelId:0,docenteNombre:'',docenteUserId:0,existe:false};
          if(!it||typeof it!=='object'){ fila.error='Fila '+(i+1)+': debe ser un objeto.'; fila.sel=false; return fila; }
          fila.nombre=normTxt(it.nombre).slice(0,160);
          fila.codigo=normCod(it.codigo).slice(0,40);
          if(!fila.nombre){ fila.error='Fila '+(i+1)+': nombre obligatorio.'; }
          else if(!fila.codigo){ fila.error='Fila '+(i+1)+': código obligatorio.'; }
          else if(!Number.isInteger(it.nivel)||it.nivel<1||it.nivel>10){ fila.error='Fila '+(i+1)+': nivel entero 1–10.'; }
          else if(vistos.has(fila.codigo)){ fila.error='Fila '+(i+1)+': código repetido en el archivo.'; }
          else{
            vistos.add(fila.codigo);
            const niv=nivelPorNumero(it.nivel);
            if(!niv){ fila.error='Fila '+(i+1)+': nivel '+it.nivel+' no existe.'; }
            else{
              fila.nivel=it.nivel; fila.nivelId=niv.id; fila.nivelNombre=niv.nombre;
              fila.existe=ex.has(fila.codigo);
              if(it.docente!==undefined&&it.docente!==null&&normTxt(it.docente)!==''){
                const doc=docentePorNombre(it.docente);
                if(!doc){ fila.error='Fila '+(i+1)+': docente "'+normTxt(it.docente)+'" no encontrado.'; }
                else{ fila.docenteNombre=doc.nombre; fila.docenteUserId=doc.id; }
              }
            }
          }
          if(fila.error) fila.sel=false;
          return fila;
        });
      }catch(err){ $a('#mPreview').innerHTML='<p style="color:var(--bad);font-weight:700">Archivo no válido: '+escA(err.message||'error')+'</p>'; $a('#mImportRow').hidden=true; return; }
      pintarPreview();
    };
    r.readAsText(f);
  };
  $a('#mImportar').onclick=async()=>{
    const sel=filasJson.filter(f=>f.sel&&!f.error);
    if(!sel.length) return;
    const periodoId=Number($a('#mPeriodo').value)||0;
    if(!periodoId){ await uiAlertA({kind:'error',title:'Sin período',message:'Seleccione el período académico en el formulario.'}); return; }
    const btn=$a('#mImportar'), prog=$a('#mProg');
    btn.disabled=true;
    let creadas=0, existentes=0;
    const fallos=[];
    for(let i=0;i<sel.length;i++){
      const f=sel[i];
      prog.textContent='Importando '+(i+1)+' de '+sel.length+'…';
      try{
        const cuerpo={nombre:f.nombre,codigo:f.codigo,periodoId,nivelId:f.nivelId};
        if(f.docenteUserId) cuerpo.docenteUserId=f.docenteUserId;
        const data=await api('/api/admin/offerings',{method:'POST',headers:headers(),body:JSON.stringify(cuerpo)});
        if(data.duplicated) existentes++; else creadas++;
      }catch(e){
        if(e&&e.code==='UNAUTHORIZED'){ btn.disabled=false; irLogin('Sesión administrativa vencida. Ingrese de nuevo.'); return; }
        fallos.push(f.codigo+': '+((e&&e.code)||'error'));
      }
    }
    btn.disabled=false;
    prog.textContent='';
    await recargar();
    filasJson=[];
    pintarPreview();
    await uiAlertA({kind:fallos.length?'warn':'success',title:'Importación completada',
      message:sel.length+' asignatura(s) procesada(s).\n'+creadas+' oferta(s) creada(s).\n'+existentes+' ya existía(n).\n'+fallos.length+' error(es).'+(fallos.length?'\n'+fallos.join('\n'):'')});
    vista='ofertas'; renderApp();
  };
}

/* ---------------- Arranque ---------------- */
(async function initAdmin(){
  if(adminSecret){
    try{ await recargar(); }
    catch(e){ irLogin((e&&e.code==='UNAUTHORIZED')?'Sesión vencida. Ingrese de nuevo.':'Sin conexión con el servidor.'); return; }
    renderApp();
  }else{
    renderLogin('');
  }
})();
