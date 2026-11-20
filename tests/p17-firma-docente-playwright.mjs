/* tests/p17-firma-docente-playwright.mjs — PROMPT 17 (Playwright, API interceptada).
   (i) firma vieja en localStorage + asistencia nueva → planilla sin firma docente
   (ii) docente firma y confirma → aparece
   (iii) representante sube la firma del docente → aparece
   (iv) incógnito vs con datos locales: mismo resultado
   Viewports: 1366x768 y 390x844. Sin errores de consola ni desbordes.
   Uso: BROWSER_PATH=/usr/bin/brave-browser-stable node tests/p17-firma-docente-playwright.mjs */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = 8138;
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

// PNG 1x1 válidos (cargables como Image) para simular firmas en pruebas UI
const OLD_SIG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="; // firma vieja
const NEW_SIG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEgQGAhKmMIQAAAABJRU5ErkJggg=="; // firma nueva confirmada
const AGORA = Date.now();
const iso = (m)=>new Date(AGORA - m*60000).toISOString();

function planillaTieneFirmaDocente(page){
  return page.evaluate(()=>{
    // Primera celda de firma del pie = docente
    const img = document.querySelector('#hoja .pie > div:first-child .sig-img img');
    return !!(img && img.getAttribute('src'));
  });
}

async function sinDesborde(page){
  return await page.evaluate(()=>document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}

const results=[];
const check=(name,ok,detail="")=>{ results.push({name,ok,detail}); console.log(`${ok?"PASS":"FAIL"}  ${name}${detail?"  → "+(typeof detail==="string"?detail:JSON.stringify(detail)):""}`); };

await new Promise(r=>server.listen(PORT,r));
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || '/usr/bin/brave-browser-stable', headless: true, args:['--no-sandbox'] });

async function nuevoCtx(viewport, {conDatosLocales=false}={}){
  const context = await browser.newContext({ viewport });
  if(conDatosLocales){
    await context.addInitScript((oldSig)=>{
      try{
        // Borrador local con firma de docente "vieja" de una sesión anterior
        const draft = {
          cfg:{ facultad:'F',programa:'P',nivel:'N',asignatura:'VIEJA',codigo:'V1',periodo:'2025-1',cds:'',fecha:'2025-01-01',hora:'08:00',docente:'DOC VIEJO',temas:'' },
          materias:[], materiaActiva:'',
          firmaDoc: oldSig, firmaRep:'',
          sesion:{ abierta:false,inicio:0,minutos:0,clave:'',claveDocente:'',sessionId:'old-sid' },
          clavesUsadas:[], estudiantes:[], repOwner:''
        };
        localStorage.setItem('utch.asistencia.v1', JSON.stringify(draft));
        localStorage.setItem('utch.asistencia.k', 'ZmFrZWtleQ==');
      }catch(e){}
    }, OLD_SIG);
  }
  const page = await context.newPage();
  const errs=[];
  page.on("pageerror", e=>errs.push('pageerror:'+String(e)));
  page.on("console", msg=>{ if(msg.type()==="error") errs.push('console:'+msg.text()); });
  return {context,page,errs};
}

function filtrarErrores(errs){
  // 501 esperado/manejado: firma guardada no disponible (sql/106 no aplicado)
  return errs.filter(e=>!/SAVED_SIGNATURE_UNAVAILABLE|teacher-saved-signature|Failed to load resource: the server responded with a status of 501/i.test(e));
}

function mkDocenteState({teacherSigned=false}={}){
  return {
    teacherSignature: teacherSigned ? NEW_SIG : null,
    teacherSignedAt: teacherSigned ? iso(5) : null,
    status: 'OPEN',
    records: [],
    posts: [],
  };
}

async function interceptarDocente(page, st){
  await page.route("**/api/**", async (route)=>{
    const req=route.request(); const url=req.url(); const metodo=req.method();
    const json=(obj,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(obj)});
    let q; try{ q=new URL(url).searchParams; }catch{ q=new URLSearchParams(); }
    const body = ()=>{ try{return JSON.parse(req.postData()||"{}");}catch{return {};} };

    if(url.includes("/api/sessions/validate")){
      const b=body(); const code=String(b.code||"").toUpperCase();
      if(code==="DOCNEW"){
        return json({ok:true, role:"TEACHER", sessionId:"s-new", status:"OPEN", createdAt: iso(20),
          cfg:{asignatura:"NUEVA MATERIA", codigo:"N1", docente:"DOC NUEVO", facultad:"ING", programa:"PROG", nivel:"I", periodo:"2026-1"} });
      }
      return json({ok:false,error:"INVALID_OR_EXPIRED_CODE"});
    }

    if(url.includes("/api/sessions/teacher-signature") && metodo==="POST"){
      const b=body(); st.posts.push({url, body:b});
      st.teacherSignature = b.teacherSignature || NEW_SIG;
      st.teacherSignedAt = new Date().toISOString();
      return json({ok:true, session:{id:"s-new", status:"OPEN", teacherSigned:true, teacherSignedAt: st.teacherSignedAt}});
    }

    if(url.includes("/api/sessions/teacher-saved-signature")){
      // firma guardada oculta/no aplicada (sql/106 no aplicado)
      return json({ok:false,error:"SAVED_SIGNATURE_UNAVAILABLE"},501);
    }

    if(url.includes("/api/records")){
      if(q.get("light")==="1"){
        return json({ok:true, light:true, status:st.status, registrationOpen:true, count: st.records.length, latestChangeAt: null, teacherSignedAt: st.teacherSignedAt, version:null});
      }
      return json({ok:true, status:st.status, teacherSignature: st.teacherSignature, teacherSignedAt: st.teacherSignedAt, registrationOpen:true, count: st.records.length, latestChangeAt:null, records: st.records});
    }

    if(metodo==="POST") return json({ok:true});
    return json({ok:true});
  });
}

async function entrarDocenteNueva(page){
  await page.goto(`http://127.0.0.1:${PORT}/#docente`, {waitUntil:"networkidle"});
  await page.fill('#codigoDocente','DOCNEW');
  await page.click('#ingresarDocente');
  await page.waitForSelector('#p15FirmaCardDoc', {timeout:12000});
  await page.waitForTimeout(1500); // dejar que polling hidrate estado servidor
}

async function firmarEnPad(page, padGlobalName, sig){
  await page.evaluate(({padGlobalName, sig})=>{
    const p = (typeof pads!=="undefined") ? pads[padGlobalName] : null;
    if(p && typeof p.set === 'function') p.set(sig);
  }, {padGlobalName, sig});
  // esperar a que image.onload marque dirty
  await page.waitForTimeout(250);
}

async function runViewport(viewport, tag){
  // (i) + (iv) docente: con datos locales viejos y en limpio → sin firma en planilla (asistencia nueva)
  for(const modo of [{name:'con datos locales', conDatosLocales:true}, {name:'incógnito/limpio', conDatosLocales:false}]){
    const st = mkDocenteState({teacherSigned:false});
    const {context,page,errs} = await nuevoCtx(viewport, {conDatosLocales: modo.conDatosLocales});
    await interceptarDocente(page, st);
    await entrarDocenteNueva(page);
    const tiene = await planillaTieneFirmaDocente(page);
    const srcHoja = await page.evaluate(()=>{ const img=document.querySelector('#hoja .pie > div:first-child .sig-img img'); return img?img.getAttribute('src'):''; }).catch(()=> '');
    check(`${tag} (i,iv) Docente ${modo.name}: planilla sin firma docente`, !tiene, {tiene, src: srcHoja?srcHoja.slice(0,40):''});
    check(`${tag} (i,iv) Docente ${modo.name}: sin desborde`, await sinDesborde(page));
    const errsReales = filtrarErrores(errs);
    check(`${tag} (i,iv) Docente ${modo.name}: sin errores de consola`, errsReales.length===0, errsReales.slice(0,3).join(' | '));
    await context.close();
  }

  // (ii) docente firma y confirma → aparece en planilla
  {
    const st = mkDocenteState({teacherSigned:false});
    const {context,page,errs} = await nuevoCtx(viewport, {conDatosLocales:false});
    await interceptarDocente(page, st);
    await entrarDocenteNueva(page);
    const antes = await planillaTieneFirmaDocente(page);
    await firmarEnPad(page, 'docente', NEW_SIG);
    await page.waitForFunction(()=>{ try{ return !!(pads && pads.docente && pads.docente.get()); }catch(e){ return false; } }, {timeout:5000}).catch(()=>{});
    await page.click('#confirmarFirmaDoc');
    // esperar respuesta y refresco (polling/full fetch puede tardar)
    await page.waitForFunction(()=>!!document.querySelector('#hoja .pie > div:first-child .sig-img img'), {timeout:10000}).catch(()=>{});
    await page.waitForTimeout(800);
    const despues = await planillaTieneFirmaDocente(page);
    const postsFirma = st.posts.filter(p=>/\/api\/sessions\/teacher-signature/.test(p.url));
    check(`${tag} (ii) Antes de confirmar: sin firma en planilla`, !antes, {antes});
    check(`${tag} (ii) Confirmar envió firma al servidor (acción explícita)`, postsFirma.length>=1, postsFirma.length);
    check(`${tag} (ii) Tras confirmar (servidor ok): firma aparece en planilla`, despues, {despues});
    check(`${tag} (ii) Sin desborde`, await sinDesborde(page));
    const errsReales = filtrarErrores(errs);
    check(`${tag} (ii) Sin errores de consola`, errsReales.length===0, errsReales.slice(0,3).join(' | '));
    await context.close();
  }

  // (iii) representante sube la firma del docente → aparece
  {
    const stRep = {
      teacherSignature: null, teacherSignedAt: null, repSignature: null,
      session: { sessionId:"11111111-1111-4111-8111-111111111111", status:"OPEN", registrationOpen:true, studentCode:"EST1", teacherCode:"DOC1", createdAt: iso(30), closedAt:null, purgeAt:null, facultad:"ING", programa:"PROG", nivel:"I", periodo:"2026-1", asignatura:"MATERIA REP", codigo:"MR1", docente:"DOC REP", attendanceNumber:1 },
      records: [],
      posts: [],
      offerings: [{courseOfferingId:10, asignatura:"MATERIA REP", codigo:"MR1", docente:"DOC REP", facultad:"ING", programa:"PROG", nivel:"I", periodo:"2026-1", correo:""}],
    };
    const {context,page,errs} = await nuevoCtx(viewport, {conDatosLocales:false});
    await context.addInitScript(()=>{
      try{ sessionStorage.setItem('utch.sesion.rep','1'); sessionStorage.setItem('utch.sesion.repId','rep1'); }catch(e){}
    });
    await page.route("**/api/**", async (route)=>{
      const req=route.request(); const url=req.url(); const metodo=req.method();
      const json=(obj,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(obj)});
      let q; try{ q=new URL(url).searchParams; }catch{ q=new URLSearchParams(); }
      const body = ()=>{ try{return JSON.parse(req.postData()||"{}");}catch{return {};} };

      if(url.includes("/api/rep/me")) return json({ok:true, representative:{id:"rep1", name:"Rep Uno", username:"rep1"}});
      if(url.includes("/api/rep/offerings")) return json({ok:true, offerings: stRep.offerings});
      if(/\/api\/rep\/sessions(\?|$)/.test(url) && metodo==="GET" && !/\/sessions\//.test(url.replace(/\/api\/rep\/sessions(\?|$).*/,'/api/rep/sessions'))) {
        return json({ok:true, sessions:[{sessionId:stRep.session.sessionId, status:stRep.session.status, registrationOpen:stRep.session.registrationOpen, studentCode:stRep.session.studentCode, teacherCode:stRep.session.teacherCode, createdAt:stRep.session.createdAt, asignatura:stRep.session.asignatura, codigo:stRep.session.codigo, docente:stRep.session.docente, recordCount:0, hasTeacherSignature:!!stRep.teacherSignature, hasRepresentativeSignature:false, attendanceNumber:1}]});
      }
      if(/\/api\/rep\/session(\?|$)/.test(url)) {
        return json({ok:true, session:{...stRep.session, teacherSignature: stRep.teacherSignature, teacherSignedAt: stRep.teacherSignedAt||null, representativeSignature: stRep.repSignature, representativeSignedAt: stRep.repSignature?iso(1):null}, records: stRep.records});
      }
      // POST crear sesión
      if(/\/api\/sessions$/.test(url.split('?')[0]) && metodo==="POST"){
        stRep.posts.push({url, body:body()});
        stRep.teacherSignature = null; stRep.teacherSignedAt = null;
        return json({ok:true, session:{id:stRep.session.sessionId, studentCode:stRep.session.studentCode, teacherCode:stRep.session.teacherCode, status:"OPEN", createdAt: stRep.session.createdAt, attendanceNumber:1}});
      }
      if(/\/api\/rep\/sessions\/[^/]+\/teacher-signature/.test(url) && metodo==="POST"){
        const b=body(); stRep.posts.push({url, body:b});
        stRep.teacherSignature = b.teacherSignature || NEW_SIG;
        stRep.teacherSignedAt = new Date().toISOString();
        return json({ok:true, session:{id:stRep.session.sessionId, status:"OPEN", teacherSignature: stRep.teacherSignature, teacherSignedAt: stRep.teacherSignedAt, teacherSigned:true}});
      }
      if(/\/api\/rep\/sessions\/[^/]+\/representative-signature/.test(url) && metodo==="POST"){
        const b=body(); stRep.repSignature = b.representativeSignature || null;
        return json({ok:true, session:{id:stRep.session.sessionId, status:"OPEN", representativeSignature: stRep.repSignature, representativeSignedAt: new Date().toISOString()}});
      }
      if(url.includes("/api/sessions/close")) return json({ok:true});
      if(url.includes("/api/rep/logout")) return json({ok:true});
      if(url.includes("/api/records")){
        if(q.get("light")==="1"){
          return json({ok:true, light:true, status:stRep.session.status, registrationOpen:stRep.session.registrationOpen, count:0, latestChangeAt:null, teacherSignedAt: stRep.teacherSignedAt||null, version:null});
        }
        return json({ok:true, status:stRep.session.status, teacherSignature: stRep.teacherSignature, teacherSignedAt: stRep.teacherSignedAt||null, registrationOpen:stRep.session.registrationOpen, count:0, latestChangeAt:null, records:[]});
      }
      if(metodo==="POST") return json({ok:true});
      return json({ok:true});
    });

    await page.goto(`http://127.0.0.1:${PORT}/#admin`, {waitUntil:"networkidle"});
    await page.waitForSelector('#abrir, #materiaSelect', {timeout:12000}).catch(()=>{});
    // esperar carga de identidad/ofertas
    await page.waitForTimeout(1500);

    // Asegurar materia activa y sesión abierta (flujo representativo). Si el UI
    // no habilita "abrir" por timing, se fuerza un estado de sesión válida para
    // probar la acción explícita de "subir firma del docente".
    const okAbrir = await page.evaluate(async ()=>{
      try{
        if(typeof S==="undefined") return false;
        if(S.materias && S.materias[0]){ S.materiaActiva=S.materias[0].id; }
      }catch(e){}
      return true;
    }).catch(()=>false);
    // intentar click en abrir si está habilitado
    const btnAbrir = await page.$('#abrir');
    if(btnAbrir){
      const dis = await btnAbrir.isDisabled().catch(()=>true);
      if(!dis){ await btnAbrir.click().catch(()=>{}); await page.waitForTimeout(1200); }
    }
    // Garantizar sesión abierta con sessionId (necesario para guardar firma explícita al servidor)
    await page.evaluate((sid)=>{
      try{
        if(typeof S==="undefined") return;
        if(!S.sesion || !S.sesion.sessionId){
          S.sesion = Object.assign(S.sesion||{}, { abierta:true, inicio:Date.now(), minutos:0, clave:'EST1', claveDocente:'DOC1', sessionId:sid });
        } else {
          S.sesion.abierta = true;
          S.sesion.sessionId = S.sesion.sessionId || sid;
        }
        S.cfg = Object.assign(S.cfg||{}, {asignatura:'MATERIA REP', codigo:'MR1', docente:'DOC REP', periodo:'2026-1', facultad:'ING', programa:'PROG', nivel:'I'});
        if(typeof refrescarPanel==='function') refrescarPanel();
        if(typeof pintarHoja==='function') pintarHoja();
      }catch(e){}
    }, stRep.session.sessionId).catch(()=>{});
    await page.waitForTimeout(300);

    // Dibujar firma del docente en pad rep y guardar (acción explícita)
    const tienePadDoc = await page.$('#padDoc canvas');
    let subio = false, aparece = false;
    if(tienePadDoc){
      await firmarEnPad(page, 'doc', NEW_SIG);
      await page.waitForFunction(()=>{ try{ return !!(pads && pads.doc && pads.doc.get() && S && S.sesion && S.sesion.sessionId); }catch(e){ return false; } }, {timeout:5000}).catch(()=>{});
      await page.click('#saveDoc');
      // esperar POST y actualización
      await page.waitForFunction(()=>!!document.querySelector('#hoja .pie > div:first-child .sig-img img'), {timeout:10000}).catch(()=>{});
      await page.waitForTimeout(900);
      const postsSig = stRep.posts.filter(p=>/teacher-signature/.test(p.url));
      subio = postsSig.length >= 1;
      aparece = await planillaTieneFirmaDocente(page);
    } else {
      subio = false; aparece = false;
    }
    check(`${tag} (iii) Rep sube firma docente: petición explícita al servidor`, subio, {posts: stRep.posts.map(p=>p.url), tienePadDoc: !!tienePadDoc});
    check(`${tag} (iii) Rep sube firma docente: aparece en planilla`, aparece, {aparece});
    check(`${tag} (iii) Sin desborde`, await sinDesborde(page));
    const errsReales = filtrarErrores(errs).filter(e=>!/favicon/i.test(e));
    check(`${tag} (iii) Sin errores de consola`, errsReales.length===0, errsReales.slice(0,3).join(' | '));
    await context.close();
  }
}

try{
  await runViewport({width:1366, height:768}, '1366x768');
  await runViewport({width:390, height:844}, '390x844');
} finally {
  await browser.close();
  server.close();
}

const fallidos = results.filter(r=>!r.ok).length;
console.log(`\n${results.length - fallidos}/${results.length} comprobaciones correctas.`);
process.exit(fallidos?1:0);
