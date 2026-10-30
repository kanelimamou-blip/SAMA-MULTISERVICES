"use strict";
// Téere Xaalis : le cahier de caisse de l'agent de mobile money.
// L'appli ne fait aucun transfert, n'est reliée à aucun opérateur et ne demande jamais de code secret d'opérateur.
const $view = document.getElementById("view");
const $lock = document.getElementById("lock");

// ---------- Données (tout est gardé sur le téléphone : l'appli marche sans connexion)
const KEY = "cahier";
const store = {
  load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } },
  save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} Sync.save(S); },
};
const S = Object.assign({ v: 1, kiosk: "", ops: [], days: {}, operators: null, pin: null, paidUntil: null, usedCodes: [] }, store.load());

const pad = (n) => String(n).padStart(2, "0");
const dayOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => dayOf(new Date());
const addDays = (day, n) => { const d = new Date(day + "T12:00:00"); d.setDate(d.getDate() + n); return dayOf(d); };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => (n < 0 ? "−" : "") + Math.abs(Math.round(n)).toLocaleString("fr-FR") + " F";
const fmtSigned = (n) => (n > 0 ? "+" : "") + fmt(n);
const num = (v) => { const n = parseInt(String(v).replace(/\D/g, ""), 10); return Number.isFinite(n) ? n : 0; };
const phoneFmt = (p) => { const d = String(p || "").replace(/\D/g, ""); return d.length === 9 ? `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}` : d; };
const timeOf = (iso) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const longDay = (day) => new Date(day + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const OPS = () => CFG.operators.filter((o) => (S.operators || []).includes(o.id));
const opName = (id) => (CFG.operators.find((o) => o.id === id) || { name: id }).name;
const TYPES = { depot: "Dépôt", retrait: "Retrait" };

// ---------- Essai et abonnement
if (!S.trialStart) { S.trialStart = today(); store.save(); }
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5);
const trialLeft = () => Math.max(0, CFG.trial_days - daysBetween(S.trialStart, today()));
const paidLeft = () => (S.paidUntil ? Math.max(0, daysBetween(today(), S.paidUntil) + 1) : 0);
const isPremium = () => trialLeft() > 0 || paidLeft() > 0;
const activeOps = (day) => S.ops.filter((o) => o.day === day && !o.cancelled);
const canAdd = () => isPremium() || activeOps(today()).length < CFG.free_ops_per_day;

// ---------- Soldes : liquide (une seule caisse) et solde électronique par opérateur
// Dépôt : le client donne du liquide, l'agent lui envoie de l'électronique -> liquide +, électronique -
// Retrait : l'agent reçoit de l'électronique, il rend du liquide -> liquide -, électronique +
function effect(op) {
  const s = op.type === "depot" ? 1 : -1;
  return { cash: s * op.amount, float: -s * op.amount };
}
function balances(day) {
  const d = S.days[day];
  if (!d || !d.open) return null;
  const b = { cash: d.open.cash, float: { ...d.open.float } };
  for (const op of activeOps(day)) {
    const e = effect(op);
    b.cash += e.cash;
    b.float[op.op] = (b.float[op.op] || 0) + e.float;
  }
  return b;
}
function totals(day) {
  const t = {};
  for (const o of OPS()) t[o.id] = { depot: 0, retrait: 0, n: 0 };
  for (const op of activeOps(day)) {
    const r = (t[op.op] = t[op.op] || { depot: 0, retrait: 0, n: 0 });
    r[op.type] += op.amount; r.n++;
  }
  return t;
}
// Dernière journée ouverte avant ce jour (pour proposer les montants d'ouverture)
function previousDay(day) {
  return Object.keys(S.days).filter((d) => d < day && S.days[d].open).sort().pop() || null;
}
function suggestedOpening(day) {
  const prev = previousDay(day);
  if (!prev) return null;
  const d = S.days[prev];
  if (d.close) return { cash: d.close.cash, float: { ...d.close.float } };
  return balances(prev);
}

// ---------- Petits morceaux d'interface
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 2600);
}
const moneyInput = (id, value, label) => `<label class="field"><span>${esc(label)}</span>
  <input id="${id}" inputmode="numeric" autocomplete="off" placeholder="0" value="${value ? Number(value).toLocaleString("fr-FR") : ""}" data-money></label>`;
// Saisie des montants : on garde les espaces entre milliers pendant la frappe
function wireMoney(root = $view) {
  root.querySelectorAll("[data-money]").forEach((i) => i.addEventListener("input", () => {
    const n = num(i.value); i.value = i.value.trim() === "" ? "" : n.toLocaleString("fr-FR");
  }));
}
function trialBanner() {
  if (paidLeft() > 0) return "";
  if (trialLeft() > 0) return `<a class="banner" href="#abonnement">${t("Essai gratuit : tout est débloqué encore {n} jour(s).", { n: trialLeft() })}</a>`;
  const left = Math.max(0, CFG.free_ops_per_day - activeOps(today()).length);
  return `<a class="banner warn" href="#abonnement">${t("Essai terminé : {n} opération(s) gratuite(s) restante(s) aujourd'hui. Abonne-toi pour ne plus compter.", { n: left })}</a>`;
}

// ---------- Première ouverture : nom du kiosque, opérateurs, code
function viewSetup() {
  document.body.classList.add("bare");
  $view.innerHTML = `<div class="hero">
      <span class="mark big" aria-hidden="true">TX</span>
      <h1>${t("Bienvenue dans {app}", { app: esc(CFG.name) })}</h1>
      <p class="muted">${t("Le cahier de caisse de ton kiosque : tu notes tes dépôts et retraits, l'appli calcule ton liquide et tes soldes.")}</p>
    </div>
    <div class="card note">
      <p><b>${t("L'appli ne fait aucun transfert.")}</b> ${t("Elle n'est pas reliée à Wave, Orange Money ou aux autres. Elle ne te demandera jamais ton code secret d'opérateur.")}</p>
    </div>
    <form class="card" id="f">
      <label class="field"><span>${t("Nom du kiosque")}</span><input id="kiosk" maxlength="40" placeholder="${t("Ex. Kiosque Médina")}" required></label>
      <fieldset class="field"><legend>${t("Opérateurs que tu proposes")}</legend>
        <div class="checks">${CFG.operators.map((o) => `<label class="check"><input type="checkbox" name="op" value="${o.id}" ${o.id === "wave" || o.id === "om" ? "checked" : ""}> ${esc(o.name)}</label>`).join("")}</div>
      </fieldset>
      <fieldset class="field"><legend>${t("Code de l'appli (4 chiffres)")}</legend>
        <p class="small muted">${t("Il protège ton cahier si quelqu'un prend ton téléphone. Choisis un code différent de tes codes Wave ou Orange Money.")}</p>
        <div class="two"><input id="pin1" inputmode="numeric" maxlength="4" placeholder="${t("Code")}" autocomplete="off" class="pin">
        <input id="pin2" inputmode="numeric" maxlength="4" placeholder="${t("Encore une fois")}" autocomplete="off" class="pin"></div>
      </fieldset>
      <p class="msg-ko" id="err" hidden></p>
      <button class="btn" type="submit">${t("Commencer")}</button>
    </form>`;
  document.getElementById("f").onsubmit = async (e) => {
    e.preventDefault();
    const err = document.getElementById("err");
    const ops = [...$view.querySelectorAll("input[name=op]:checked")].map((i) => i.value);
    const p1 = document.getElementById("pin1").value, p2 = document.getElementById("pin2").value;
    const fail = (m) => { err.textContent = m; err.hidden = false; };
    if (!ops.length) return fail(t("Coche au moins un opérateur."));
    if (p1 || p2) {
      if (!/^\d{4}$/.test(p1)) return fail(t("Le code doit avoir 4 chiffres."));
      if (p1 !== p2) return fail(t("Les deux codes ne sont pas pareils."));
    }
    S.kiosk = document.getElementById("kiosk").value.trim();
    S.operators = ops;
    if (p1) await setPin(p1);
    store.save();
    document.body.classList.remove("bare");
    go("ouverture");
  };
}

// ---------- Accueil : soldes, boutons de saisie, totaux du jour
function viewHome() {
  const day = today(), b = balances(day), d = S.days[day];
  if (!b) {
    $view.innerHTML = `${trialBanner()}
      <div class="card">
        <h2>${t("Ouvre ta journée")}</h2>
        <p class="muted">${t("Compte ton liquide et regarde tes soldes électroniques pour commencer.")}</p>
        <a class="btn" href="#ouverture">${t("Ouvrir la journée")}</a>
      </div>`;
    return;
  }
  const tot = totals(day), list = activeOps(day).slice().reverse();
  const neg = OPS().filter((o) => (b.float[o.id] || 0) < 0);
  $view.innerHTML = `${trialBanner()}
    ${d.close ? `<div class="card note"><p>${t("Journée clôturée à {h}.", { h: timeOf(d.close.at) })} <a href="#cloture">${t("Voir la clôture")}</a></p></div>` : ""}
    <section class="balances" aria-label="${t("Soldes")}">
      <div class="cash ${b.cash < 0 ? "neg" : ""}"><span class="lbl">${t("Liquide en caisse")}</span><b class="amount">${fmt(b.cash)}</b></div>
      <div class="floats">${OPS().map((o) => `<div class="fl ${(b.float[o.id] || 0) < 0 ? "neg" : ""}"><span class="lbl">${esc(o.name)}</span><b>${fmt(b.float[o.id] || 0)}</b></div>`).join("")}</div>
    </section>
    ${b.cash < 0 ? `<p class="msg-ko">${t("Le liquide calculé est négatif : une opération est sans doute mal saisie.")}</p>` : ""}
    ${neg.length ? `<p class="msg-ko">${t("Solde électronique négatif pour {op} : vérifie tes saisies.", { op: neg.map((o) => esc(o.name)).join(", ") })}</p>` : ""}
    <div class="actions">
      <a class="big-btn in" href="#saisie/depot"><span>${t("Dépôt")}</span><small>${t("le client donne du liquide")}</small></a>
      <a class="big-btn out" href="#saisie/retrait"><span>${t("Retrait")}</span><small>${t("le client prend du liquide")}</small></a>
    </div>
    <div class="card">
      <div class="row"><h2>${t("Aujourd'hui")}</h2><span class="small muted">${esc(longDay(day))}</span></div>
      <div class="table-wrap"><table class="tot">
        <thead><tr><th>${t("Opérateur")}</th><th>${t("Dépôts")}</th><th>${t("Retraits")}</th><th>${t("Nb")}</th></tr></thead>
        <tbody>${Object.entries(tot).map(([id, r]) => `<tr><th>${esc(opName(id))}</th><td>${fmt(r.depot)}</td><td>${fmt(r.retrait)}</td><td>${r.n}</td></tr>`).join("")}</tbody>
        <tfoot><tr><th>${t("Total")}</th>${["depot", "retrait", "n"].map((k) => { const s = Object.values(tot).reduce((a, r) => a + r[k], 0); return `<td>${k === "n" ? s : fmt(s)}</td>`; }).join("")}</tr></tfoot>
      </table></div>
    </div>
    <div class="card">
      <div class="row"><h2>${t("Dernières opérations")}</h2><a class="small" href="#journal">${t("Tout voir")}</a></div>
      ${list.length ? `<ul class="ops">${list.slice(0, 5).map(opRow).join("")}</ul>` : `<p class="muted">${t("Aucune opération pour l'instant. Appuie sur Dépôt ou Retrait.")}</p>`}
    </div>
    ${!d.close ? `<a class="btn alt" href="#cloture">${t("Clôturer la caisse du soir")}</a>` : ""}`;
}
function opRow(op, withActions = false) {
  return `<li class="op ${op.type} ${op.cancelled ? "cancelled" : ""}">
    <span class="time">${timeOf(op.t)}</span>
    <span class="what"><b>${t(TYPES[op.type])}</b> · ${esc(opName(op.op))}${op.phone ? `<br><span class="small muted">${esc(phoneFmt(op.phone))}</span>` : ""}${op.cancelled ? `<br><span class="small">${t("Annulée à {h}", { h: timeOf(op.cancelled) })}</span>` : ""}</span>
    <span class="amt">${fmt(op.amount)}</span>
    ${withActions && !op.cancelled && !(S.days[op.day] || {}).close ? `<button class="link" data-cancel="${op.id}">${t("Annuler")}</button>` : ""}
  </li>`;
}

// ---------- Saisie rapide d'une opération
function viewEntry(type = "depot", opId = null) {
  const day = today();
  if (!balances(day)) return go("ouverture");
  if (S.days[day].close) {
    $view.innerHTML = `<div class="card"><h2>${t("La journée est clôturée")}</h2><p class="muted">${t("Rouvre la caisse pour noter une nouvelle opération.")}</p>
      <a class="btn" href="#cloture">${t("Voir la clôture")}</a></div>`;
    return;
  }
  if (!canAdd()) return viewSub(t("Tu as utilisé tes {n} opérations gratuites d'aujourd'hui.", { n: CFG.free_ops_per_day }));
  const ops = OPS();
  let op = opId && ops.some((o) => o.id === opId) ? opId : S.lastOp && ops.some((o) => o.id === S.lastOp) ? S.lastOp : ops[0].id;
  $view.innerHTML = `<form id="f" class="entry">
      <div class="seg" role="group" aria-label="${t("Type d'opération")}">
        ${Object.entries(TYPES).map(([k, v]) => `<button type="button" data-type="${k}" aria-pressed="${k === type}">${t(v)}</button>`).join("")}
      </div>
      <div class="chips" role="group" aria-label="${t("Opérateur")}">
        ${ops.map((o) => `<button type="button" class="chip" data-op="${o.id}" aria-pressed="${o.id === op}">${esc(o.name)}</button>`).join("")}
      </div>
      <label class="field amount-field"><span>${t("Montant")}</span>
        <input id="amount" inputmode="numeric" autocomplete="off" placeholder="0" data-money autofocus><b class="unit">F</b></label>
      <div class="quick">${[1000, 2000, 5000, 10000, 25000, 50000].map((v) => `<button type="button" class="chip" data-add="${v}">+${v.toLocaleString("fr-FR")}</button>`).join("")}<button type="button" class="chip" data-add="0">${t("Effacer")}</button></div>
      <label class="field"><span>${t("Numéro du client (facultatif)")}</span>
        <input id="phone" type="tel" inputmode="tel" maxlength="14" autocomplete="off" placeholder="77 123 45 67"></label>
      <p class="effect" id="effect"></p>
      <button class="btn" type="submit" id="save">${t("Enregistrer")}</button>
      <a class="btn alt" href="#accueil">${t("Retour")}</a>
    </form>`;
  wireMoney();
  const amount = document.getElementById("amount"), eff = document.getElementById("effect");
  const show = () => {
    $view.querySelectorAll("[data-type]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.type === type));
    $view.querySelectorAll("[data-op]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.op === op));
    const n = num(amount.value), b = balances(day), e = effect({ type, amount: n });
    const cashAfter = b.cash + e.cash, floatAfter = (b.float[op] || 0) + e.float;
    eff.innerHTML = n ? `${t("Après l'opération")} : ${t("liquide")} <b class="${cashAfter < 0 ? "bad" : ""}">${fmt(cashAfter)}</b> · ${esc(opName(op))} <b class="${floatAfter < 0 ? "bad" : ""}">${fmt(floatAfter)}</b>
      ${cashAfter < 0 ? `<br><span class="bad">${t("Tu n'as pas assez de liquide pour ce retrait.")}</span>` : ""}
      ${floatAfter < 0 ? `<br><span class="bad">${t("Ton solde {op} ne suffit pas pour ce dépôt.", { op: esc(opName(op)) })}</span>` : ""}` : "";
  };
  $view.querySelectorAll("[data-type]").forEach((b) => b.onclick = () => { type = b.dataset.type; history.replaceState(null, "", "#saisie/" + type); show(); });
  $view.querySelectorAll("[data-op]").forEach((b) => b.onclick = () => { op = b.dataset.op; show(); });
  $view.querySelectorAll("[data-add]").forEach((b) => b.onclick = () => {
    const v = +b.dataset.add, n = v ? num(amount.value) + v : 0;
    amount.value = n ? n.toLocaleString("fr-FR") : ""; show();
  });
  amount.addEventListener("input", show);
  show();
  document.getElementById("f").onsubmit = (e) => {
    e.preventDefault();
    const n = num(amount.value);
    if (!n) { amount.focus(); eff.innerHTML = `<span class="bad">${t("Écris le montant.")}</span>`; return; }
    const phone = document.getElementById("phone").value.replace(/\D/g, "").replace(/^221(?=\d{9}$)/, "");
    S.ops.push({ id: uid(), t: new Date().toISOString(), day, type, op, amount: n, phone });
    S.lastOp = op;
    store.save();
    toast(t("{type} {op} de {m} noté.", { type: t(TYPES[type]), op: opName(op), m: fmt(n) }));
    go("accueil");
  };
}

// ---------- Journal du jour (on n'efface jamais : une opération annulée reste visible, barrée)
function viewJournal(day = today()) {
  const all = S.ops.filter((o) => o.day === day).slice().reverse();
  const days = Object.keys(S.days).sort();
  const prev = days.filter((d) => d < day).pop(), next = days.find((d) => d > day);
  $view.innerHTML = `<div class="row daynav">
      ${prev ? `<a class="chip" href="#journal/${prev}">‹ ${t("Veille")}</a>` : "<span></span>"}
      <h1>${esc(longDay(day))}</h1>
      ${next ? `<a class="chip" href="#journal/${next}">${t("Suivant")} ›</a>` : "<span></span>"}
    </div>
    <div class="card">
      ${all.length ? `<ul class="ops">${all.map((o) => opRow(o, true)).join("")}</ul>` : `<p class="muted">${t("Aucune opération ce jour-là.")}</p>`}
    </div>
    <div id="confirm"></div>`;
  $view.querySelectorAll("[data-cancel]").forEach((b) => b.onclick = () => {
    const op = S.ops.find((o) => o.id === b.dataset.cancel);
    document.getElementById("confirm").innerHTML = `<div class="card warn-card">
      <p>${t("Annuler ce {type} {op} de {m} ? Il restera visible, barré, dans le journal.", { type: t(TYPES[op.type]).toLowerCase(), op: esc(opName(op.op)), m: fmt(op.amount) })}</p>
      <div class="two"><button class="btn danger" id="yes">${t("Oui, annuler")}</button><button class="btn alt" id="no">${t("Non")}</button></div></div>`;
    document.getElementById("confirm").scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("no").onclick = () => (document.getElementById("confirm").innerHTML = "");
    document.getElementById("yes").onclick = () => { op.cancelled = new Date().toISOString(); store.save(); toast(t("Opération annulée.")); viewJournal(day); };
  });
}

// ---------- Ouverture de la journée
function viewOpen() {
  const day = today(), d = S.days[day];
  if (d && d.open && activeOps(day).length) return go("accueil");
  const sug = (d && d.open) || suggestedOpening(day) || { cash: 0, float: {} };
  $view.innerHTML = `<h1>${t("Ouvrir la journée")}</h1>
    <p class="muted">${t("Compte le liquide de la caisse et regarde le solde de chaque opérateur sur ton téléphone d'agent.")}</p>
    ${suggestedOpening(day) && !(d && d.open) ? `<p class="small muted">${t("Montants repris de la dernière clôture. Corrige-les si besoin.")}</p>` : ""}
    <form class="card" id="f">
      ${moneyInput("cash", sug.cash, t("Liquide en caisse"))}
      ${OPS().map((o) => moneyInput("fl-" + o.id, sug.float[o.id], t("Solde {op}", { op: o.name }))).join("")}
      <button class="btn" type="submit">${t("Ouvrir la journée")}</button>
    </form>`;
  wireMoney();
  document.getElementById("f").onsubmit = (e) => {
    e.preventDefault();
    const float = {};
    for (const o of OPS()) float[o.id] = num(document.getElementById("fl-" + o.id).value);
    S.days[day] = { ...(S.days[day] || {}), open: { cash: num(document.getElementById("cash").value), float, at: new Date().toISOString() } };
    store.save();
    toast(t("Journée ouverte."));
    go("accueil");
  };
}

// ---------- Clôture de caisse du soir : ce que dit l'appli contre ce qui est compté
function viewClose() {
  const day = today(), d = S.days[day], b = balances(day);
  if (!b) return go("ouverture");
  if (d.close) {
    const c = d.close, rows = [["cash", t("Liquide"), b.cash, c.cash], ...OPS().map((o) => [o.id, o.name, b.float[o.id] || 0, c.float[o.id] || 0])];
    $view.innerHTML = `<h1>${t("Clôture du {d}", { d: esc(longDay(day)) })}</h1>
      ${ecartTable(rows)}
      <p class="small muted">${t("Clôturée à {h}. Ces montants serviront à ouvrir la prochaine journée.", { h: timeOf(c.at) })}</p>
      <button class="btn alt" id="reopen">${t("Rouvrir la caisse")}</button>`;
    document.getElementById("reopen").onclick = () => { delete d.close; store.save(); toast(t("Caisse rouverte.")); go("accueil"); };
    return;
  }
  $view.innerHTML = `<h1>${t("Clôture de caisse")}</h1>
    <p class="muted">${t("Compte ton liquide et note tes soldes réels. L'appli montre l'écart avec ce qu'elle a calculé.")}</p>
    <form class="card" id="f">
      ${moneyInput("cash", "", t("Liquide compté (attendu : {m})", { m: fmt(b.cash) }))}
      ${OPS().map((o) => moneyInput("fl-" + o.id, "", t("Solde {op} réel (attendu : {m})", { op: o.name, m: fmt(b.float[o.id] || 0) }))).join("")}
      <div id="ecart"></div>
      <button class="btn" type="submit">${t("Clôturer la journée")}</button>
    </form>`;
  wireMoney();
  const read = () => ({ cash: num(document.getElementById("cash").value), float: Object.fromEntries(OPS().map((o) => [o.id, num(document.getElementById("fl-" + o.id).value)])) });
  const show = () => {
    const c = read();
    document.getElementById("ecart").innerHTML = ecartTable([["cash", t("Liquide"), b.cash, c.cash], ...OPS().map((o) => [o.id, o.name, b.float[o.id] || 0, c.float[o.id]])]);
  };
  $view.querySelectorAll("input").forEach((i) => i.addEventListener("input", show));
  show();
  document.getElementById("f").onsubmit = (e) => {
    e.preventDefault();
    const empty = [...$view.querySelectorAll("[data-money]")].filter((i) => i.value.trim() === "");
    if (empty.length) { empty[0].focus(); toast(t("Remplis tous les montants comptés (0 si vide).")); return; }
    d.close = { ...read(), expected: { cash: b.cash, float: { ...b.float } }, at: new Date().toISOString() };
    store.save();
    toast(t("Journée clôturée."));
    viewClose();
  };
}
function ecartTable(rows) {
  const total = rows.reduce((a, r) => a + (r[3] - r[2]), 0);
  return `<div class="table-wrap"><table class="tot ecart">
    <thead><tr><th></th><th>${t("Appli")}</th><th>${t("Compté")}</th><th>${t("Écart")}</th></tr></thead>
    <tbody>${rows.map(([, name, exp, got]) => { const e = got - exp; return `<tr><th>${esc(name)}</th><td>${fmt(exp)}</td><td>${fmt(got)}</td><td class="${e === 0 ? "good" : "bad"}">${fmtSigned(e)}</td></tr>`; }).join("")}</tbody>
    <tfoot><tr><th>${t("Écart total")}</th><td></td><td></td><td class="${total === 0 ? "good" : "bad"}">${fmtSigned(total)}</td></tr></tfoot>
  </table></div>
  <p class="small ${total === 0 ? "good" : "muted"}">${total === 0 ? t("Tout est juste.") : total > 0 ? t("Il y a plus que prévu : une opération a peut-être été oubliée.") : t("Il manque de l'argent : vérifie les opérations du jour et les annulations.")}</p>`;
}

// ---------- Abonnement : paiement par Wave ou Orange Money, puis code reçu
async function sha256(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function viewSub(reason = "", pay = "wave") {
  const price = fmt(CFG.price_fcfa), number = pay === "om" ? CFG.om_number : CFG.wave_number;
  const msg = encodeURIComponent(t("Bonjour, j'ai payé {p} par {via} pour l'abonnement {app} du kiosque « {k} ». Voici ma capture :", { p: price, via: pay === "om" ? "Orange Money" : "Wave", app: CFG.name, k: S.kiosk }));
  $view.innerHTML = `<h1>${t("Abonnement")}</h1>
    ${reason ? `<p><b>${esc(reason)}</b></p>` : ""}
    <div class="card">
      ${paidLeft() > 0 ? `<p class="good"><b>${t("Abonnement actif jusqu'au {d}.", { d: esc(longDay(S.paidUntil)) })}</b></p>`
        : trialLeft() > 0 ? `<p>${t("Essai gratuit en cours : encore {n} jour(s) avec tout débloqué.", { n: trialLeft() })}</p>`
        : `<p>${t("Ton essai de {n} jours est terminé. Sans abonnement : {f} opérations par jour.", { n: CFG.trial_days, f: CFG.free_ops_per_day })}</p>`}
      <p class="amount">${price} <span class="small muted">${t("par mois et par kiosque")}</span></p>
      <ul class="steps"><li>${t("Opérations sans limite")}</li><li>${t("Soldes, totaux et clôture de caisse")}</li><li>${t("Les nouveautés ajoutées chaque mois")}</li></ul>
    </div>
    <div class="card"><h2>${t("Comment payer")}</h2>
      <div class="seg"><button type="button" data-pay="wave" aria-pressed="${pay === "wave"}">Wave</button><button type="button" data-pay="om" aria-pressed="${pay === "om"}">Orange Money</button></div>
      <ol class="steps">
        <li>${t("Envoie {p} par {via} au", { p: `<b>${price}</b>`, via: pay === "om" ? "Orange Money" : "Wave" })} <b class="copy" id="num">${esc(number)}</b> <button class="link" type="button" id="copy">${t("Copier")}</button></li>
        <li>${t("Envoie la capture du paiement par WhatsApp au même numéro.")}</li>
        <li>${t("Tu reçois ton code d'abonnement. Entre-le ci-dessous.")}</li>
      </ol>
      <a class="btn alt" href="https://wa.me/${esc(CFG.whatsapp)}?text=${msg}" target="_blank" rel="noopener">${t("Envoyer la capture sur WhatsApp")}</a>
      <p class="small muted">${t("Ce paiement concerne seulement l'abonnement à l'appli. L'appli ne fait aucun transfert pour tes clients.")}</p>
    </div>
    <div class="card"><h2>${t("J'ai un code")}</h2>
      <input class="code" id="code" placeholder="XXXXX-XXXXXX" autocomplete="off" maxlength="13">
      <button class="btn" id="unlock">${t("Activer")}</button><p id="codemsg" class="small"></p></div>`;
  $view.querySelectorAll("[data-pay]").forEach((b) => b.onclick = () => viewSub(reason, b.dataset.pay));
  document.getElementById("copy").onclick = () => {
    const n = number.replace(/\s/g, "");
    (navigator.clipboard ? navigator.clipboard.writeText(n) : Promise.reject()).then(() => toast(t("Numéro copié.")), () => toast(n));
  };
  document.getElementById("unlock").onclick = async () => {
    const raw = document.getElementById("code").value.trim().toUpperCase().replace(/\s/g, "");
    const code = raw.length === 11 && !raw.includes("-") ? raw.slice(0, 5) + "-" + raw.slice(5) : raw;
    const m = document.getElementById("codemsg");
    const ok = !S.usedCodes.includes(code) && CFG.codes.includes(await sha256(CFG.salt + code));
    if (!ok) { m.className = "msg-ko"; m.textContent = t("Code inconnu ou déjà utilisé. Vérifie les lettres et les chiffres."); return; }
    const from = S.paidUntil && S.paidUntil >= today() ? addDays(S.paidUntil, 1) : today();
    S.paidUntil = addDays(from, CFG.sub_days - 1);
    S.usedCodes.push(code);
    store.save();
    m.className = "msg-ok"; m.textContent = t("Code accepté : abonnement actif jusqu'au {d}.", { d: longDay(S.paidUntil) });
    setTimeout(() => viewSub(), 1200);
  };
}

// ---------- Réglages
function viewSettings() {
  $view.innerHTML = `<h1>${t("Réglages")}</h1>
    <form class="card" id="fk">
      <label class="field"><span>${t("Nom du kiosque")}</span><input id="kiosk" maxlength="40" value="${esc(S.kiosk)}"></label>
      <fieldset class="field"><legend>${t("Opérateurs que tu proposes")}</legend>
        <div class="checks">${CFG.operators.map((o) => `<label class="check"><input type="checkbox" name="op" value="${o.id}" ${S.operators.includes(o.id) ? "checked" : ""}> ${esc(o.name)}</label>`).join("")}</div>
      </fieldset>
      <button class="btn" type="submit">${t("Enregistrer")}</button>
    </form>
    <div class="card" id="pincard"></div>
    <a class="card linkcard" href="#abonnement"><b>${t("Abonnement")}</b><span class="small muted">${paidLeft() > 0 ? t("Actif jusqu'au {d}", { d: esc(longDay(S.paidUntil)) }) : trialLeft() > 0 ? t("Essai : {n} jour(s) restant(s)", { n: trialLeft() }) : t("Essai terminé")}</span></a>
    ${woReady() ? `<div class="card"><h2>${t("Langue")}</h2><div class="seg">${Object.entries(LANGS).map(([k, v]) => `<button type="button" data-lang="${k}" aria-pressed="${LANG === k}">${v}</button>`).join("")}</div></div>` : ""}
    <div class="card note"><p class="small">${t("Ton cahier est gardé sur ce téléphone et marche sans connexion. L'appli ne fait aucun transfert et ne te demandera jamais ton code secret Wave, Orange Money, Free Money ou Wizall.")}</p></div>
    <div class="card"><h2>${t("Effacer le cahier")}</h2><p class="small muted">${t("Supprime toutes les opérations de ce téléphone. Écris EFFACER pour confirmer.")}</p>
      <input id="wipe" autocomplete="off" placeholder="EFFACER"><button class="btn danger" id="wipebtn">${t("Tout effacer")}</button></div>`;
  document.getElementById("fk").onsubmit = (e) => {
    e.preventDefault();
    const ops = [...$view.querySelectorAll("input[name=op]:checked")].map((i) => i.value);
    if (!ops.length) return toast(t("Coche au moins un opérateur."));
    S.kiosk = document.getElementById("kiosk").value.trim(); S.operators = ops; store.save(); paintTop(); toast(t("Enregistré."));
  };
  $view.querySelectorAll("[data-lang]").forEach((b) => b.onclick = () => { setLang(b.dataset.lang); render(); });
  pinCard();
  document.getElementById("wipebtn").onclick = () => {
    if (document.getElementById("wipe").value.trim().toUpperCase() !== "EFFACER") return toast(t("Écris EFFACER pour confirmer."));
    // l'essai et l'abonnement restent : effacer le cahier ne relance pas l'essai
    const keep = { trialStart: S.trialStart, paidUntil: S.paidUntil, usedCodes: S.usedCodes };
    Object.keys(S).forEach((k) => delete S[k]);
    Object.assign(S, { v: 1, kiosk: "", ops: [], days: {}, operators: null, pin: null }, keep);
    store.save(); location.hash = ""; render();
  };
}
function pinCard() {
  const c = document.getElementById("pincard");
  c.innerHTML = `<h2>${t("Code de l'appli")}</h2>
    <p class="small muted">${S.pin ? t("L'appli se verrouille à l'ouverture et après 1 minute hors de l'écran.") : t("Aucun code : n'importe qui peut ouvrir ton cahier.")}</p>
    <div class="two"><input id="np1" class="pin" inputmode="numeric" maxlength="4" placeholder="${t("Nouveau code")}" autocomplete="off"><input id="np2" class="pin" inputmode="numeric" maxlength="4" placeholder="${t("Encore une fois")}" autocomplete="off"></div>
    <div class="two"><button class="btn" id="setpin">${S.pin ? t("Changer le code") : t("Mettre un code")}</button>${S.pin ? `<button class="btn alt" id="delpin">${t("Enlever le code")}</button>` : ""}</div>`;
  document.getElementById("setpin").onclick = async () => {
    const a = document.getElementById("np1").value, b = document.getElementById("np2").value;
    if (!/^\d{4}$/.test(a)) return toast(t("Le code doit avoir 4 chiffres."));
    if (a !== b) return toast(t("Les deux codes ne sont pas pareils."));
    await setPin(a); store.save(); toast(t("Code enregistré.")); pinCard();
  };
  const del = document.getElementById("delpin");
  if (del) del.onclick = () => { S.pin = null; store.save(); toast(t("Code enlevé.")); pinCard(); };
}

// ---------- Verrouillage par code (4 chiffres, gardé haché sur le téléphone)
async function setPin(p) { const salt = uid(); S.pin = { salt, hash: await sha256(salt + p) }; }
let locked = false, hiddenAt = 0;
const LOCK_AFTER = 60 * 1000;
function lock() {
  if (!S.pin) return;
  locked = true;
  let entry = "", tries = 0;
  $lock.hidden = false;
  const paint = (msg = "") => {
    $lock.innerHTML = `<div class="lock-in">
      <span class="mark big" aria-hidden="true">TX</span>
      <p><b>${esc(S.kiosk || CFG.name)}</b></p>
      <p class="muted">${t("Entre le code de l'appli")}</p>
      <div class="dots" aria-label="${t("{n} chiffre(s) sur 4", { n: entry.length })}">${[0, 1, 2, 3].map((i) => `<i class="${i < entry.length ? "on" : ""}"></i>`).join("")}</div>
      <p class="msg-ko lock-msg" aria-live="polite">${esc(msg)}</p>
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((k) => k === "" ? "<span></span>" : `<button type="button" data-k="${k}" aria-label="${k === "⌫" ? t("Effacer") : k}">${k}</button>`).join("")}</div>
      <p class="small muted">${t("Code oublié ? Il faut effacer l'appli du téléphone : le cahier sera perdu.")}</p>
    </div>`;
    $lock.querySelectorAll("[data-k]").forEach((b) => b.onclick = () => press(b.dataset.k));
  };
  const press = async (k) => {
    if (k === "⌫") entry = entry.slice(0, -1);
    else if (entry.length < 4) entry += k;
    paint();
    if (entry.length === 4) {
      if ((await sha256(S.pin.salt + entry)) === S.pin.hash) { locked = false; $lock.hidden = true; $lock.innerHTML = ""; document.removeEventListener("keydown", onKey); return; }
      tries++; entry = "";
      paint(tries >= 5 ? t("Code faux. Attends 30 secondes.") : t("Code faux."));
      if (tries >= 5) { $lock.querySelectorAll("[data-k]").forEach((b) => (b.disabled = true)); setTimeout(() => { tries = 0; paint(); }, 30000); }
    }
  };
  const onKey = (e) => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === "Backspace") press("⌫"); };
  document.addEventListener("keydown", onKey);
  paint();
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") hiddenAt = Date.now();
  else if (!locked && S.pin && hiddenAt && Date.now() - hiddenAt > LOCK_AFTER) lock();
});

// ---------- Navigation
function go(h) { if (location.hash === "#" + h) render(); else location.hash = h; }
function paintTop() {
  document.getElementById("kname").textContent = S.kiosk || CFG.name;
}
function render() {
  paintTop();
  if (!S.operators || !S.operators.length) return viewSetup();
  const [page, arg] = location.hash.slice(1).split("/");
  document.querySelectorAll(".tabs a").forEach((a) => a.setAttribute("aria-current", a.dataset.tab === (page || "accueil") ? "page" : "false"));
  window.scrollTo(0, 0);
  ({ saisie: () => viewEntry(arg), journal: () => viewJournal(arg && /^\d{4}-\d\d-\d\d$/.test(arg) ? arg : today()), ouverture: viewOpen,
     cloture: viewClose, abonnement: () => viewSub(), reglages: viewSettings }[page] || viewHome)();
  $view.focus({ preventScroll: true });
}
window.addEventListener("hashchange", render);
$view.addEventListener("click", (e) => { const a = e.target.closest("a[href^='#']"); if (a && a.getAttribute("href") === location.hash) render(); });

// Installation sur l'écran d'accueil
let installEvt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; document.getElementById("install").hidden = false; });
document.getElementById("install").onclick = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; document.getElementById("install").hidden = true; };
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});

document.documentElement.lang = LANG;
Sync.start(S);
render();
lock();
