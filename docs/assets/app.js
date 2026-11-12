"use strict";
/* StrainDB GitHub Pages preview: user-owned facts stay in static JSON.
 * CannaLib content is queried only on demand and held in memory until
 * the dialog closes or the page is unloaded. Never write API results to
 * storage, GitHub, service workers, analytics, or download artifacts.
 */
const API = "https://api.cannalib.org";
const SOURCE = "./data/strains.json";
const $ = id => document.getElementById(id);
const state = { owned: [], listed: [], mode: "mine", selected: null, api: null,
  apiStatus: "idle", requestToken: 0, searchToken: 0, activeTab: "overview", loaded: false };
const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = v => String(v||"").toLocaleLowerCase("de").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"");
const safeURL = v => {try{const u=new URL(String(v));return ["https:"].includes(u.protocol)?u.href:null}catch{return null}};
const isSet = v => v!==null&&v!==undefined&&v!==""&&!(Array.isArray(v)&&v.length===0);
const readable = v => {if(v===null||v===undefined||v==="")return "Nicht angegeben";if(typeof v==="boolean")return v?"Ja":"Nein";if(typeof v==="object")return Array.isArray(v)?v.map(readable).join(", "):JSON.stringify(v);return String(v)};
const labels={genetics:"Eltern-Genetik",ratio:"Indica / Sativa",thc:"THC",cbd:"CBD",aroma:"Aroma",type:"Typ",terpenes:"Terpene",floweringTime:"Blütezeit",yield:"Ertrag",description:"Beschreibung",thcAverage:"THC-Vergleichswert",indica_percent:"Indica %",sativa_percent:"Sativa %",top_terpenes:"Top-Terpene",thc_range:"THC-Spanne",cbd_range:"CBD-Spanne",flowering_days:"Blütezeit (Tage)",height_cm:"Höhe (cm)",has_chemistry:"Chemische Daten"};
const label = s => labels[s]||s.replace(/_/g," ").replace(/([a-z])([A-Z])/g,"$1 $2").replace(/^./,c=>c.toUpperCase());
function setStatus(text){$("resultCount").textContent=text}
function statusTag(s){const auto=/auto/i.test(s.flowering||s.type||"");const reg=/regul/i.test(s.sex||"");return {text:reg?"Regulär":auto?"Autoflower":"Photoperiodisch",css:reg?"reg":auto?"auto":"fem"}}
function card(s,index){const t=statusTag(s);const sub=s.breeder||"Breeder nicht angegeben";const real=Object.keys(s.info||{}).filter(k=>isSet(s.info[k])).length;
return '<button class="strain" type="button" data-index="'+index+'"><div class="strain-media"><span class="category '+t.css+'">'+esc(t.text)+'</span><span class="symbol" aria-hidden="true">✳</span></div><div class="strain-body"><h3>'+esc(s.name||"Unbekannt")+'</h3><p>'+esc(sub)+'</p><div class="strain-foot"><span>'+(state.mode==="mine"?(real?real+" belegte Felder":"Katalogeintrag"):"CannaLib live")+'</span><span>Details ↗</span></div></div></button>'}
function renderCards(rows){state.listed=rows;$("cards").innerHTML=rows.map(card).join("");$("empty").hidden=rows.length>0;$("cards").querySelectorAll("[data-index]").forEach(el=>el.addEventListener("click",()=>openDetail(rows[Number(el.dataset.index)])))}
function allBreeders(){return [...new Set(state.owned.map(x=>x.breeder).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"de"))}
function configure(){const sel=$("breeder");sel.innerHTML='<option value="">Alle Breeder</option>'+allBreeders().map(n=>'<option value="'+esc(n)+'">'+esc(n)+'</option>').join("");$("breeder").hidden=state.mode!=="mine";$("type").hidden=state.mode!=="mine";$("sort").hidden=state.mode!=="mine"}
function localSearch(){const q=norm($("search").value),breed=$("breeder").value,type=$("type").value;let rows=state.owned.filter(s=>{
const hay=norm([s.name,s.breeder,s.info?.genetics,s.info?.aroma].join(" "));
if(q&&!hay.includes(q))return false;if(breed&&s.breeder!==breed)return false;
const auto=/auto/i.test(s.flowering||"");const reg=/regul/i.test(s.sex||"");
return !type||(type==="auto"&&auto)||(type==="fem"&&!auto&&!reg)||(type==="reg"&&reg)
});rows.sort((a,b)=>($("sort").value==="breeder"?a.breeder.localeCompare(b.breeder,"de"):a.name.localeCompare(b.name,"de")));renderCards(rows);setStatus(rows.length+" von "+state.owned.length+" Sorten")}
function records(body){if(Array.isArray(body))return body;if(body&&typeof body==="object"){for(const k of ["results","strains","items","data"]){if(Array.isArray(body[k]))return body[k];if(body[k]&&typeof body[k]==="object"){const nested=records(body[k]);if(nested.length)return nested}}}return []}
function apiUrlFor(item){const raw=item.id||item.name_norm||item.slug||item.name;if(!raw)return null;return API+"/v1/catalogs/strains/"+encodeURIComponent(String(raw))}
async function getAPI(url,signal){const r=await fetch(url,{headers:{Accept:"application/json"},mode:"cors",cache:"no-store",signal});if(!r.ok){let detail="";try{const e=await r.json();detail=e.code||e.message||""}catch{};throw Error("HTTP "+r.status+(detail?" · "+detail:""))}return r.json()}
let timer;
async function remoteSearch(){const q=$("search").value.trim(),token=++state.searchToken;clearTimeout(timer);if(!q){renderCards([]);setStatus("Suchbegriff eingeben – CannaLib durchsucht den gesamten Katalog");return}if(q.length<2){renderCards([]);setStatus("Mindestens 2 Zeichen eingeben");return}
setStatus("Suche live in CannaLib …");try{const res=await getAPI(API+"/v1/catalogs/strains?q="+encodeURIComponent(q)+"&limit=10");if(token!==state.searchToken||state.mode!=="all")return;const rows=records(res).filter(x=>x&&typeof x==="object").slice(0,10);renderCards(rows);setStatus(rows.length+" Live-Suchergebnisse für „"+q+"“ (maximal 10 pro Anfrage)")}catch(e){if(token!==state.searchToken)return;renderCards([]);setStatus("API-Suche fehlgeschlagen: "+e.message+" · Rate-Limit oder Browser-Verbindung prüfen")}}
function doSearch(){if(state.mode==="mine")localSearch();else{clearTimeout(timer);timer=setTimeout(remoteSearch,420)}}
function setMode(mode){state.mode=mode;state.searchToken++;state.requestToken++;$("modeMine").classList.toggle("active",mode==="mine");$("modeAll").classList.toggle("active",mode==="all");$("modeMine").setAttribute("aria-pressed",mode==="mine");$("modeAll").setAttribute("aria-pressed",mode==="all");$("modeHint").textContent=mode==="mine"?"Deine 84 Sorten. Beim Öffnen fragt StrainDB passende CannaLib-Details live ab.":"Freie Suche nach Sortennamen und Aliasen im CannaLib-Gesamtkatalog. Keine vollständige Datenbank-Auflistung oder Speicherung.";configure();$("search").value="";if(mode==="mine")localSearch();else{renderCards([]);setStatus("Suchbegriff eingeben – CannaLib live durchsuchen")}}
function factGrid(obj){if(!obj||typeof obj!=="object")return '<p class="muted">Noch keine Angaben hinterlegt.</p>';const pairs=Object.entries(obj).filter(([k,v])=>isSet(v)&&!["description","thcAverageMethod"].includes(k));return pairs.length?'<dl class="facts">'+pairs.map(([k,v])=>'<div class="fact"><dt>'+esc(label(k))+'</dt><dd>'+esc(readable(v))+'</dd></div>').join("")+'</dl>':'<p class="muted">Für diese Sorte liegen noch keine belegten Angaben vor.</p>'}
function sourceView(s){const links=s.sources||[];return '<section class="section"><h3>Quellen aus SeedNest</h3>'+(links.length?'<ol class="source-list">'+links.map(e=>{const url=safeURL(e.url);return url?'<li><a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(new URL(url).hostname)+'</a><span class="muted"> · '+esc(e.date||"Datum unbekannt")+'</span></li>':''}).join("")+'</ol>':'<p class="muted">Noch keine Quellen hinterlegt.</p>')+'</section>'}
function keyTree(v,key="",depth=0){if(depth>12)return'<span class="muted">Verschachtelung begrenzt</span>';if(v===null||v===undefined)return'<span class="muted">null</span>';if(typeof v!=="object")return esc(readable(v));const items=Object.entries(v);if(!items.length)return'<span class="muted">'+(Array.isArray(v)?"[]":"{}")+'</span>';return items.map(([k,x])=>'<details class="kv" '+(depth<1?'open':'')+'><summary>'+esc(Array.isArray(v)?"["+k+"]":label(k))+'</summary><div class="kv-value">'+keyTree(x,k,depth+1)+'</div></details>').join("")}
function ownOverview(s){const info=s.info||{};return '<section class="section"><h3>Belegte Sortendaten</h3>'+factGrid(info)+'</section>'+(info.description?'<section class="section"><h3>Beschreibung</h3><p class="description">'+esc(info.description)+'</p></section>':'')+'<section class="section"><h3>Herkunft</h3>'+factGrid(s.origin||{})+'</section>'}
function ownGenetics(s){const lin=s.lineage||{},info=s.info||{},text=info.genetics||lin.raw_genetics||lin.original_parentage||"Elternlinien bislang nicht belegt";const parents=(lin.parents||[]).filter(Boolean);return '<section class="section"><h3>Eltern-Genetik</h3><div class="tree"><div class="parents">'+(parents.length?parents.map(p=>'<div class="node">'+esc(p.name||p)+'</div>').join(""):'<div class="node muted">Eltern nicht einzeln nachgewiesen</div>')+'</div><span>↓</span><div class="node">'+esc(s.name)+'</div></div><p class="description">'+esc(text)+'</p></section>'+(s.lineage?'<section class="section"><h3>Weitere Abstammungsdaten</h3>'+keyTree(s.lineage)+'</section>':'')}

/* Bootstrap-backed, end-user-friendly display for all live fields.
   CannaLib data stays in page memory only. The complete API object
   remains available in collapsed technical details for development. */
const niceLabels = {
  name:"Sortenname",name_norm:"Sortenkennung",breeder:"Breeder",breeders:"Breeder",
  origin:"Herkunft",origins:"Herkunft",country:"Land",region:"Region",aliases:"Weitere Namen",
  genetics:"Genetik",lineage:"Abstammung",parents:"Elternpflanzen",descendants:"Nachkommen",
  ancestors:"Vorfahren",branches:"Varianten und Zuchtlinien",crosses:"Kreuzungen",
  thc:"THC",cbd:"CBD",cbg:"CBG",cbn:"CBN",thcv:"THCV",cbdv:"CBDV",
  cannabinoid:"Cannabinoid",cannabinoids:"Cannabinoide",chemistry:"Chemische Analyse",
  potency:"Wirkstoffgehalt",terpenes:"Terpene",terpene_profile:"Terpenprofil",
  aroma:"Aroma",aromas:"Aromen",flavors:"Geschmack",flavor:"Geschmack",
  effects:"Wirkungen",effect:"Wirkung",medical:"Medizinische Angaben",
  indica:"Indica",sativa:"Sativa",ruderalis:"Ruderalis",
  indica_percent:"Indica-Anteil (%)",sativa_percent:"Sativa-Anteil (%)",
  flowering:"Blütetyp",flowering_time:"Blütezeit",flowering_days:"Blütezeit (Tage)",
  flowering_weeks:"Blütezeit (Wochen)",yield:"Ertrag",height:"Pflanzenhöhe",
  height_cm:"Pflanzenhöhe (cm)",harvest:"Ernte",cultivation:"Pflanzeneigenschaften",
  description:"Beschreibung",summary:"Zusammenfassung",notes:"Anmerkungen",
  awards:"Auszeichnungen",cups:"Wettbewerbe",sources:"Quellen",source:"Quelle",
  references:"Referenzen",evidence:"Belege",media:"Medien",images:"Bilder",
  pictures:"Bilder",photos:"Fotos",url:"Link",link:"Link",
  confidence:"Verlässlichkeit",verification:"Überprüfung",status:"Status",
  updated_at:"Aktualisiert",created_at:"Erstellt",id:"ID"
};
const friendlyLabel=k=>niceLabels[k]||label(k);
const groupDefs=[
  {title:"Genetik & Herkunft",icon:"diagram-3",re:/^(genetic|lineage|parent|child|descendant|ancestor|offspring|cross|branch|breeder|origin|country|region|indica|sativa|ruderalis|type$|aliases|strain_type)/i},
  {title:"Cannabinoide & Terpene",icon:"droplet",re:/^(thc|cbd|cbg|cbn|thcv|cbdv|cannabinoid|terpene|chem|lab|potency|compound|profile|analysis|test|thc_|cbd_)/i},
  {title:"Aroma & Wirkungen",icon:"flower1",re:/^(aroma|flavor|taste|effect|medical|smell|fragrance|sensory)/i},
  {title:"Blüte, Ertrag & Pflanzenprofil",icon:"leaf",re:/^(flower|harvest|yield|height|plant|cultivation|growth|seed|auto|photoperiod|climate|indoor|outdoor)/i},
  {title:"Beschreibung & Besonderheiten",icon:"journal-text",re:/^(description|summary|note|about|history|background|award|cup|category|classification)/i},
  {title:"Quellen, Nachweise & Medien",icon:"link-45deg",re:/^(source|reference|citation|evidence|url|link|media|picture|image|photo|video|license|attribution|credit)/i}
];
function scalarText(v){
  if(v===null||v===undefined||v==="")return '<span class="text-secondary">Nicht angegeben</span>';
  if(typeof v==="boolean")return v?"Ja":"Nein";
  const str=typeof v==="number"?new Intl.NumberFormat("de-DE",{maximumFractionDigits:5}).format(v):String(v);
  const url=safeURL(str);
  return url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(new URL(url).hostname)+'</a>':esc(str);
}
function valueView(v,depth=0){
  if(depth>7)return '<span class="text-secondary">Weitere Ebenen unter „Technische Details“</span>';
  if(v===null||v===undefined||v==="")return '<span class="text-secondary">Nicht angegeben</span>';
  if(Array.isArray(v)){
    if(!v.length)return '<span class="text-secondary">Keine Angaben</span>';
    if(v.every(x=>x===null||typeof x!=="object"))
      return '<div class="d-flex flex-wrap gap-2">'+v.map(x=>'<span class="badge rounded-pill value-chip">'+scalarText(x)+'</span>').join("")+'</div>';
    return '<div class="d-grid gap-2">'+v.map((x,i)=>'<div class="nested-entry"><span class="tiny text-secondary">Eintrag '+(i+1)+'</span>'+valueView(x,depth+1)+'</div>').join("")+'</div>';
  }
  if(typeof v==="object"){
    const pairs=Object.entries(v).filter(([k,x])=>x!==undefined&&x!==null&&x!==""&&!(Array.isArray(x)&&!x.length));
    if(!pairs.length)return '<span class="text-secondary">Keine Angaben</span>';
    return '<dl class="row g-2 mb-0">'+pairs.map(([k,x])=>'<div class="col-12 col-md-6"><div class="nested-entry h-100"><dt class="field-name">'+esc(friendlyLabel(k))+'</dt><dd class="field-value mb-0">'+valueView(x,depth+1)+'</dd></div></div>').join("")+'</dl>';
  }
  return scalarText(v);
}
function sectionView(title,pairs){
  if(!pairs.length)return "";
  return '<section class="mb-4"><h3 class="h6 fw-bold mb-3">'+esc(title)+'</h3><div class="row g-3">'+pairs.map(([k,v])=>'<div class="col-12 col-md-6"><div class="card data-card h-100"><div class="card-body"><div class="field-name">'+esc(friendlyLabel(k))+'</div><div class="field-value">'+valueView(v)+'</div></div></div></div>').join("")+'</div></section>';
}
function groupedData(data,filter="all"){
  if(!data||typeof data!=="object")return '<div class="alert alert-secondary">Keine strukturierten Daten verfügbar.</div>';
  const content=data.data && typeof data.data==="object" && !Array.isArray(data.data) && Object.keys(data).length<4?data.data:data;
  const all=Object.entries(content).filter(([k,v])=>v!==null&&v!==undefined&&v!==""&&!(Array.isArray(v)&&!v.length));
  const used=new Set();let html="";
  for(const g of groupDefs){
    if(filter==="genetics"&&g.title!=="Genetik & Herkunft")continue;
    if(filter==="sources"&&g.title!=="Quellen, Nachweise & Medien")continue;
    if(filter==="overview"&&["Quellen, Nachweise & Medien"].includes(g.title))continue;
    const found=all.filter(([k])=>g.re.test(k));
    found.forEach(([k])=>used.add(k));
    html+=sectionView(g.title,found);
  }
  if(filter==="all"||filter==="overview"){
    const rest=all.filter(([k])=>!used.has(k));
    if(rest.length)html+=sectionView("Weitere Sorteninformationen",rest);
  }
  return html||'<div class="alert alert-secondary">Zu diesem Bereich wurden keine Werte übermittelt.</div>';
}
function liveHeader(){
  return '<div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3"><span class="badge text-bg-success">Live-Daten</span><a class="small" target="_blank" rel="noopener noreferrer" href="https://cannalib.org">Data by CannaLib</a></div>';
}
function liveNotice(){
  if(state.apiStatus==="loading")return '<div class="alert alert-info" role="status"><span class="spinner-border spinner-border-sm me-2"></span>Live-Daten werden geladen …</div>';
  if(state.apiStatus==="error")return '<div class="alert alert-warning" role="alert">CannaLib konnte nicht geladen werden: '+esc(state.api?.error||"Unbekannter Fehler")+'<div class="mt-2"><button class="btn btn-outline-warning btn-sm" id="retryAPI">Erneut versuchen</button></div></div>';
  if(state.apiStatus==="unmatched")return '<div class="alert alert-warning">Für diesen Sortennamen gibt es keinen eindeutig bestätigten Treffer. Eine Breeder-Zuordnung muss geprüft werden.</div>';
  return "";
}
function consumerLive(filter="all"){
  let output=liveHeader()+liveNotice();
  if(state.apiStatus!=="ready"||!state.api)return output;
  if(state.selected && state.mode==="mine")
    output+='<div class="alert '+(state.selected.apiMatch?"alert-success":"alert-warning")+' small">'+(state.selected.apiMatch?"Name und Breeder wurden abgeglichen.":"Achtung: Der Name stimmt überein, aber der Breeder wurde nicht bestätigt. Die Werte können zu einer anderen Variante gehören.")+'</div>';
  output+=groupedData(state.api,filter);
  if(filter==="all")output+='<div class="accordion mt-4" id="techAccordion"><div class="accordion-item"><h3 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#rawAPIPanel" aria-expanded="false" aria-controls="rawAPIPanel">Technische Details / vollständiges JSON</button></h3><div id="rawAPIPanel" class="accordion-collapse collapse" data-bs-parent="#techAccordion"><div class="accordion-body"><p class="small text-secondary">Nur für Entwickler. Diese Daten werden nicht dauerhaft gespeichert.</p><pre class="json-view">'+esc(JSON.stringify(state.api,null,2))+'</pre></div></div></div></div>';
  return output;
}
function detailRender(){
  const s=state.selected;if(!s)return;
  const tab=state.activeTab,content=$("detailContent");
  if(tab==="overview"){
    content.innerHTML=(state.mode==="mine"?ownOverview(s):"")+consumerLive("overview");
  }else if(tab==="genetics"){
    content.innerHTML=(state.mode==="mine"?ownGenetics(s):"")+consumerLive("genetics");
  }else if(tab==="sources"){
    content.innerHTML=(state.mode==="mine"?sourceView(s):"")+consumerLive("sources");
  }else{
    content.innerHTML='<div class="mb-3"><h3 class="h5 fw-bold">Alle CannaLib-Informationen</h3><p class="text-secondary small">Übersichtlich nach Themen gruppiert. Es werden nur tatsächlich übertragene Werte angezeigt.</p></div>'+consumerLive("all");
  }
  const retry=$("retryAPI");if(retry)retry.addEventListener("click",()=>loadLive(s,true));
}

async function loadLive(s,force=false){const token=++state.requestToken;state.api=null;state.apiStatus="loading";detailRender();try{let url=null;if(state.mode==="all")url=apiUrlFor(s);else{const query=await getAPI(API+"/v1/catalogs/strains?q="+encodeURIComponent(s.name)+"&limit=10");if(token!==state.requestToken)return;const matches=records(query).filter(x=>norm(x.name)===norm(s.name));let exact=matches.filter(x=>norm(x.breeder)===norm(s.breeder));if(exact.length===1){s.apiMatch=true;url=apiUrlFor(exact[0]);}else if(matches.length===1){s.apiMatch=false;url=apiUrlFor(matches[0]);}else{state.apiStatus="unmatched";detailRender();return}}if(!url){state.apiStatus="unmatched";detailRender();return}const details=await getAPI(url);if(token!==state.requestToken)return;state.api=details;state.apiStatus="ready";detailRender()}catch(e){if(token!==state.requestToken)return;state.api={error:e.message};state.apiStatus="error";detailRender()}}
function openDetail(s){state.selected=s;state.apiStatus="idle";state.api=null;state.activeTab="overview";$("detailTitle").textContent=s.name||"Sortenprofil";$("detailBreeder").textContent=s.breeder||"Breeder nicht angegeben";const t=statusTag(s);$("detailBadges").innerHTML='<span class="pill">'+esc(t.text)+'</span>'+(s.sex?'<span class="pill">'+esc(s.sex)+'</span>':'')+'<span class="pill">'+(state.mode==="mine"?"Eigene Sammlung":"CannaLib-Suche")+'</span>';$("overlay").hidden=false;document.body.style.overflow="hidden";$("closeDetail").focus();setTab("overview");loadLive(s)}
function closeDetail(){state.requestToken++;state.api=null;state.selected=null;state.apiStatus="idle";$("detailContent").replaceChildren();$("overlay").hidden=true;document.body.style.overflow=""}
function setTab(tab){state.activeTab=tab;document.querySelectorAll(".tabs button").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));detailRender()}
document.querySelectorAll(".tabs button").forEach(el=>el.addEventListener("click",()=>setTab(el.dataset.tab)));
$("modeMine").addEventListener("click",()=>setMode("mine"));$("modeAll").addEventListener("click",()=>setMode("all"));
["search","breeder","type","sort"].forEach(id=>$(id).addEventListener(id==="search"?"input":"change",doSearch));
$("closeDetail").addEventListener("click",closeDetail);$("shade").addEventListener("click",closeDetail);
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("overlay").hidden)closeDetail()});
$("themeToggle").addEventListener("click",()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==="dark"?"light":"dark";document.documentElement.dataset.bsTheme=document.documentElement.dataset.theme});
async function init(){try{const r=await fetch(SOURCE,{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);const d=await r.json();state.owned=d.strains||[];$("totalNumber").textContent=String(state.owned.length);configure();localSearch();state.loaded=true}catch(e){setStatus("Katalog nicht verfügbar: "+e.message);$("empty").hidden=false;$("empty").textContent="Der statische Katalog konnte nicht geladen werden."}}init();
