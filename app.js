"use strict";

/* ----------------------------- Helpers & état ----------------------------- */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const num = v => Number((v ?? 0).toString().replace(',', '.'));
const shuffle = a => { for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };

const KEY = "oa360_progress";
const state = JSON.parse(localStorage.getItem(KEY) || '{"score":0,"done":0,"streak":0}');
const save  = () => localStorage.setItem(KEY, JSON.stringify(state));
const renderKPIs = () => {
  const ratio = state.done ? Math.round(state.score*100/state.done) : 0;
  $("#kpi-score") && ($("#kpi-score").textContent = ratio + "%");
  $("#kpi-done")  && ($("#kpi-done").textContent  = state.done);
  $("#kpi-streak")&& ($("#kpi-streak").textContent= state.streak);
};

/* ------------------------------ Navigation SPA --------------------------- */
function show(view){
  $$(".view").forEach(v => v.classList.remove("show"));
  $("#view-"+view).classList.add("show");
  $$("#nav button").forEach(b=> b.classList.toggle("active", b.dataset.view === view));
  history.replaceState(null,"","#"+view);
  renderKPIs();
}
function initNav(){
  $$("#nav button, .go").forEach(b => b.addEventListener("click", e => {
    const v = e.currentTarget.dataset.view;
    if(v) show(v);
  }));
  const hash = location.hash.replace("#","");
  if(hash && $("#view-"+hash)) show(hash);
  else show("home");
}

/* ------------------------------ Module TU -------------------------------- */
function decideTU(){
  const t = $$("input[name='tu-type']").find(x=>x.checked)?.value;
  const ech = $("#tu-ech").checked;
  const unit= $("#tu-unit").checked;
  const ceil= $("#tu-ceil").checked;
  const wrong=$("#tu-wrong").checked;
  const out = $("#tu-out");

  if(!t) return out.className="warn", out.innerHTML="Choisis AF ou E.";
  if(!ech) return out.className="bad",  out.innerHTML="❌ Échéancier KO → <b>Redmine ASSET SU</b>.";
  if(unit)  return out.className="ok",   out.innerHTML = (t==="AF")
       ? "✅ Inversion d’unités (valeur identique) → <b>corriger l’unité</b> dans l’AF."
       : "✅ Inversion d’unités (valeur identique) → échéancier OK → <b>BAP</b>.";
  if(ceil)  return out.className=(t==="AF"?"ok":"bad"), out.innerHTML = (t==="AF")
       ? "✅ Au-dessus du plafond → <b>appliquer le plafond</b> (AF)."
       : "❌ Au-dessus du plafond côté producteur → <b>BAR facture E</b>.";
  if(wrong) return out.className="bad", out.innerHTML = (t==="AF")
       ? "❌ Tarif unitaire faux côté AF → <b>corriger l’AF</b> (aucune tolérance)."
       : "❌ Tarif unitaire faux côté producteur → <b>BAR</b>.";

  out.className="ok"; out.innerHTML="✅ Rien d’anormal détecté côté tarif unitaire.";
}
function resetTU(){
  $$("input[name='tu-type']").forEach(x=>x.checked=false);
  $("#tu-ech").checked = true;
  ["tu-unit","tu-ceil","tu-wrong"].forEach(id => $("#"+id).checked=false);
  $("#tu-out").className="warn"; $("#tu-out").innerHTML="👉 Coche/choisis puis « Décider ».";
}

/* --------------------------- Module Montant total ------------------------- */
function decideMT(){
  const t = $$("input[name='mt-type']").find(x=>x.checked)?.value;
  const f = num($("#mt-futu").value), c = num($("#mt-compta").value);
  const cause = $("#mt-cause").checked;
  const out = $("#mt-out");

  if(!t) return out.className="warn", out.innerHTML="Choisis AF ou E.";
  if(f===c) return out.className="ok", out.innerHTML="✅ Montants identiques → <b>OK</b>.";

  if(t==="AF"){
    const d = Math.abs(c-f).toFixed(2);
    out.className="bad"; out.innerHTML = `❌ Écart de ${d} € sur AF → <b>corriger le 2ᵉ montant total</b> (même si &lt; 1 €).`;
    return;
  }
  const delta = Math.abs(c-f);
  if(delta<=1){
    out.className = cause ? "bad" : "ok";
    out.innerHTML = cause
      ? "❌ Facture E : écart ≤ 1 € mais <b>causé par un tarif unitaire faux</b> → <b>BAR</b>."
      : "✅ Facture E : écart ≤ 1 € lié à <b>Q×TU/arrondis</b> → <b>BAP</b>.";
  }else{
    out.className="bad"; out.innerHTML="❌ Facture E : écart &gt; 1 € → <b>BAR</b> (demander facture corrigée).";
  }
}
function resetMT(){
  $$("input[name='mt-type']").forEach(x=>x.checked=false);
  $("#mt-futu").value="2031.60"; $("#mt-compta").value="2031.60"; $("#mt-cause").checked=false;
  $("#mt-out").className="warn"; $("#mt-out").innerHTML="👉 Renseigne les montants puis « Décider ».";
}

/* -------------------------------- Module TVA ------------------------------ */
function decideTVA(){
  const ttc = $("#tva-ttc").checked;
  const m = $("#tva-mention").value;
  const out = $("#tva-out");
  if(ttc) return out.className="bad", out.innerHTML="❌ Facture papier en <b>TTC</b> → <b>BAR</b>.";
  if(m!=="autoliquidation") return out.className="bad", out.innerHTML="❌ PRO sans la mention « autoliquidation » → <b>BAR</b>.";
  out.className="ok"; out.innerHTML="✅ Papier HT + mention « autoliquidation » → <b>OK</b>.";
}
function resetTVA(){
  $("#tva-ttc").checked=false; $("#tva-mention").value="autoliquidation";
  $("#tva-out").className="warn"; $("#tva-out").innerHTML="👉 Coche/choisis puis « Décider ».";
}

/* -------------------------------- Exercices ------------------------------- */
// Pas de fetch : la banque d’exos est embarquée → fonctionne partout
const EXOS = [
  {q:"Facture E. Échéancier OK. Tarif unitaire déclaré : 12,900 c€/kWh ; attendu : 13,906 c€/kWh (pas une histoire d’unités).", ok:"BAR", why:"Le tarif unitaire déclaré ne correspond pas à l’échéancier (et l’échéancier est OK).", rule:"E + TU faux = BAR", action:"Renvoie la facture au producteur (BAR)."},
  {q:"AF. Le producteur a écrit 0,13906 € au lieu de 13,906 c€/kWh (même valeur).", ok:"Corriger AF (unité)", why:"Seule tolérance : inversion des unités €↔c€ à valeur identique.", rule:"Inversion d’unités = OK", action:"Corrige l’unité côté AF, pas le prix."},
  {q:"Facture E. FUTUNOA 2031,60 € ; compta 2032,20 € ; cause = arrondis.", ok:"BAP", why:"Écart ≤ 1 € expliqué par Q×TU/arrondis.", rule:"E ±1 € (arrondis) = BAP", action:"Valide (BAP)."},
  {q:"AF. FUTUNOA 2031,60 € ; compta 2032,20 €.", ok:"Corriger total", why:"AF : pas de tolérance opérationnelle.", rule:"AF = corriger le 2ᵉ montant", action:"Corrige le 2ᵉ montant total."},
  {q:"Facture papier : TTC.", ok:"BAR", why:"Autoliquidation depuis 01/04/2012 : pas de TVA facturée.", rule:"Papier TTC = BAR", action:"Demande une facture HT (BAR)."},
  {q:"Facture PRO : mention 293 B au lieu d’« autoliquidation ».", ok:"BAR", why:"Pour PRO, la mention « autoliquidation » est obligatoire.", rule:"PRO sans autoliquidation = BAR", action:"Demande correction (BAR)."},
  {q:"AF. Tarif unitaire au-dessus du plafond.", ok:"Corriger AF (plafond)", why:"On applique le plafond du contrat côté AF.", rule:"Plafond → appliquer", action:"Corrige la valeur (plafond)."},
  {q:"E. Tarif unitaire au-dessus du plafond, échéancier OK.", ok:"BAR", why:"Le producteur dépasse le plafond alors que l’échéancier est bon.", rule:"E + plafond dépassé = BAR", action:"Renvoie la facture au producteur (BAR)."}
];

function sample8(){ return shuffle([...EXOS]).slice(0,8); }

function renderExos(){
  const list = $("#exos-list");
  list.innerHTML = "";
  sample8().forEach((o,idx) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="k">🧩 Cas ${idx+1}</div>
      <div style="margin:8px 0">${o.q}</div>
      <div class="row">
        <button class="btn ghost">BAP</button>
        <button class="btn ghost">BAR</button>
        <button class="btn ghost">Corriger AF (unité)</button>
        <button class="btn ghost">Corriger AF (plafond)</button>
        <button class="btn ghost">Corriger total</button>
      </div>
      <div class="explain"></div>
    `;
    card.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      const ans = b.textContent.trim();
      const ok = ans === o.ok;
      state.done++; if(ok) state.score++; save(); renderKPIs();
      const box = card.querySelector(".explain");
      box.innerHTML = `
        <div class="${ok?'ok':'bad'}">
          <b>${ok?'Bonne réponse':'Mauvaise réponse'}</b><br>
          Décision attendue : <b>${o.ok}</b>
          <div class="rule">Règle : ${o.rule}</div>
          <p class="k">Pourquoi : ${o.why}</p>
          <p><b>Action :</b> ${o.action}</p>
        </div>`;
    }));
    list.appendChild(card);
  });
}

/* --------------------------------- Init ----------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  initNav();
  renderKPIs();

  // TU
  $("#tu-decide").addEventListener("click", decideTU);
  $("#tu-reset").addEventListener("click", resetTU);

  // Montant
  $("#mt-decide").addEventListener("click", decideMT);
  $("#mt-reset").addEventListener("click", resetMT);

  // TVA
  $("#tva-decide").addEventListener("click", decideTVA);
  $("#tva-reset").addEventListener("click", resetTVA);

  // Exercices
  $("#exos-reload").addEventListener("click", renderExos);
  $("#exos-reset").addEventListener("click", () => { localStorage.removeItem(KEY); location.reload(); });
  renderExos();
});
