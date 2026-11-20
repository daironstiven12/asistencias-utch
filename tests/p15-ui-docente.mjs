/* tests/p15-ui-docente.mjs — PROMPT 15c req 1 (Playwright, API interceptada).
   Escenarios docente (1366x768 y 390x844): firma guardada (sin/con, usar->planilla,
   quitar con confirmación), oferta sin docente, tabla/columna ausente. Temas sync
   docente<->representante. Sin errores de consola ni desbordes. Sin BD.
   Uso: BROWSER_PATH=/usr/bin/brave-browser-stable node tests/p15-ui-docente.mjs */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = 8136;
const MIME = {".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".ico":"image/x-icon",".svg":"image/svg+xml",".json":"application/json; charset=utf-8"};

const server = createServer(async (req,res)=>{
  try{
    let p=decodeURIComponent(String(req.url).split("?")[0]);
    if(p==="/ruta-administrativa") p="/admin.html";
    const file=join(ROOT,normalize(p).replace(/^(\.\.[/\\])+/, ""));
    const s=await stat(file).catch(()=>null);
    const target=s&&s.isDirectory()?join(file,"index.html"):file;
    const body=await readFile(target);
    res.writeHead(200,{"content-type":MIME[extname(target)]||"application/octet-stream"});
    res.end(body);
  }catch{ res.writeHead(404); res.end("nf"); }
});

const VALID_SIG = "data:image/png;base64," + "A".repeat(120);
const AGORA = Date.now();
const iso = (m)=>new Date(AGORA - m*60000).toISOString();

function mkState(){
  return {
    // docente/saved-signature
    savedSigMode: 'none', // 'none' | 'has' | 'unavailable' | 'not_assigned'
    savedSigUpdatedAt: iso(60),
    teacherSignatureApplied: '',
    // topics
    topicsAvailable: true,
    topics: 'Tema inicial',
    topicsUpdatedAt: iso(30),
    // records
    status: 'OPEN',
    records: [{id:'r1', session_id:'s1', full_name:'ANA TEST', identification:'12345', student_signature:'', created_at: iso(10)}],
    // oferta docente
    ofertaTieneDocente: true,
    posts: [],
  };
}

async function interceptar(page, st, opts={}){
  await page.route("**/api/**", async (route)=>{
    const req=route.request(); const url=req.url(); const metodo=req.method();
    const json=(obj,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(obj)});
    let q; try{ q=new URL(url).searchParams; }catch{ q=new URLSearchParams(); }
    const body = ()=>{ try{return JSON.parse(req.postData()||"{}");}catch{return {};} };

    if(url.includes("/api/sessions/validate")){
      const b=body(); const code=String(b.code||"").toUpperCase();
      if(code==="DOCOK"){
        return json({ok:true, role:"TEACHER", sessionId:"s1", status:"OPEN", createdAt: iso(40),
          cfg:{asignatura:"REDES", codigo:"R1", docente: st.ofertaTieneDocente?"DOCENTE DEMO":"", facultad:"ING", programa:"PROG", nivel:"I", periodo:"2026-1"} });
      }
      return json({ok:false,error:"INVALID_OR_EXPIRED_CODE"});
    }

    if(url.includes("/api/sessions/teacher-saved-signature")){
      const b=body(); const op=(q.get("op")||b.op||"get").toLowerCase();
      if(st.savedSigMode==='unavailable') return json({ok:false,error:"SAVED_SIGNATURE_UNAVAILABLE"},501);
      if(st.savedSigMode==='not_assigned') return json({ok:false,error:"TEACHER_NOT_ASSIGNED"},409);
      if(op==='get'){
        return json({ok:true, has: st.savedSigMode==='has', updatedAt: st.savedSigMode==='has'?st.savedSigUpdatedAt:null});
      }
      if(op==='save'){
        st.posts.push({url,op,body:b});
        st.savedSigMode='has'; st.savedSigUpdatedAt = new Date().toISOString();
        return json({ok:true, saved:true, updatedAt: st.savedSigUpdatedAt});
      }
      if(op==='apply'){
        st.posts.push({url,op,body:b});
        st.teacherSignatureApplied = VALID_SIG;
        return json({ok:true, applied:true, session:{id:"s1", status:"OPEN", teacherSigned:true, teacherSignedAt:new Date().toISOString()}});
      }
      if(op==='delete'){
        st.posts.push({url,op,body:b});
        st.savedSigMode='none'; st.savedSigUpdatedAt=null;
        return json({ok:true, removed:true});
      }
      return json({ok:false,error:"INVALID_DATA"},400);
    }

    if(url.includes("/api/sessions/teacher-signature") && metodo==="POST"){
      const b=body(); st.posts.push({url,body:b});
      st.teacherSignatureApplied = b.teacherSignature||'';
      return json({ok:true, session:{id:"s1", status:"OPEN", teacherSigned:true, teacherSignedAt:new Date().toISOString()}});
    }

    if(url.includes("/api/sessions/topics") && metodo==="POST"){
      const b=body();
      if(!st.topicsAvailable) return json({ok:false,error:"TOPICS_UNAVAILABLE"},501);
      st.posts.push({url,body:b});
      if(b.borrar===true){ st.topics=null; st.topicsUpdatedAt=new Date().toISOString(); return json({ok:true, topics:null, topicsUpdatedAt:st.topicsUpdatedAt, borrada:true}); }
      const t=String(b.topics||"").trim().slice(0,600);
      if(!t){ return json({ok:true, sinCambios:true, topics:st.topics, topicsUpdatedAt:st.topicsUpdatedAt}); }
      st.topics=t; st.topicsUpdatedAt=new Date().toISOString();
      return json({ok:true, topics:st.topics, topicsUpdatedAt:st.topicsUpdatedAt});
    }

    if(url.includes("/api/records")){
      if(q.get("light")==="1"){
        const base={ok:true, light:true, status:st.status, registrationOpen: st.status==="OPEN", count: st.records.length, latestChangeAt: st.records.length?st.records[st.records.length-1].created_at:null, teacherSignedAt: st.teacherSignatureApplied?iso(5):null, version: st.topicsUpdatedAt || iso(10)};
        if(st.topicsAvailable){ base.topics=st.topics; base.topicsUpdatedAt=st.topicsUpdatedAt; }
        return json(base);
      }
      const full={ok:true, status:st.status, teacherSignature: st.teacherSignatureApplied||null, teacherSignedAt: st.teacherSignatureApplied?iso(5):null, registrationOpen: st.status==="OPEN", count: st.records.length, latestChangeAt: st.records.length?st.records[st.records.length-1].created_at:null, records: st.records};
      if(st.topicsAvailable){ full.topics=st.topics; full.topicsUpdatedAt=st.topicsUpdatedAt; }
      return json(full);
    }

    // rep mocks (para sync representante)
    if(url.includes("/api/rep/me")) return json({ok:true, representative:{id:"rep1", name:"Rep", username:"rep"}});
    if(url.includes("/api/rep/offerings")) return json({ok:true, offerings:[]});
    if(url.includes("/api/rep/sessions")) return json({ok:true, sessions:[{sessionId:"s1", status:"OPEN", registrationOpen:true, studentCode:"EST1", teacherCode:"DOCOK", createdAt:iso(40), asignatura:"REDES", codigo:"R1", docente:"DOCENTE DEMO", recordCount:1, hasTeacherSignature:!!st.teacherSignatureApplied, hasRepresentativeSignature:false, attendanceNumber:1, ...(st.topicsAvailable?{topics:st.topics}:{})}]});
    if(url.includes("/api/rep/session")){
      return json({ok:true, session:{sessionId:"s1", status:"OPEN", registrationOpen:true, studentCode:"EST1", teacherCode:"DOCOK", createdAt:iso(40), closedAt:null, purgeAt:null, facultad:"ING", programa:"PROG", nivel:"I", periodo:"2026-1", asignatura:"REDES", codigo:"R1", docente:"DOCENTE DEMO", teacherSignature:st.teacherSignatureApplied||null, representativeSignature:null, attendanceNumber:1, ...(st.topicsAvailable?{topics:st.topics, topicsUpdatedAt:st.topicsUpdatedAt}:{})}, records: st.records.map(r=>({id:r.id, sessionId:r.session_id, fullName:r.full_name, identification:r.identification, studentSignature:"", createdAt:r.created_at}))});
    }
    if(url.includes("/api/sessions/close")) return json({ok:true});
    if(url.includes("/api/rep/logout")) return json({ok:true});

    if(metodo==="POST") return json({ok:true});
    return json({ok:true});
  });
}

const results=[];
const check=(name,ok,detail="")=>{ results.push({name,ok,detail}); console.log(`${ok?"PASS":"FAIL"}  ${name}${detail?"  → "+detail:""}`); };

async function sinDesborde(page){
  return await page.evaluate(()=>document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}

await new Promise(r=>server.listen(PORT,r));
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || '/usr/bin/brave-browser-stable', headless: true, args:['--no-sandbox'] });

async function nuevoCtx(viewport){
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errs=[];
  page.on("pageerror", e=>errs.push(String(e)));
  page.on("console", msg=>{ if(msg.type()==="error") errs.push(msg.text()); });
  return {context,page,errs};
}

async function loginDocente(page, st){
  await page.goto(`http://127.0.0.1:${PORT}/#docente`, {waitUntil:"networkidle"});
  await page.fill('#codigoDocente','DOCOK');
  await page.click('#ingresarDocente');
  await page.waitForSelector('#p15FirmaCardDoc', {timeout:10000});
  // esperar un ciclo de init/polling
  await page.waitForTimeout(1200);
}

async function runViewport(viewport, tag){
  // 1) Sin firma guardada
  {
    const st = mkState(); st.savedSigMode='none'; st.ofertaTieneDocente=true;
    const {context,page,errs} = await nuevoCtx(viewport);
    await interceptar(page, st);
    await loginDocente(page, st);
    const chkVisible = await page.isVisible('#p15GuardarFirmaChkWrap').catch(()=>false);
    const chkHiddenAttr = await page.getAttribute('#p15GuardarFirmaChkWrap','hidden').catch(()=>null);
    const chkOn = await page.isChecked('#p15GuardarFirmaChk').catch(()=>null);
    const hasSavedBlock = await page.locator('#p15UsarFirmaGuardada').count();
    check(`${tag} 1. Sin firma guardada: casilla visible`, chkVisible && chkHiddenAttr===null, JSON.stringify({chkVisible,chkHiddenAttr}));
    check(`${tag} 1b. Casilla desmarcada`, chkOn===false, String(chkOn));
    check(`${tag} 1c. Sin bloque de firma guardada`, hasSavedBlock===0, String(hasSavedBlock));
    check(`${tag} 1d. Sin errores consola`, errs.length===0, errs.slice(0,3).join(' | '));
    check(`${tag} 1e. Sin desborde`, await sinDesborde(page));
    await context.close();
  }

  // 2) Con firma guardada (miniatura/estado + 3 botones), usar -> planilla, quitar con confirmación
  {
    const st = mkState(); st.savedSigMode='has'; st.ofertaTieneDocente=true; st.teacherSignatureApplied='';
    const {context,page,errs} = await nuevoCtx(viewport);
    await interceptar(page, st);
    await loginDocente(page, st);
    const usar = await page.locator('#p15UsarFirmaGuardada').count();
    const cambiar = await page.locator('#p15CambiarFirmaGuardada').count();
    const quitar = await page.locator('#p15QuitarFirmaGuardada').count();
    check(`${tag} 2. Con firma guardada: 3 botones`, usar===1 && cambiar===1 && quitar===1, JSON.stringify({usar,cambiar,quitar}));
    const bloque = await page.isVisible('#p15FirmaGuardadaBloque').catch(()=>false);
    check(`${tag} 2b. Bloque firma guardada visible (miniatura/estado)`, bloque===true, String(bloque));

    // Usar mi firma guardada -> aparece en la planilla
    await page.click('#p15UsarFirmaGuardada');
    await page.waitForTimeout(1500);
    const appliedOk = st.teacherSignatureApplied === VALID_SIG;
    const msg = await page.textContent('#msgFirmaDoc').catch(()=>"");
    const firmaEnPlanilla = await page.locator('#hoja img[alt="Firma del docente"]').count().catch(()=>0);
    check(`${tag} 2c. Usar firma guardada aplica en servidor`, appliedOk, JSON.stringify({appliedOk}));
    check(`${tag} 2d. Firma aparece en la planilla`, firmaEnPlanilla>0, `imgs=${firmaEnPlanilla} msg=${msg||""}`);

    // Quitar con confirmación
    await page.click('#p15QuitarFirmaGuardada');
    await page.waitForSelector('[data-ui="ok"]', {timeout:3000}).catch(()=>{});
    const confirmed = await page.evaluate(()=>{
      const ok = document.querySelector('[data-ui="ok"]');
      if(ok){ ok.click(); return true; } return false;
    });
    await page.waitForTimeout(1000);
    check(`${tag} 2e. Quitar pide confirmación y elimina`, confirmed && st.savedSigMode==='none', JSON.stringify({confirmed, mode: st.savedSigMode}));
    check(`${tag} 2f. Sin errores consola`, errs.length===0, errs.slice(0,3).join(' | '));
    check(`${tag} 2g. Sin desborde`, await sinDesborde(page));
    await context.close();
  }

  // 3) Oferta sin docente asignado
  {
    const st = mkState(); st.ofertaTieneDocente=false; st.savedSigMode='none';
    const {context,page,errs} = await nuevoCtx(viewport);
    await interceptar(page, st);
    await loginDocente(page, st);
    const temasHidden = await page.getAttribute('#p15TemasCardDoc','hidden').catch(()=>null);
    const noDocVisible = await page.isVisible('#p15TemasNoDoc').catch(()=>false);
    const motivo = await page.textContent('#p15TemasNoDoc').catch(()=>"");
    check(`${tag} 3. Oferta sin docente: temas ocultos`, temasHidden!==null, String(temasHidden));
    check(`${tag} 3b. Muestra motivo`, noDocVisible && /no tiene un docente asignado/i.test(motivo||""), (motivo||"").slice(0,120));
    check(`${tag} 3c. Sin errores consola`, errs.length===0, errs.slice(0,3).join(' | '));
    check(`${tag} 3d. Sin desborde`, await sinDesborde(page));
    await context.close();
  }

  // 4) Tabla/columna ausente
  {
    const st = mkState(); st.topicsAvailable=false; st.savedSigMode='unavailable'; st.ofertaTieneDocente=true;
    const {context,page,errs} = await nuevoCtx(viewport);
    await interceptar(page, st);
    await loginDocente(page, st);
    const temasHidden = await page.getAttribute('#p15TemasCardDoc','hidden').catch(()=>null);
    const firmaBloqueHidden = await page.getAttribute('#p15FirmaGuardadaBloque','hidden').catch(()=>null);
    const chkHidden = await page.getAttribute('#p15GuardarFirmaChkWrap','hidden').catch(()=>null);
    const errsReales = errs.filter(e => !/Failed to load resource: the server responded with a status of 501/i.test(e));
    check(`${tag} 4. Columna/tabla ausente: temas ocultos`, temasHidden!==null, String(temasHidden));
    check(`${tag} 4b. Firma guardada oculta (bloque/casilla)`, firmaBloqueHidden!==null && chkHidden!==null, JSON.stringify({firmaBloqueHidden,chkHidden}));
    check(`${tag} 4c. Sin errores consola (501 esperados excluidos)`, errsReales.length===0, errs.slice(0,3).join(' | '));
    check(`${tag} 4d. Sin desborde`, await sinDesborde(page));
    await context.close();
  }

  // 5) Temas sync: docente guarda -> representante ve; representante escribe -> docente ve
  {
    const st = mkState(); st.ofertaTieneDocente=true; st.savedSigMode='none'; st.topics='Tema inicial';
    // Docente guarda
    const {context:ctxDoc,page:pageDoc,errs:errsDoc} = await nuevoCtx(viewport);
    await interceptar(pageDoc, st);
    await loginDocente(pageDoc, st);
    await pageDoc.waitForSelector('#p15TemasCardDoc:not([hidden]) #p15TemasDoc', {timeout:8000}).catch(()=>{});
    await pageDoc.fill('#p15TemasDoc','Tema desde docente');
    await pageDoc.click('#p15GuardarTemasDoc');
    await pageDoc.waitForTimeout(1000);
    check(`${tag} 5a. Docente guarda temas en servidor`, st.topics==='Tema desde docente', JSON.stringify({topics:st.topics}));

    // Representante ve tras consulta (carga sesión)
    const {context:ctxRep,page:pageRep,errs:errsRep} = await nuevoCtx(viewport);
    await interceptar(pageRep, st);
    await pageRep.goto(`http://127.0.0.1:${PORT}/`, {waitUntil:"networkidle"});
    await pageRep.evaluate(()=>{ try{ sessionStorage.setItem('utch.sesion.rep','1'); sessionStorage.setItem('utch.sesion.repId','rep1'); }catch(e){} });
    await pageRep.goto(`http://127.0.0.1:${PORT}/#admin`, {waitUntil:"networkidle"});
    await pageRep.waitForTimeout(1500);
    // seleccionar asistencia via API UI si existe botón, o inyectar selección
    const selOk = await pageRep.evaluate(async()=>{
      try{
        if(typeof seleccionarAsistenciaRep==='function'){ await seleccionarAsistenciaRep('s1'); return true; }
      }catch(e){}
      return false;
    });
    await pageRep.waitForTimeout(1800);
    const repTema = await pageRep.$eval('#f_temas', el=>el.value).catch(()=>"");
    check(`${tag} 5b. Representante ve tema del docente tras cargar sesión`, selOk && /Tema desde docente/.test(repTema), JSON.stringify({selOk,repTema}));

    // Representante escribe/guarda -> docente ve
    await pageRep.fill('#f_temas','Tema desde representante');
    const savedRep = await pageRep.evaluate(async()=>{
      try{
        const btn=document.getElementById('p15GuardarTemasRep');
        if(btn && !btn.hidden && !btn.closest('[hidden]')){ btn.click(); return 'clicked'; }
      }catch(e){}
      return 'no';
    });
    await pageRep.waitForTimeout(1200);
    check(`${tag} 5c. Representante guarda tema`, savedRep==='clicked' && st.topics==='Tema desde representante', JSON.stringify({savedRep, topics: st.topics}));

    // Docente ve tras polling
    await pageDoc.waitForTimeout(5000);
    const docTema = await pageDoc.$eval('#p15TemasDoc', el=>el.value).catch(()=>"");
    check(`${tag} 5d. Docente ve tema del representante y puede editar`, /Tema desde representante/.test(docTema), JSON.stringify({docTema}));
    check(`${tag} 5e. Sin errores consola (docente/rep)`, errsDoc.length===0 && errsRep.length===0, JSON.stringify({doc:errsDoc.slice(0,2), rep:errsRep.slice(0,2)}));
    check(`${tag} 5f. Sin desborde (docente/rep)`, (await sinDesborde(pageDoc)) && (await sinDesborde(pageRep)));

    await ctxDoc.close(); await ctxRep.close();
  }
}

await runViewport({width:1366,height:768}, "1366x768");
await runViewport({width:390,height:844}, "390x844");

await browser.close(); server.close();

const fallidos = results.filter(r=>!r.ok).length;
console.log(`\n${results.length-fallidos}/${results.length} comprobaciones correctas.`);
process.exit(fallidos?1:0);
