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
  menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>'
};

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
  raiz.innerHTML=
    '<div class="ui-overlay" data-ui="overlay">'+
      '<div class="ui-panel ui-'+sig.kind+'" role="dialog" aria-modal="true" aria-label="'+escA(titulo)+'">'+
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
let vista='resumen', busRep='', busOf='', filtPer='', filtNiv='';

const headers=()=>({'Content-Type':'application/json','x-admin-secret':adminSecret||''});
async function api(url,opt){
  const r=await fetch(url,Object.assign({headers:headers()},opt||{}));
  const data=await r.json().catch(()=>null);
  if(!r.ok||!data||!data.ok){
    const e=new Error((data&&data.error)||('http-'+r.status));
    e.code=(data&&data.error)||null;
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
      '<p class="mut">Representantes y ofertas académicas.</p>'+
      '<label for="admSecret">Clave administrativa</label>'+
      '<div class="row"><input id="admSecret" type="password" maxlength="256" autocomplete="off">'+
      '<button id="admEntrar">'+I.key+'Entrar</button></div>'+
      '<p class="mut" id="admMsg" role="status" style="margin-top:10px">'+escA(mensaje||'')+'</p>'+
    '</div></div>';
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
      $a('#admMsg').textContent=(e&&e.code==='UNAUTHORIZED')?'Clave incorrecta.':'Sin conexión con el servidor.';
    }
  };
  $a('#admEntrar').onclick=entrar;
  $a('#admSecret').onkeydown=e=>{ if(e.key==='Enter') entrar(); };
  $a('#admSecret').focus();
}

/* ---------------- Layout ---------------- */
const VISTAS=[['resumen','Resumen'],['reps','Representantes'],['docentes','Docentes'],['ofertas','Ofertas académicas'],['nueva','Nueva oferta']];
const VDESC={resumen:'Estado general del sistema',reps:'Gestiona las cuentas de acceso y sus ofertas académicas.',docentes:'Gestiona el catálogo de docentes utilizado en las ofertas académicas.',ofertas:'Catálogo en PostgreSQL (período → nivel → ofertas).',nueva:'Crear una oferta académica en PostgreSQL.'};
function iconoVista(v){
  return v==='resumen'?I.home:(v==='reps'?I.users:(v==='ofertas'?I.grid:I.plus));
}
function renderApp(){
  const tit=(VISTAS.find(v=>v[0]===vista)||['',''])[1];
  $a('#adminApp').innerHTML=
    '<div class="adm-layout" id="admLayout">'+
      '<div class="adm-scrim" id="admScrim"></div>'+
      '<aside class="adm-side">'+
        '<div class="adm-brand"><img src="img/logo-v2.png" alt="Sistema de Asistencia"><div><b>Sistema de Asistencia</b><span>Administración · UTCH</span></div></div>'+
        '<nav class="adm-nav">'+
          VISTAS.map(v=>'<button data-v="'+v[0]+'" class="'+(vista===v[0]?'active':'')+'">'+iconoVista(v[0])+escA(v[1])+'</button>').join('')+
          '<div class="sep"></div>'+
          '<button data-v="__salir" class="danger">'+I.out+'Cerrar sesión</button>'+
        '</nav>'+
      '</aside>'+
      '<div class="adm-main">'+
        '<div class="adm-top"><button class="s adm-burger" id="admBurger" aria-label="Abrir menú">'+I.menu+'</button>'+
          '<div><div class="crumb">Administración / '+escA(tit)+'</div><h1>'+escA(tit)+'</h1><p class="adm-head-desc">'+escA(VDESC[vista]||'')+'</p></div></div>'+
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
  else vistaNueva();
}

/* ---------------- Resumen ---------------- */
function vistaResumen(){
  const activos=listaReps.filter(r=>r.active).length;
  const asignaciones=listaReps.reduce((n,r)=>n+((r.courseOfferingIds||[]).length),0);
  const porPeriodo={};
  ofs.forEach(o=>{ const k=o.periodo||'—'; porPeriodo[k]=(porPeriodo[k]||0)+1; });
  $a('#admBody').innerHTML=
    '<p class="adm-sec-sub">Estado actual del sistema, calculado con datos reales de PostgreSQL.</p>'+
    '<div class="adm-stats">'+
      '<div class="adm-stat"><div class="n">'+activos+'</div><div class="l">Representantes activos</div></div>'+
      '<div class="adm-stat"><div class="n">'+listaReps.length+'</div><div class="l">Representantes totales</div></div>'+
      '<div class="adm-stat"><div class="n">'+ofs.length+'</div><div class="l">Ofertas académicas</div></div>'+
      '<div class="adm-stat"><div class="n">'+asignaciones+'</div><div class="l">Asignaciones</div></div>'+
    '</div>'+
    '<div class="adm-cols"><div class="adm-panel"><h3>Ofertas por período</h3>'+
      (Object.keys(porPeriodo).sort().map(k=>'<div class="adm-kv"><b>'+escA(k)+'</b><span>'+porPeriodo[k]+' oferta(s)</span></div>').join('')||'<p class="mut">Sin ofertas.</p>')+
    '</div>'+
    '<div class="adm-panel"><h3>Representantes</h3>'+
      (listaReps.map(r=>'<div class="adm-kv"><b>'+escA(r.name)+'</b><span>'+((r.courseOfferingIds||[]).length)+' oferta(s) · '+(r.active?'activo':'inactivo')+'</span></div>').join('')||'<p class="mut">Sin representantes.</p>')+
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
  $a('#admBody').innerHTML=
    '<p class="adm-sec-sub">Cuentas con acceso de representante y sus ofertas asignadas.</p>'+
    '<div class="adm-toolbar"><button id="admNuevoRep">'+I.plus+' Nuevo representante</button>'+
      '<input type="search" id="admBusRep" maxlength="60" placeholder="Buscar por nombre o usuario" value="'+escA(busRep)+'" autocomplete="off"></div>'+
    '<div class="adm-rep-grid">'+
      (lista.map(p=>{
        const ids=(p.courseOfferingIds||[]);
        const det=ids.map(id=>mapa[id]?mapa[id].asignatura+' ('+mapa[id].codigo+')':('Oferta '+id));
        const resumen=det.slice(0,3).join(' · ')+(det.length>3?' <b>+'+(det.length-3)+' más</b>':'');
        return '<div class="adm-rep-card">'+
          '<div class="adm-rep-head"><p class="adm-rep-name">'+escA(p.name)+'</p>'+
          '<span class="adm-badge'+(p.active?' on':'')+'">'+(p.active?'ACTIVO':'INACTIVO')+'</span></div>'+
          '<p class="adm-rep-user">'+escA(p.username)+'</p>'+
          '<p class="adm-rep-count">'+ids.length+' oferta(s) asignada(s)</p>'+
          (det.length?'<p class="adm-rep-list">'+resumen+'</p>':'<p class="adm-rep-list">Sin ofertas asignadas.</p>')+
          '<div class="adm-rep-actions"><button class="s" data-edit="'+escA(p.id)+'">Editar</button> '+
          '<button class="s" data-act="'+escA(p.id)+'">'+(p.active?'Desactivar':'Activar')+'</button></div>'+
        '</div>';
      }).join('')||'<p class="adm-empty">Sin representantes para esta búsqueda.</p>')+
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
  $a('#admModal').innerHTML=
    '<div class="adm-modal"><div class="box"><h2>'+(rep?'Editar representante':'Nuevo representante')+'</h2>'+
      '<div class="grid">'+
      '<div><label>Nombre *</label><input id="mRepName" maxlength="120" value="'+escA(rep?rep.name:'')+'"></div>'+
      '<div><label>Usuario *</label><input id="mRepUser" maxlength="160" autocomplete="off" value="'+escA(rep?rep.username:'')+'"'+(rep?' disabled':'')+'></div>'+
      (rep?'':'<div><label>Contraseña (mín. 8) *</label><input id="mRepPass" type="password" maxlength="256" autocomplete="new-password"></div>')+
      '</div><div style="margin-top:14px"><b>Ofertas académicas</b><p class="mut">Solo las asignadas aparecen marcadas; las demás siguen disponibles.</p>'+
      (grupos.map(gr=>
        '<div class="adm-grupo">'+escA(gr.titulo[0])+' <span class="n">· '+escA(gr.titulo[1]?gr.titulo[1]+' SEMESTRE':'—')+'</span></div>'+
        '<div class="adm-pick-grid">'+gr.items.map(o=>
          '<label class="adm-pick'+(sel.has(o.courseOfferingId)?' sel':'')+'"><input type="checkbox" data-of value="'+o.courseOfferingId+'"'+(sel.has(o.courseOfferingId)?' checked':'')+'>'+
          '<span><b>'+escA(nombreOf(o))+'</b><br><span class="mut">'+escA(o.codigo||'')+(o.docente?' · '+escA(o.docente):'')+'</span></span></label>'
        ).join('')+'</div>'
      ).join('')||'<p class="mut">Sin ofertas.</p>')+
      '</div>'+
      '<p style="margin-top:14px"><button id="admMOk">Guardar</button> <button class="s" id="admMCancel">Cancelar</button> '+
      '<span id="admMMsg" class="mut" role="status"></span></p></div></div>';
  $a('#admModal').querySelector('.adm-modal').onclick=e=>{ if(e.target.classList.contains('adm-modal')) $a('#admModal').innerHTML=''; };
  $a('#admMCancel').onclick=()=>{ $a('#admModal').innerHTML=''; };
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
let busDoc='';
function vistaDocentes(){
  const q=busDoc.trim().toLowerCase();
  const lista=listaDoc.filter(d=>!q||(d.nombre||'').toLowerCase().includes(q)||(d.correo||'').toLowerCase().includes(q));
  $a('#admBody').innerHTML=
    '<p class="adm-sec-sub">Gestiona el catálogo de docentes utilizado en las ofertas académicas.</p>'+
    '<div class="adm-toolbar"><button id="admNuevoDoc">'+I.plus+' Nuevo docente</button>'+
      '<input type="search" id="admBusDoc" maxlength="60" placeholder="Buscar por nombre o correo..." value="'+escA(busDoc)+'" autocomplete="off"></div>'+
    '<div class="adm-rep-grid">'+
      (lista.map(d=>{
        const det=(d.ofertas||[]).slice(0,3).join(' · ')+((d.ofertas||[]).length>3?' <b>+'+((d.ofertas||[]).length-3)+' más</b>':'');
        return '<div class="adm-rep-card">'+
          '<div class="adm-rep-head"><p class="adm-rep-name">'+escA(d.nombre)+'</p>'+
          '<span class="adm-badge'+(d.estado==='ACTIVE'?' on':'')+'">'+escA(d.estado||'—')+'</span></div>'+
          '<p class="adm-rep-user">'+escA(d.correo||'Sin correo')+'</p>'+
          '<p class="adm-rep-count">'+(d.ofertasCount||0)+' oferta(s) asignada(s)</p>'+
          ((d.ofertas||[]).length?'<p class="adm-rep-list">'+det+'</p>':'<p class="adm-rep-list">Sin ofertas asignadas.</p>')+
        '</div>';
      }).join('')||'<p class="adm-empty">Sin docentes para esta búsqueda.</p>')+
    '</div><div id="admModal"></div>';
  $a('#admNuevoDoc').onclick=abrirModalDoc;
  $a('#admBusDoc').oninput=e=>{ busDoc=e.target.value; vistaDocentes(); const b=$a('#admBusDoc'); b.focus(); b.setSelectionRange(b.value.length,b.value.length); };
}
function abrirModalDoc(){
  $a('#admModal').innerHTML=
    '<div class="adm-modal"><div class="box"><h2>Nuevo docente</h2>'+
      '<p class="mut">El docente queda como registro académico interno, sin acceso a la aplicación.</p>'+
      '<div class="grid">'+
      '<div><label>Nombre completo *</label><input id="mDocName" maxlength="160" placeholder="Ej. ARISLEYDA RENTERIA CASTRO" autocomplete="off"></div>'+
      '<div><label>Correo institucional *</label><input id="mDocMail" maxlength="160" placeholder="Ej. nombre@utch.edu.co" autocomplete="off"></div>'+
      '</div>'+
      '<p style="margin-top:14px"><button id="admMOk">Crear docente</button> <button class="s" id="admMCancel">Cancelar</button> '+
      '<span id="admMMsg" class="mut" role="status"></span></p></div></div>';
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
function vistaOfertas(){
  const lista=ofsFiltradas();
  const mapaRep={};
  listaReps.forEach(r=>{ (r.courseOfferingIds||[]).forEach(id=>{ (mapaRep[id]=mapaRep[id]||[]).push(r.name); }); });
  const grupos=gruposOfertas(lista);
  $a('#admBody').innerHTML=
    '<p class="adm-sec-sub">Catálogo en PostgreSQL (período → nivel → ofertas).</p>'+
    '<div class="adm-toolbar"><button id="admIrNueva">'+I.plus+' Crear oferta académica</button>'+
      '<select id="admFPer"><option value="">Período: todos</option>'+cats.periodos.map(p=>'<option value="'+p.id+'"'+(String(filtPer)===String(p.id)?' selected':'')+'>'+escA(p.nombre)+'</option>').join('')+'</select>'+
      '<select id="admFNiv"><option value="">Nivel: todos</option>'+cats.niveles.map(p=>'<option value="'+p.id+'"'+(String(filtNiv)===String(p.id)?' selected':'')+'>'+escA(p.nombre)+'</option>').join('')+'</select>'+
      '<input type="search" id="admFQ" maxlength="60" placeholder="Buscar nombre o código" value="'+escA(busOf)+'" autocomplete="off"></div>'+
    (grupos.map(gr=>
      '<div class="adm-grupo">'+escA(gr.titulo[0])+' <span class="n">· '+escA(gr.titulo[1]?gr.titulo[1]+' SEMESTRE':'—')+' · '+gr.items.length+' oferta(s)</span></div>'+
      '<div class="adm-of-grid">'+gr.items.map(o=>
        '<div class="adm-of-card">'+
          '<div class="adm-of-top"><p class="adm-of-name">'+escA(nombreOf(o))+'</p><span class="adm-code">'+escA(o.codigo||'—')+'</span></div>'+
          '<p class="adm-of-meta">'+(o.docente?escA(o.docente):'Sin docente asignado')+'</p>'+
          '<p class="adm-of-meta">'+escA([o.grupo?('Grupo '+o.grupo):null,o.programa].filter(Boolean).join(' · ')||'—')+'</p>'+
          '<p class="adm-of-id">Oferta #'+o.courseOfferingId+'</p>'+
          '<p class="adm-of-meta">Representantes: '+escA((mapaRep[o.courseOfferingId]||[]).join(', ')||'—')+'</p>'+
        '</div>'
      ).join('')+'</div>'
    ).join('')||'<p class="adm-empty">Sin ofertas para este filtro.</p>');
  $a('#admIrNueva').onclick=()=>{ vista='nueva'; renderApp(); };
  $a('#admFPer').onchange=e=>{ filtPer=e.target.value; vistaOfertas(); };
  $a('#admFNiv').onchange=e=>{ filtNiv=e.target.value; vistaOfertas(); };
  $a('#admFQ').oninput=e=>{ busOf=e.target.value; vistaOfertas(); const b=$a('#admFQ'); b.focus(); b.setSelectionRange(b.value.length,b.value.length); };
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
      '<div><label>Docente (opcional)</label><select id="mDocente"><option value="">— Sin asignar —</option>'+listaDoc.map(d=>'<option value="'+d.userId+'">'+escA(d.nombre+(d.correo?' — '+d.correo:''))+'</option>').join('')+'</select></div>'+
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
