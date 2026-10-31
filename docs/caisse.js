"use strict";
// caisse.js : accueil, saisie des opérations, autres lignes du cahier, journal, ouverture, relève et clôture.

function trialBanner() {
  if (demoOn()) return `<div class="banner demo">${t("Mode démonstration : les chiffres sont des exemples.")} <button class="link" id="quitdemo">${t("Quitter")}</button></div>`;
  return "";
}

// ---------- Alertes de liquide et de solde, prévision, retraits annoncés, rappel de clôture
function forecast(day) {
  // besoin net de liquide (retraits - dépôts) les mêmes jours de semaine des 4 dernières semaines
  const vals = [7, 14, 21, 28].map((n) => addDays(day, -n)).filter((d) => S.days[d]).map((d) => sum(liveMM(d), (o) => (o.type === "retrait" ? o.amount : -o.amount)));
  if (vals.length < 2) return null;
  let need = Math.max(0, Math.round(sum(vals) / vals.length / 1000) * 1000);
  const dom = +day.slice(8), reasons = [];
  if (dom >= 25 || dom <= 5) { need = Math.round(need * 1.3); reasons.push(t("fin de mois")); }
  const fete = S.fetes.find((f) => f.date === addDays(day, 1) || f.date === day);
  if (fete) { need = Math.round(need * 1.5); reasons.push(fete.label); }
  if ((S.marketDays || []).includes(new Date(day + "T12:00:00").getDay())) { need = Math.round(need * 1.2); reasons.push(t("jour de marché")); }
  return { need, reasons };
}
function alerts(day, b) {
  const out = [];
  const seuilCash = S.seuils.cash || 0;
  if (seuilCash && b.cash < seuilCash) out.push(["ko", t("Tu vas manquer de liquide : il te reste {m}, ton minimum est {s}.", { m: fmt(b.cash), s: fmt(seuilCash) })]);
  for (const o of OPS()) {
    const s = (S.seuils.float || {})[o.id] || 0, v = b.float[o.id] || 0;
    if (s && v < s) out.push(["ko", t("Recharge ton solde {op} : il reste {m} (minimum {s}).", { op: o.name, m: fmt(v), s: fmt(s) })]);
  }
  const ann = S.annonces.filter((a) => a.date === day && !a.done);
  const annTotal = sum(ann, (a) => a.amount);
  for (const a of ann) out.push(["warn", t("Retrait annoncé aujourd'hui : {c}, {m}.", { c: esc(a.client), m: fmt(a.amount) })]);
  if (annTotal && b.cash < annTotal + seuilCash) out.push(["ko", t("Ton liquide ne suffit pas pour les retraits annoncés ({m}).", { m: fmt(annTotal) })]);
  const fc = forecast(day);
  if (fc && fc.need > 0) {
    const short = b.cash < fc.need;
    out.push([short ? "warn" : "info", t("Prévision : environ {m} de liquide sortent un jour comme aujourd'hui{r}.", { m: fmt(fc.need), r: fc.reasons.length ? " (" + fc.reasons.join(", ") + ")" : "" })]);
  }
  const d = S.days[day];
  if (d && !d.close && S.closeAt && timeNow() >= S.closeAt) out.push(["warn", `${t("Il est l'heure de clôturer la caisse.")} <a href="#cloture">${t("Clôturer")}</a>`]);
  return out;
}
const timeNow = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

// ---------- Accueil
// « Ma journée en 3 étapes » : où en est la journée, et l'étape suivante en évidence
function dayGuide(day) {
  const d = S.days[day], n = live(day).length;
  const steps = [
    [!!(d && d.open), t("Ouvrir le matin"), t("Compte le liquide et note le solde de chaque opérateur."), "#ouverture"],
    [n > 0, t("Noter chaque opération"), n ? t("{n} opération(s) notée(s) aujourd'hui.", { n }) : t("Dépôt, retrait, crédit, vente : une ligne à chaque fois."), "#saisie/depot"],
    [!!(d && d.close), t("Clôturer le soir"), t("Recompte, regarde l'écart et envoie le rapport au propriétaire."), "#cloture"],
  ];
  const cur = steps.findIndex((x) => !x[0]);
  return `<div class="card daysteps"><h2>${t("Ma journée en 3 étapes")}</h2><ol>${steps.map(([done, h, p, href], i) =>
    `<li class="${done ? "done" : i === cur ? "now" : ""}"><a href="${href}"><b>${done ? "✓ " : ""}${h}</b><span class="small muted">${p}</span></a></li>`).join("")}</ol></div>`;
}
function viewHome() {
  const day = today(), b = balances(day), d = S.days[day];
  if (!b) {
    $view.innerHTML = `${trialBanner()}
      ${dayGuide(day)}
      <div class="card"><h2>${t("Ouvre ta journée")}</h2>
        <p class="muted">${t("Compte ton liquide et regarde tes soldes électroniques pour commencer.")}</p>
        <a class="btn" href="#ouverture">${t("Ouvrir la journée")}</a></div>
      ${S.ops.length ? "" : `<a class="card linkcard" href="#demo"><b>${t("Essayer avec des exemples")}</b><span class="small muted">${t("Mode démonstration pour découvrir l'appli ou former un nouvel agent.")}</span></a>`}`;
    wireDemo();
    return;
  }
  const tot = totals(day), list = live(day).slice().reverse();
  const al = alerts(day, b);
  $view.innerHTML = `${trialBanner()}
    ${d.close ? `<div class="card note"><p>${t("Journée clôturée à {h}.", { h: timeOf(d.close.at) })} <a href="#cloture">${t("Voir la clôture")}</a></p></div>` : ""}
    <section class="balances" aria-label="${t("Soldes")}">
      <div class="cash ${b.cash < (S.seuils.cash || 0) || b.cash < 0 ? "neg" : ""}"><span class="lbl">${t("Liquide en caisse")}</span><b class="amount">${fmt(b.cash)}</b></div>
      <div class="floats">${OPS().map((o) => { const v = b.float[o.id] || 0, low = v < 0 || v < ((S.seuils.float || {})[o.id] || 0);
        return `<div class="fl ${low ? "neg" : ""}"><span class="lbl">${esc(o.name)}</span><b>${fmt(v)}</b></div>`; }).join("")}</div>
    </section>
    ${al.length ? `<div class="alerts">${al.map(([k, m]) => `<p class="alert ${k}">${m}</p>`).join("")}</div>` : ""}
    <div class="actions">
      <a class="big-btn in" href="#saisie/depot"><span>${t("Dépôt")}</span><small>${t("le client donne du liquide")}</small></a>
      <a class="big-btn out" href="#saisie/retrait"><span>${t("Retrait")}</span><small>${t("le client prend du liquide")}</small></a>
    </div>
    <div class="quickrow">
      <a class="chip" href="#autre/service">${t("Crédit, facture")}</a>
      <a class="chip" href="#autre/vente">${t("Vente")}</a>
      <a class="chip" href="#autre/float">${t("Recharge float")}</a>
      <a class="chip" href="#autre/depense">${t("Dépense")}</a>
      <a class="chip" href="#autre">${t("Autre…")}</a>
    </div>
    <div class="card">
      <div class="row"><h2>${t("Aujourd'hui")}</h2><span class="small muted">${esc(longDay(day))}</span></div>
      <div class="table-wrap"><table class="tot">
        <thead><tr><th>${t("Opérateur")}</th><th>${t("Dépôts")}</th><th>${t("Retraits")}</th><th>${t("Nb")}</th></tr></thead>
        <tbody>${Object.entries(tot).map(([id, r]) => `<tr><th>${esc(opName(id))}</th><td>${fmt(r.depot)}</td><td>${fmt(r.retrait)}</td><td>${r.n}</td></tr>`).join("")}</tbody>
        <tfoot><tr><th>${t("Total")}</th>${["depot", "retrait", "n"].map((k) => { const s = sum(Object.values(tot), (r) => r[k]); return `<td>${k === "n" ? s : fmt(s)}</td>`; }).join("")}</tr></tfoot>
      </table></div>
      <p class="row"><span>${t("Gain du jour")}</span><b class="good">${fmt(gainBetween(day, day))}</b></p>
      ${!OPS().some((o) => hasBareme(o.id)) ? `<p class="small muted">${t("Pour voir tes commissions, saisis tes barèmes dans")} <a href="#baremes">${t("Plus › Barèmes")}</a>.</p>` : ""}
    </div>
    <div class="card">
      <div class="row"><h2>${t("Dernières opérations")}</h2><a class="small" href="#journal">${t("Tout voir")}</a></div>
      ${list.length ? `<ul class="ops">${list.slice(0, 5).map((o) => opRow(o)).join("")}</ul>` : `<p class="muted">${t("Aucune opération pour l'instant. Appuie sur Dépôt ou Retrait.")}</p>`}
    </div>
    ${!d.close ? `<div class="two">${S.users.length > 1 ? `<a class="btn alt" href="#releve">${t("Passer la caisse")}</a>` : ""}<a class="btn alt" href="#cloture">${t("Clôturer la caisse")}</a></div>` : ""}
    ${dayGuide(day)}`;
  wireDemo();
}
function wireDemo() {
  const q = document.getElementById("quitdemo"); if (q) q.onclick = () => exitDemo();
  if (!VOIR && !demoOn()) { $view.insertAdjacentHTML("afterbegin", installCard()); wireInstall(); }
  // lien discret vers l'espace admin, en bas de l'accueil
  if (Compte.enabled && !VOIR && !demoOn()) $view.insertAdjacentHTML("beforeend", `<p class="foot"><a href="#admin">${t("Espace propriétaire")}</a></p>`);
}

// Description d'une ligne du cahier, pour le journal, les rapports et l'export
function describe(o) {
  switch (o.kind) {
    case "mm": return `${t(TYPES[o.type])} · ${opName(o.op)}`;
    case "service": return `${o.label}${o.floatOp ? " · " + opName(o.floatOp) : ""}`;
    case "vente": return `${t("Vente")} · ${o.label}${o.qty > 1 ? " ×" + o.qty : ""}`;
    case "float": return { recharge: t("Recharge de float {op}", { op: opName(o.op) }), donne: t("Échange : liquide donné à {p} ({op})", { p: o.partner, op: opName(o.op) }), recoit: t("Échange : liquide reçu de {p} ({op})", { p: o.partner, op: opName(o.op) }), vidage: t("Électronique {op} revendu", { op: opName(o.op) }) }[o.sub];
    case "pret": return { prete: t("Prêt de liquide à {p}", { p: o.partner }), emprunte: t("Liquide emprunté à {p}", { p: o.partner }), recu: t("Remboursement reçu de {p}", { p: o.partner }), rembourse: t("Remboursement rendu à {p}", { p: o.partner }) }[o.sub];
    case "depense": return `${t("Dépense")} · ${o.label || o.cat}${o.fromCash === false ? " (" + t("hors caisse") + ")" : ""}`;
    case "epargne": return t("Mise de côté (épargne)");
    case "ajust": return o.sub === "apport" ? t("Apport dans la caisse") : t("Prélèvement du patron");
    case "avance": return t("Avance sur salaire · {n}", { n: userName(o.userId) });
  }
  return "";
}
function opRow(o, withActions = false) {
  const e = effect(o), closed = (S.days[o.day] || {}).close;
  const sign = e.cash > 0 ? "in" : e.cash < 0 ? "out" : "";
  return `<li class="op ${sign} ${o.cancelled ? "cancelled" : ""} ${o.flag ? "flagged" : ""}">
    <span class="time">${timeOf(o.t)}</span>
    <span class="what"><b>${esc(describe(o))}</b>${o.phone ? `<br><span class="small muted">${esc(phoneShow(o.phone))}${o.client ? " · " + esc(o.client) : ""}</span>` : ""}
      ${o.commission ? `<br><span class="small good">${t("Commission")} ${fmt(o.commission)}</span>` : ""}
      ${S.users.length > 1 && o.user ? `<br><span class="small muted">${esc(userName(o.user))}</span>` : ""}
      ${o.flag ? `<br><span class="small bad">${t("Opération inhabituelle")}</span>` : ""}
      ${o.cancelled ? `<br><span class="small">${o.correctedBy ? t("Corrigée à {h}", { h: timeOf(o.cancelled) }) : t("Annulée à {h}", { h: timeOf(o.cancelled) })}${o.cancelledBy ? " · " + esc(userName(o.cancelledBy)) : ""}</span>` : ""}
      ${o.corrects ? `<br><span class="small muted">${t("Correction d'une opération")}</span>` : ""}</span>
    <span class="amt">${fmt(o.amount)}</span>
    ${withActions && !o.cancelled && !closed && isBoss() ? `<span class="acts">${o.kind === "mm" ? `<button class="link" data-fix="${o.id}">${t("Corriger")}</button>` : ""}<button class="link" data-cancel="${o.id}">${t("Annuler")}</button></span>` : ""}
    ${withActions && o.phone && o.kind === "mm" && !o.cancelled && !saidStop(o.phone) ? `<span class="acts"><a class="link" href="${waLink(o.phone, receiptText(o))}" target="_blank" rel="noopener">${t("Reçu WhatsApp")}</a></span>` : ""}
  </li>`;
}
function receiptText(o) {
  return t("Reçu {k}\n{d} à {h}\n{x} : {m}\nNuméro : {p}\nMerci de votre confiance.", { k: S.kiosk || CFG.name, d: shortDay(o.day), h: timeOf(o.t), x: describe(o), m: fmt(o.amount), p: phoneFmt(o.phone) }) + "\n\n" + STOP_LINE();
}
// Consentement : chaque message à un client se termine par la ligne STOP, et l'appli n'écrit plus à ceux qui ont dit STOP
const STOP_LINE = () => t("Répondez STOP pour ne plus recevoir de messages.");
const saidStop = (phone) => (S.stop || []).includes(phoneClean(phone));
function setStop(phone, on) { const p = phoneClean(phone); S.stop = (S.stop || []).filter((x) => x !== p); if (on) S.stop.push(p); store.save(); }

// ---------- Saisie rapide d'un dépôt ou d'un retrait
function dayReady() {
  const day = today();
  if (!balances(day)) { go("ouverture"); return false; }
  if (S.days[day].close) {
    $view.innerHTML = `<div class="card"><h2>${t("La journée est clôturée")}</h2><p class="muted">${t("Rouvre la caisse pour noter une nouvelle opération.")}</p>
      <a class="btn" href="#cloture">${t("Voir la clôture")}</a></div>`;
    return false;
  }
  return true;
}
function viewEntry(type = "depot", fixId = null) {
  if (!dayReady()) return;
  const day = today(), ops = OPS(), fix = fixId && S.ops.find((o) => o.id === fixId);
  if (fix) type = fix.type;
  if (!TYPES[type]) type = "depot";
  let op = fix ? fix.op : ops.some((o) => o.id === S.lastOp) ? S.lastOp : ops[0].id;
  $view.innerHTML = `<form id="f" class="entry">
      ${fix ? `<p class="alert warn">${t("Correction : l'ancienne opération restera visible, barrée, avec la nouvelle.")}</p>` : ""}
      <div class="seg" role="group" aria-label="${t("Type d'opération")}">
        ${Object.entries(TYPES).map(([k, v]) => `<button type="button" data-type="${k}" aria-pressed="${k === type}">${t(v)}</button>`).join("")}
      </div>
      <div class="chips" role="group" aria-label="${t("Opérateur")}">
        ${ops.map((o) => `<button type="button" class="chip" data-op="${o.id}" aria-pressed="${o.id === op}">${esc(o.name)}</button>`).join("")}
      </div>
      <label class="field amount-field"><span>${t("Montant")}</span>
        <input id="amount" inputmode="numeric" autocomplete="off" placeholder="0" data-money value="${fix ? fix.amount.toLocaleString("fr-FR") : ""}"><b class="unit">F</b></label>
      <div class="quick">${[1000, 2000, 5000, 10000, 25000, 50000].map((v) => `<button type="button" class="chip" data-add="${v}">+${v.toLocaleString("fr-FR")}</button>`).join("")}<button type="button" class="chip" data-add="0">${t("Effacer")}</button></div>
      <label class="field"><span>${t("Numéro du client (facultatif)")}</span>
        <input id="phone" type="tel" inputmode="tel" maxlength="14" autocomplete="off" placeholder="77 123 45 67" list="clients" value="${fix ? esc(fix.phone || "") : ""}"></label>
      <datalist id="clients">${S.clients.map((c) => `<option value="${esc(phoneFmt(c.phone))}">${esc(c.name)}</option>`).join("")}</datalist>
      <p class="small muted" id="clientinfo"></p>
      <div id="idbox"></div>
      <div class="effect" id="effect"></div>
      <button class="btn" type="submit" id="save">${fix ? t("Enregistrer la correction") : t("Enregistrer")}</button>
      <a class="btn alt" href="${fix ? "#journal" : "#accueil"}">${t("Retour")}</a>
    </form>`;
  wireMoney();
  const amount = document.getElementById("amount"), eff = document.getElementById("effect"), phone = document.getElementById("phone");
  const idbox = document.getElementById("idbox");
  const show = () => {
    $view.querySelectorAll("[data-type]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.type === type));
    $view.querySelectorAll("[data-op]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.op === op));
    const n = num(amount.value), b = balances(day), e = effect({ kind: "mm", type, op, amount: n });
    if (fix) { const back = effect(fix); b.cash -= back.cash; b.float[fix.op] = (b.float[fix.op] || 0) - (back.float[fix.op] || 0); }
    const cashAfter = b.cash + e.cash, floatAfter = (b.float[op] || 0) + e.float[op];
    const com = commissionOf(op, type, n), fee = feeOf(op, type, n), plafond = S.plafonds[op] || 0;
    eff.innerHTML = n ? `<p>${t("Après l'opération")} : ${t("liquide")} <b class="${cashAfter < 0 ? "bad" : ""}">${fmt(cashAfter)}</b> · ${esc(opName(op))} <b class="${floatAfter < 0 ? "bad" : ""}">${fmt(floatAfter)}</b></p>
      ${com ? `<p class="good">${t("Ta commission")} : <b>${fmt(com)}</b></p>` : ""}
      ${fee ? `<p class="muted">${t("Frais pour le client")} : ${fmt(fee)}</p>` : ""}
      ${cashAfter < 0 ? `<p class="bad">${t("Tu n'as pas assez de liquide pour ce retrait.")}</p>` : ""}
      ${floatAfter < 0 ? `<p class="bad">${t("Ton solde {op} ne suffit pas pour ce dépôt.", { op: esc(opName(op)) })}</p>` : ""}
      ${plafond && n > plafond ? `<p class="bad">${t("Au-dessus du plafond que tu as noté pour {op} ({m}).", { op: esc(opName(op)), m: fmt(plafond) })}</p>` : ""}` : "";
    const needId = S.idThreshold && n >= S.idThreshold;
    if (needId && !idbox.innerHTML) idbox.innerHTML = `<div class="card note"><p class="small"><b>${t("Gros montant : note la pièce d'identité du client (règles de l'opérateur).")}</b></p>
        ${selectInput("idtype", [["cni", t("Carte d'identité")], ["passeport", t("Passeport")], ["autre", t("Autre pièce")]], fix && fix.idType, t("Pièce"))}
        ${textInput("idnum", fix && fix.idNum, t("Numéro de la pièce"), 'maxlength="30"')}</div>`;
    if (!needId) idbox.innerHTML = "";
    const p = phoneClean(phone.value), c = S.clients.find((x) => x.phone === p);
    const visits = p.length === 9 ? S.ops.filter((o) => o.phone === p && !o.cancelled).length : 0;
    const sus = p.length === 9 && (S.suspects || []).find((x) => x.phone === p);
    if (sus) { document.getElementById("clientinfo").innerHTML = `<b class="bad">${t("Numéro dans ta liste des suspects : {w}", { w: esc(sus.why || "") })}</b>`; return; }
    document.getElementById("clientinfo").innerHTML = p.length === 9 ? `${c ? `<b>${esc(c.name)}</b> · ` : ""}${t("{n} passage(s)", { n: visits })}${(visits + 1) % (S.loyalty || 20) === 0 ? ` · <b class="good">${t("Ce sera son {n}e passage : cadeau de fidélité !", { n: visits + 1 })}</b>` : ""}` : "";
  };
  $view.querySelectorAll("[data-type]").forEach((b) => b.onclick = () => { type = b.dataset.type; if (!fix) history.replaceState(null, "", "#saisie/" + type); show(); });
  $view.querySelectorAll("[data-op]").forEach((b) => b.onclick = () => { op = b.dataset.op; show(); });
  $view.querySelectorAll("[data-add]").forEach((b) => b.onclick = () => {
    const v = +b.dataset.add, n = v ? num(amount.value) + v : 0;
    amount.value = n ? n.toLocaleString("fr-FR") : ""; show();
  });
  amount.addEventListener("input", show); phone.addEventListener("input", show);
  show();
  document.getElementById("f").onsubmit = (e) => {
    e.preventDefault();
    const n = num(amount.value);
    if (!n) { amount.focus(); eff.innerHTML = `<p class="bad">${t("Écris le montant.")}</p>`; return; }
    const p = phoneClean(phone.value), c = S.clients.find((x) => x.phone === p);
    const o = { id: uid(), t: new Date().toISOString(), day, kind: "mm", type, op, amount: n, phone: p, client: c ? c.name : "", commission: commissionOf(op, type, n), user: ME };
    if (document.getElementById("idtype")) { o.idType = val("idtype"); o.idNum = val("idnum").trim(); }
    if (isUnusual(o)) o.flag = true;
    if (fix) { fix.cancelled = o.t; fix.cancelledBy = ME; fix.correctedBy = o.id; o.corrects = fix.id; }
    S.ops.push(o);
    S.lastOp = op;
    store.save();
    toast(t("{type} {op} de {m} noté.", { type: t(TYPES[type]), op: opName(op), m: fmt(n) }));
    if (p) return viewSaved(o);
    go(fix ? "journal" : "accueil");
  };
}
// Après une opération avec numéro : reçu WhatsApp au client
function viewSaved(o) {
  setTimeout(() => { const b = document.getElementById("stop"); if (b) b.onclick = () => { setStop(o.phone, true); toast(t("Noté : plus de message à ce numéro.")); viewSaved(o); }; });
  $view.innerHTML = `<div class="card"><h2>${t("Opération notée")}</h2>
    <p>${esc(describe(o))} · <b>${fmt(o.amount)}</b> · ${esc(phoneShow(o.phone))}</p>
    ${o.flag ? `<p class="alert warn">${t("Opération inhabituelle : elle apparaîtra dans le rapport du patron.")}</p>` : ""}
    ${saidStop(o.phone) ? `<p class="small muted">${t("Ce client a répondu STOP : pas de message.")}</p>`
      : `<a class="btn" href="${waLink(o.phone, receiptText(o))}" target="_blank" rel="noopener">${t("Envoyer le reçu par WhatsApp")}</a>
    <button class="link" id="stop">${t("Le client a répondu STOP")}</button>`}
    <div class="two"><a class="btn alt" href="#saisie/${o.type}">${t("Nouvelle opération")}</a><a class="btn alt" href="#accueil">${t("Caisse")}</a></div></div>`;
}

// ---------- Autres lignes du cahier (services, ventes, float, prêts, dépenses, épargne)
const AUTRES = [
  ["service", "Crédit, pass, facture", "Crédit téléphonique, pass internet, Senelec, Sen'Eau, Woyofal, photocopies…"],
  ["vente", "Vente d'un produit", "Cartes SIM, chargeurs, écouteurs, épicerie (le stock baisse)"],
  ["float", "Recharge ou échange de float", "Super-agent, échange de liquide avec un voisin"],
  ["pret", "Prêt de liquide", "Prêter ou emprunter du liquide à un agent voisin"],
  ["depense", "Dépense", "Loyer, électricité, salaire, transport pour la recharge…"],
  ["epargne", "Mettre de côté", "Épargne sortie de la caisse"],
  ["ajust", "Apport ou prélèvement", "Le patron ajoute ou retire du liquide"],
];
const DEP_CATS = ["Loyer", "Électricité", "Salaire", "Transport (recharge de float)", "Téléphone et internet", "Fournitures", "Patente et impôts", "Autre"];
function viewOther(kind) {
  if (!kind) {
    $view.innerHTML = `<h1>${t("Noter autre chose")}</h1>
      <div class="menu">${AUTRES.map(([k, l, d]) => `<a class="menu-item" href="#autre/${k}"><b>${t(l)}</b><span>${t(d)}</span></a>`).join("")}</div>`;
    return;
  }
  if (!dayReady()) return;
  const day = today(), ops = OPS(), opOpts = ops.map((o) => [o.id, o.name]);
  const forms = {
    service: () => {
      if (!S.services.length) return `<p class="muted">${t("Aucun service enregistré.")} <a href="#services">${t("Ajoute tes services")}</a></p>`;
      return `${selectInput("svc", S.services.map((s) => [s.id, s.name]), S.lastSvc, t("Service"))}
        ${moneyInput("amount", "", t("Montant payé par le client"))}
        ${textInput("phone", "", t("Numéro du client (facultatif)"), 'type="tel" inputmode="tel" maxlength="14"')}
        <p class="small muted" id="svcinfo"></p>`;
    },
    vente: () => {
      if (!S.stock.length) return `<p class="muted">${t("Aucun produit enregistré.")} <a href="#stock">${t("Ajoute tes produits")}</a></p>`;
      return `${selectInput("item", S.stock.map((s) => [s.id, `${s.name} (${s.qty} ${t("en stock")})`]), "", t("Produit"))}
        ${textInput("qty", "1", t("Quantité"), 'inputmode="numeric" maxlength="4"')}
        ${moneyInput("amount", "", t("Prix total"))}`;
    },
    float: () => `${selectInput("sub", [["recharge", t("Recharge chez le super-agent (je donne du liquide)")], ["vidage", t("Revente d'électronique au super-agent (je reçois du liquide)")], ["donne", t("Échange : je donne du liquide à un voisin")], ["recoit", t("Échange : je reçois du liquide d'un voisin")]], "recharge", t("Type"))}
        ${selectInput("op", opOpts, ops[0].id, t("Opérateur"))}
        ${moneyInput("amount", "", t("Montant"))}
        ${textInput("partner", "", t("Avec qui (super-agent ou voisin)"), 'maxlength="40"')}
        ${moneyInput("fee", "", t("Coût de la recharge (transport, frais)"))}
        <label class="check"><input type="checkbox" id="feecash" checked> ${t("Coût payé avec le liquide de la caisse")}</label>`,
    pret: () => {
      const open = openLoans();
      return `${selectInput("sub", [["prete", t("Je prête du liquide")], ["emprunte", t("J'emprunte du liquide")], ["recu", t("On me rembourse")], ["rembourse", t("Je rembourse")]], "prete", t("Type"))}
        ${textInput("partner", "", t("Agent voisin"), 'maxlength="40" list="partners"')}
        <datalist id="partners">${[...new Set(S.ops.filter((o) => o.kind === "pret" || o.kind === "float").map((o) => o.partner).filter(Boolean))].map((p) => `<option value="${esc(p)}">`).join("")}</datalist>
        ${moneyInput("amount", "", t("Montant"))}
        ${open.length ? `<div class="card note"><b class="small">${t("Prêts en cours")}</b>${open.map((l) => `<p class="small">${esc(l.partner)} : ${l.bal > 0 ? t("te doit {m}", { m: fmt(l.bal) }) : t("tu lui dois {m}", { m: fmt(-l.bal) })}</p>`).join("")}</div>` : ""}`;
    },
    depense: () => `${selectInput("cat", DEP_CATS.map((c) => [c, t(c)]), "Loyer", t("Catégorie"))}
        ${textInput("label", "", t("Détail (facultatif)"), 'maxlength="60"')}
        ${moneyInput("amount", "", t("Montant"))}
        <label class="check"><input type="checkbox" id="fromcash" checked> ${t("Payé avec le liquide de la caisse")}</label>`,
    epargne: () => `${moneyInput("amount", "", t("Montant mis de côté"))}${S.epargne.goal ? `<p class="small muted">${t("Objectif : {g}. Déjà mis de côté : {m}.", { g: fmt(S.epargne.goal), m: fmt(savedTotal()) })}</p>` : ""}`,
    ajust: () => `${selectInput("sub", [["apport", t("Apport : j'ajoute du liquide dans la caisse")], ["prelevement", t("Prélèvement : le patron retire du liquide")]], "apport", t("Type"))}${moneyInput("amount", "", t("Montant"))}${textInput("label", "", t("Note (facultatif)"), 'maxlength="60"')}`,
  };
  const title = (AUTRES.find((a) => a[0] === kind) || [])[1];
  if (!forms[kind]) return go("autre");
  $view.innerHTML = `<h1>${t(title)}</h1><form class="card" id="f">${forms[kind]()}
    <p class="msg-ko" id="err" hidden></p>
    <button class="btn" type="submit">${t("Enregistrer")}</button><a class="btn alt" href="#autre">${t("Retour")}</a></form>`;
  wireMoney();
  if (kind === "service") {
    const info = () => { const s = S.services.find((x) => x.id === val("svc")), n = num(val("amount")); if (!s) return;
      document.getElementById("svcinfo").textContent = s.mode === "revenu" ? t("Tout le montant est un revenu du kiosque.") : `${s.floatOp ? t("Payé avec ton solde {op}.", { op: opName(s.floatOp) }) + " " : ""}${t("Ta commission")} : ${fmt(serviceCommission(s, n))}`; };
    $view.querySelectorAll("#svc,#amount").forEach((i) => i.addEventListener("input", info)); info();
  }
  if (kind === "vente") {
    const fill = () => { const it = S.stock.find((x) => x.id === val("item")); if (it) document.getElementById("amount").value = (it.price * Math.max(1, num(val("qty")))).toLocaleString("fr-FR"); };
    $view.querySelectorAll("#item,#qty").forEach((i) => i.addEventListener("input", fill)); fill();
  }
  document.getElementById("f").onsubmit = (e) => {
    e.preventDefault();
    const err = document.getElementById("err"), fail = (m) => { err.textContent = m; err.hidden = false; };
    const n = num(val("amount"));
    if (!n) return fail(t("Écris le montant."));
    const o = { id: uid(), t: new Date().toISOString(), day, kind, amount: n, user: ME };
    if (kind === "service") {
      const s = S.services.find((x) => x.id === val("svc"));
      Object.assign(o, { svc: s.id, label: s.name, floatOp: s.mode === "revenu" ? "" : s.floatOp || "", commission: serviceCommission(s, n), phone: phoneClean(val("phone")) });
      S.lastSvc = s.id;
    } else if (kind === "vente") {
      const it = S.stock.find((x) => x.id === val("item")), q = Math.max(1, num(val("qty")));
      if (it.qty < q) return fail(t("Il ne reste que {n} en stock.", { n: it.qty }));
      it.qty -= q;
      Object.assign(o, { item: it.id, label: it.name, qty: q, cost: it.cost });
      if (it.min && it.qty <= it.min) setTimeout(() => toast(t("Stock bas : il reste {n} {p}.", { n: it.qty, p: it.name })), 2700);
    } else if (kind === "float") {
      Object.assign(o, { sub: val("sub"), op: val("op"), partner: val("partner").trim(), fee: num(val("fee")), feeCash: document.getElementById("feecash").checked });
      if (o.sub !== "recharge") o.fee = 0;
    } else if (kind === "pret") {
      Object.assign(o, { sub: val("sub"), partner: val("partner").trim() });
      if (!o.partner) return fail(t("Écris le nom de l'agent voisin."));
    } else if (kind === "depense") {
      Object.assign(o, { cat: val("cat"), label: val("label").trim() || t(val("cat")), fromCash: document.getElementById("fromcash").checked });
    } else if (kind === "ajust") {
      Object.assign(o, { sub: val("sub"), label: val("label").trim() });
    }
    S.ops.push(o);
    store.save();
    toast(t("{x} : {m} noté.", { x: describe(o), m: fmt(n) }));
    go("accueil");
  };
}
const serviceCommission = (s, n) => (s.mode === "revenu" ? n : s.comType === "pct" ? Math.round((n * (s.com || 0)) / 100) : s.com || 0);
const savedTotal = () => sum(S.ops.filter((o) => o.kind === "epargne" && !o.cancelled), (o) => o.amount);
function openLoans() {
  const m = {};
  for (const o of S.ops.filter((x) => x.kind === "pret" && !x.cancelled)) {
    const k = o.partner.trim().toLowerCase(), l = (m[k] = m[k] || { partner: o.partner, bal: 0, last: o.day });
    l.bal += o.sub === "prete" || o.sub === "rembourse" ? o.amount : -o.amount; l.last = o.day;
  }
  return Object.values(m).filter((l) => l.bal !== 0);
}

// ---------- Journal : on n'efface jamais, une opération annulée ou corrigée reste visible
function viewJournal(arg) {
  const q = arg && arg.startsWith("q=") ? decodeURIComponent(arg.slice(2)) : "";
  const day = arg && /^\d{4}-\d\d-\d\d$/.test(arg) ? arg : today();
  const days = Object.keys(S.days).sort();
  const prev = days.filter((d) => d < day).pop(), next = days.find((d) => d > day);
  let rows, head;
  if (q) {
    const p = phoneClean(q), d = /^\d{4}-\d\d-\d\d$/.test(q) ? q : null;
    rows = S.ops.filter((o) => (d ? o.day === d : (p.length >= 3 && (o.phone || "").includes(p)) || (o.client || "").toLowerCase().includes(q.toLowerCase()) || (o.partner || "").toLowerCase().includes(q.toLowerCase()))).slice().reverse().slice(0, 300);
    head = `<h1>${t("Recherche : {q}", { q: esc(q) })}</h1><p class="small muted">${t("{n} résultat(s)", { n: rows.length })}</p>`;
  } else {
    rows = S.ops.filter((o) => o.day === day).slice().reverse();
    head = `<div class="row daynav">
      ${prev ? `<a class="chip" href="#journal/${prev}">‹ ${t("Avant")}</a>` : "<span></span>"}
      <h1>${esc(longDay(day))}</h1>
      ${next ? `<a class="chip" href="#journal/${next}">${t("Après")} ›</a>` : "<span></span>"}</div>`;
  }
  $view.innerHTML = `<form class="search" id="sf"><input id="q" type="search" placeholder="${t("Numéro du client, nom ou date")}" value="${esc(q)}" autocomplete="off"><input id="qd" type="date" value="${q ? "" : day}" aria-label="${t("Date")}"><button class="btn" type="submit">${t("Chercher")}</button></form>
    ${head}
    <div class="card">${rows.length ? `<ul class="ops">${rows.map((o) => (q ? `<li class="opday">${esc(shortDay(o.day))}</li>` : "") + opRow(o, true)).join("")}</ul>` : `<p class="muted">${t("Aucune opération.")}</p>`}</div>
    ${!isBoss() ? `<p class="small muted">${t("Pour annuler ou corriger une opération, demande au patron.")}</p>` : ""}
    <div id="confirm"></div>`;
  document.getElementById("sf").onsubmit = (e) => { e.preventDefault(); const v = val("q").trim(); go(v ? "journal/q=" + encodeURIComponent(v) : "journal/" + (val("qd") || today())); };
  document.getElementById("qd").onchange = () => go("journal/" + (val("qd") || today()));
  $view.querySelectorAll("[data-fix]").forEach((b) => b.onclick = () => go("corriger/" + b.dataset.fix));
  $view.querySelectorAll("[data-cancel]").forEach((b) => b.onclick = () => {
    const o = S.ops.find((x) => x.id === b.dataset.cancel);
    confirmBox(document.getElementById("confirm"), t("Annuler « {x} » de {m} ? Elle restera visible, barrée, dans le journal.", { x: esc(describe(o)), m: fmt(o.amount) }), t("Oui, annuler"), () => {
      o.cancelled = new Date().toISOString(); o.cancelledBy = ME;
      if (o.kind === "vente") { const it = S.stock.find((x) => x.id === o.item); if (it) it.qty += o.qty; }
      logEvent("annulation : " + describe(o) + " " + fmt(o.amount));
      store.save(); toast(t("Opération annulée.")); render();
    });
  });
}

// ---------- Ouverture de la journée
function viewOpen() {
  const day = today(), d = S.days[day];
  if (d && d.open && live(day).length) return go("accueil");
  const sug = (d && d.open) || suggestedOpening(day) || { cash: 0, float: {} };
  const askSeuils = isBoss() && noSeuils();
  $view.innerHTML = `<h1>${t("Ouvrir la journée")}</h1>
    <p class="muted">${t("Compte le liquide de la caisse et regarde le solde de chaque opérateur sur ton téléphone d'agent.")}</p>
    ${suggestedOpening(day) && !(d && d.open) ? `<p class="small muted">${t("Montants repris de la dernière clôture. Corrige-les si besoin.")}</p>` : ""}
    <form class="card" id="f">
      ${moneyInput("cash", sug.cash, t("Liquide en caisse"))}
      ${OPS().map((o) => moneyInput("fl-" + o.id, sug.float[o.id], t("Solde {op}", { op: o.name }))).join("")}
      ${askSeuils ? `<fieldset class="field" id="seuils"><legend>${t("Seuils d'alerte, à fixer avec le propriétaire")}</legend>
        <p class="small muted">${t("En dessous de ces montants, l'appli te prévient qu'il faut recharger ou aller chercher du liquide. Tu peux les changer plus tard dans Plus › Float.")}</p>
        ${moneyInput("s-cash", "", t("Liquide minimum"))}
        ${OPS().map((o) => moneyInput("s-" + o.id, "", t("Solde {op} minimum", { op: o.name }))).join("")}</fieldset>` : ""}
      <button class="btn" type="submit">${t("Ouvrir la journée")}</button>
    </form>`;
  wireMoney();
  document.getElementById("f").onsubmit = (e) => {
    e.preventDefault();
    const float = {};
    for (const o of OPS()) float[o.id] = num(val("fl-" + o.id));
    if (askSeuils && (val("s-cash") || OPS().some((o) => val("s-" + o.id)))) S.seuils = { cash: num(val("s-cash")), float: Object.fromEntries(OPS().map((o) => [o.id, num(val("s-" + o.id))])) };
    S.days[day] = { ...(S.days[day] || {}), open: { cash: num(val("cash")), float, at: new Date().toISOString(), by: ME } };
    logEvent("ouverture de caisse");
    store.save(); toast(t("Journée ouverte.")); go("accueil");
  };
}

// ---------- Relève : un employé passe la caisse à un autre (chacun répond de son écart)
function viewHandover() {
  const day = today(), b = balances(day), d = S.days[day];
  if (!b || d.close) return go("accueil");
  const others = S.users.filter((u) => u.id !== ME);
  $view.innerHTML = `<h1>${t("Passer la caisse")}</h1>
    <p class="muted">${t("Compte le liquide avant de passer la caisse. L'écart est noté au nom de {n}.", { n: esc(me().name) })}</p>
    <form class="card" id="f">
      ${moneyInput("cash", "", t("Liquide compté (attendu : {m})", { m: fmt(b.cash) }))}
      ${selectInput("to", others.map((u) => [u.id, u.name]), "", t("Je passe la caisse à"))}
      <p id="ec"></p>
      <button class="btn" type="submit">${t("Passer la caisse")}</button>
    </form>`;
  wireMoney();
  const show = () => { const e = num(val("cash")) - b.cash; document.getElementById("ec").innerHTML = val("cash") ? `${t("Écart")} : <b class="${e ? "bad" : "good"}">${fmtSigned(e)}</b>` : ""; };
  document.getElementById("cash").addEventListener("input", show);
  document.getElementById("f").onsubmit = (e) => {
    e.preventDefault();
    if (!val("cash")) return toast(t("Écris le liquide compté."));
    const counted = num(val("cash"));
    (d.shifts = d.shifts || []).push({ at: new Date().toISOString(), from: ME, to: val("to"), expected: b.cash, cash: counted, ecart: counted - b.cash });
    logEvent("relève vers " + userName(val("to")));
    store.save(); lock();
  };
}

// ---------- Clôture de caisse du soir : ce que dit l'appli contre ce qui est compté
function viewClose() {
  const day = today(), d = S.days[day], b = balances(day);
  if (!b) return go("ouverture");
  const tot = totals(day);
  if (d.close) {
    const c = d.close, rows = [["cash", t("Liquide"), b.cash, c.cash], ...OPS().map((o) => [o.id, o.name, b.float[o.id] || 0, c.float[o.id] || 0])];
    $view.innerHTML = `<h1>${t("Clôture du {d}", { d: esc(longDay(day)) })}</h1>
      ${ecartTable(rows)}
      ${explainEcart(day, sum(rows, (r) => r[3] - r[2]))}
      ${releveTable(day, tot)}
      ${shiftsTable(d)}
      <div class="card"><p class="row"><span>${t("Gain du jour")}</span><b class="good">${fmt(gainBetween(day, day))}</b></p>
        <p class="small muted">${t("Clôturée à {h} par {n}. Ces montants serviront à ouvrir la prochaine journée.", { h: timeOf(c.at), n: esc(userName(c.by)) })}</p></div>
      ${reportBox(day)}
      ${isBoss() ? `<button class="btn alt" id="reopen">${t("Rouvrir la caisse")}</button>` : ""}`;
    wireReportBox(day);
    const r = document.getElementById("reopen");
    if (r) r.onclick = () => { delete d.close; logEvent("caisse rouverte"); store.save(); toast(t("Caisse rouverte.")); go("accueil"); };
    return;
  }
  $view.innerHTML = `<h1>${t("Clôture de caisse")}</h1>
    <p class="muted">${t("Compte ton liquide et note tes soldes réels. L'appli montre l'écart avec ce qu'elle a calculé.")}</p>
    <form class="card" id="f">
      ${moneyInput("cash", "", t("Liquide compté (attendu : {m})", { m: fmt(b.cash) }))}
      ${OPS().map((o) => moneyInput("fl-" + o.id, "", t("Solde {op} réel (attendu : {m})", { op: o.name, m: fmt(b.float[o.id] || 0) }))).join("")}
      <div id="ecart"></div>
      <details class="more"><summary>${t("Comparer avec le relevé de l'opérateur (facultatif)")}</summary>
        <p class="small muted">${t("Recopie les totaux du jour affichés par chaque opérateur.")}</p>
        ${OPS().map((o) => `<div class="two">${moneyInput("rd-" + o.id, "", t("{op} : dépôts", { op: o.name }))}${moneyInput("rr-" + o.id, "", t("{op} : retraits", { op: o.name }))}</div>`).join("")}
      </details>
      <button class="btn" type="submit">${t("Clôturer la journée")}</button>
    </form>`;
  wireMoney();
  const read = () => ({ cash: num(val("cash")), float: Object.fromEntries(OPS().map((o) => [o.id, num(val("fl-" + o.id))])) });
  const show = () => {
    const c = read(), rows = [["cash", t("Liquide"), b.cash, c.cash], ...OPS().map((o) => [o.id, o.name, b.float[o.id] || 0, c.float[o.id]])];
    document.getElementById("ecart").innerHTML = ecartTable(rows) + explainEcart(day, sum(rows, (r) => r[3] - r[2]));
  };
  $view.querySelectorAll("#cash,[id^=fl-]").forEach((i) => i.addEventListener("input", show));
  show();
  document.getElementById("f").onsubmit = (e) => {
    e.preventDefault();
    const empty = [...$view.querySelectorAll("#cash,[id^=fl-]")].filter((i) => i.value.trim() === "");
    if (empty.length) { empty[0].focus(); toast(t("Remplis tous les montants comptés (0 si vide).")); return; }
    const rel = {};
    for (const o of OPS()) if (val("rd-" + o.id) || val("rr-" + o.id)) rel[o.id] = { depot: num(val("rd-" + o.id)), retrait: num(val("rr-" + o.id)) };
    d.close = { ...read(), expected: { cash: b.cash, float: { ...b.float } }, at: new Date().toISOString(), by: ME };
    if (Object.keys(rel).length) S.releves[day] = rel;
    S.annonces.filter((a) => a.date === day).forEach((a) => (a.done = true));
    logEvent("clôture de caisse");
    store.save();
    notify(t("Journée clôturée"), t("Gain du jour : {m}", { m: fmt(gainBetween(day, day)) }));
    toast(t("Journée clôturée."));
    viewClose();
  };
}
function ecartTable(rows) {
  const total = sum(rows, (r) => r[3] - r[2]);
  return `<div class="table-wrap"><table class="tot ecart">
    <thead><tr><th></th><th>${t("Appli")}</th><th>${t("Compté")}</th><th>${t("Écart")}</th></tr></thead>
    <tbody>${rows.map(([, name, exp, got]) => { const e = got - exp; return `<tr><th>${esc(name)}</th><td>${fmt(exp)}</td><td>${fmt(got)}</td><td class="${e === 0 ? "good" : "bad"}">${fmtSigned(e)}</td></tr>`; }).join("")}</tbody>
    <tfoot><tr><th>${t("Écart total")}</th><td></td><td></td><td class="${total === 0 ? "good" : "bad"}">${fmtSigned(total)}</td></tr></tfoot>
  </table></div>`;
}
// Écart expliqué : les opérations qui pourraient l'expliquer
function explainEcart(day, total) {
  if (total === 0) return `<p class="small good">${t("Tout est juste.")}</p>`;
  const a = Math.abs(total), ops = live(day);
  const same = ops.filter((o) => o.amount === a || o.amount * 2 === a);
  const close = ops.filter((o) => !same.includes(o) && Math.abs(o.amount - a) <= Math.max(500, a * 0.1));
  const dup = ops.filter((o, i) => ops.some((x, j) => j < i && x.kind === o.kind && x.amount === o.amount && x.op === o.op && Math.abs(new Date(o.t) - new Date(x.t)) < 10 * 60e3));
  const nophone = ops.filter((o) => o.kind === "mm" && !o.phone);
  const cancelled = S.ops.filter((o) => o.day === day && o.cancelled);
  const list = (title, arr) => arr.length ? `<p class="small"><b>${title}</b></p><ul class="ops">${arr.slice(0, 6).map((o) => opRow(o)).join("")}</ul>` : "";
  return `<div class="card note">
    <p class="small">${total > 0 ? t("Il y a plus que prévu : une opération a peut-être été oubliée.") : t("Il manque de l'argent : vérifie les opérations ci-dessous.")}</p>
    ${list(t("Montant égal à l'écart (ou au double : sens inversé)"), same)}
    ${list(t("Montant proche de l'écart"), close)}
    ${list(t("Doublons possibles (même montant en moins de 10 minutes)"), dup)}
    ${list(t("Annulées aujourd'hui"), cancelled)}
    ${nophone.length ? `<p class="small muted">${t("{n} opération(s) sans numéro de client : plus difficiles à vérifier.", { n: nophone.length })}</p>` : ""}
  </div>`;
}
function releveTable(day, tot) {
  const r = S.releves[day];
  if (!r) return "";
  return `<div class="card"><h2>${t("Relevé de l'opérateur")}</h2><div class="table-wrap"><table class="tot ecart">
    <thead><tr><th></th><th>${t("Appli")}</th><th>${t("Relevé")}</th><th>${t("Écart")}</th></tr></thead>
    <tbody>${Object.entries(r).flatMap(([op, v]) => ["depot", "retrait"].map((k) => { const a = (tot[op] || {})[k] || 0, e = v[k] - a;
      return `<tr><th>${esc(opName(op))} · ${t(TYPES[k]).toLowerCase()}s</th><td>${fmt(a)}</td><td>${fmt(v[k])}</td><td class="${e ? "bad" : "good"}">${fmtSigned(e)}</td></tr>`; })).join("")}</tbody></table></div></div>`;
}
function shiftsTable(d) {
  const sh = d.shifts || [];
  if (!sh.length && S.users.length < 2) return "";
  const c = d.close, expected = c.expected ? c.expected.cash : 0;
  return `<div class="card"><h2>${t("Écarts par personne")}</h2><ul class="ops">
    ${sh.map((s) => `<li class="op"><span class="time">${timeOf(s.at)}</span><span class="what">${esc(userName(s.from))} → ${esc(userName(s.to))}</span><span class="amt ${s.ecart ? "bad" : "good"}">${fmtSigned(s.ecart)}</span></li>`).join("")}
    <li class="op"><span class="time">${timeOf(c.at)}</span><span class="what">${t("Clôture")} · ${esc(userName(c.by))}</span><span class="amt ${c.cash - expected ? "bad" : "good"}">${fmtSigned(c.cash - expected)}</span></li></ul></div>`;
}
function notify(title, body) {
  try { if ("Notification" in window && Notification.permission === "granted") navigator.serviceWorker.ready.then((r) => r.showNotification(title, { body, icon: "icons/icon-192.png" })).catch(() => new Notification(title, { body })); } catch {}
}
// Rappel de clôture à l'heure choisie (quand l'appli est ouverte)
setInterval(() => {
  const d = S.days[today()];
  if (!d || !d.open || d.close || !S.closeAt || timeNow() !== S.closeAt) return;
  notify(t("Clôture de caisse"), t("Il est {h} : compte ton liquide et clôture la journée.", { h: S.closeAt }));
  toast(t("Il est l'heure de clôturer la caisse."));
}, 60000);
