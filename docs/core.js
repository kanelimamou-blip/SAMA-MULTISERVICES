"use strict";
// Sama Multi Service : le cahier de caisse de l'agent de mobile money.
// L'appli ne fait aucun transfert, n'est reliée à aucun opérateur et ne demande jamais de code secret d'opérateur.
// core.js : données, calculs (soldes, commissions, gains), utilisateurs et verrouillage, petits outils d'affichage.
const $view = document.getElementById("view");
const $lock = document.getElementById("lock");

// ---------- Données (tout est gardé sur le téléphone : l'appli marche sans connexion)
let KEY = "cahier";
const DEFAULTS = () => ({
  v: 2, kiosk: "", quartier: "", tel: "", ops: [], days: {}, operators: null, users: [],
  baremes: {}, fees: {}, seuils: { cash: 0, float: {} }, services: [], stock: [], clients: [],
  annonces: [], rdv: [], reclamations: [], avis: [], epargne: { goal: 0, label: "" }, planning: {},
  contacts: { alerte: "", service: {} }, plafonds: {}, idThreshold: 0, unusual: 0, hours: "", closeAt: "20:00",
  mask: false, log: [], quiz: {}, fiches: [], releves: {}, fetes: [],
});
const store = {
  load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } },
  save() {
    // « Voir » un client depuis l'espace admin : lecture seule, rien n'est gardé ni envoyé
    if (!KEY) { if (!store.warned) toast(t("Lecture seule : rien n'est enregistré.")); store.warned = true; return; }
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {}
    if (KEY === "cahier") Compte.dirty();
  },
};
let S = Object.assign(DEFAULTS(), store.load());
function migrate() {
  // v1 : un seul code d'appli -> devient le compte « patron »
  if (!S.users.length) S.users = [{ id: "patron", name: t("Patron"), role: "patron", pin: S.pin || null, salary: 0, prime: 0 }];
  delete S.pin;
  for (const o of S.ops) if (!o.kind) o.kind = "mm";
  for (const k of Object.keys(DEFAULTS())) if (S[k] === undefined) S[k] = DEFAULTS()[k];
}
migrate();

// ---------- Outils
const pad = (n) => String(n).padStart(2, "0");
const dayOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => dayOf(new Date());
const addDays = (day, n) => { const d = new Date(day + "T12:00:00"); d.setDate(d.getDate() + n); return dayOf(d); };
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5);
const monthOf = (day) => day.slice(0, 7);
const weekStart = (day) => { const d = new Date(day + "T12:00:00"); return addDays(day, -((d.getDay() + 6) % 7)); };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => (n < 0 ? "−" : "") + Math.abs(Math.round(n || 0)).toLocaleString("fr-FR") + " F";
const fmtSigned = (n) => (n > 0 ? "+" : "") + fmt(n);
const num = (v) => { const n = parseInt(String(v ?? "").replace(/\D/g, ""), 10); return Number.isFinite(n) ? n : 0; };
const phoneClean = (p) => String(p || "").replace(/\D/g, "").replace(/^221(?=\d{9}$)/, "");
const phoneFmt = (p) => { const d = phoneClean(p); return d.length === 9 ? `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}` : d; };
// Masquage des numéros à l'écran (réglage) : 77 ••• •• 67
const phoneShow = (p) => { const f = phoneFmt(p); return S.mask && f.length === 12 ? `${f.slice(0, 2)} ••• •• ${f.slice(10)}` : f; };
const timeOf = (iso) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const longDay = (day) => new Date(day + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const shortDay = (day) => new Date(day + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const monthName = (m) => new Date(m + "-15T12:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + (f(x) || 0), 0);
const waLink = (phone, text) => `https://wa.me/${phone ? "221" + phoneClean(phone) : ""}?text=${encodeURIComponent(text)}`;
async function sha256(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

const OPS = () => CFG.operators.filter((o) => (S.operators || []).includes(o.id));
const opName = (id) => (CFG.operators.find((o) => o.id === id) || { name: id || "" }).name;
const TYPES = { depot: "Dépôt", retrait: "Retrait" };

// ---------- Utilisateurs (patron et employés, chacun avec son code)
let ME = null;
// Écran imposé avant le cahier : "login", "suspended", "admin" (comptes en ligne), ou null
let gate = null;
// Espace admin : cahier d'un client ouvert en lecture seule ({ id, name }), ou null
let VOIR = null;
const demoOn = () => KEY === "cahier-demo";
const me = () => S.users.find((u) => u.id === ME) || S.users[0];
const isBoss = () => me().role === "patron";
const userName = (id) => (S.users.find((u) => u.id === id) || { name: "—" }).name;
function logEvent(ev) { S.log.push({ t: new Date().toISOString(), user: ME, ev }); if (S.log.length > 500) S.log = S.log.slice(-500); store.save(); }

const live = (day) => S.ops.filter((o) => o.day === day && !o.cancelled);
const liveMM = (day) => live(day).filter((o) => o.kind === "mm");

// ---------- Effet de chaque ligne du cahier sur le liquide et sur le solde électronique
// Dépôt : le client donne du liquide, l'agent envoie de l'électronique -> liquide +, électronique -
// Retrait : l'agent reçoit de l'électronique, il rend du liquide -> liquide -, électronique +
function effect(o) {
  const a = o.amount || 0, f = {};
  let cash = 0;
  switch (o.kind) {
    case "mm": cash = o.type === "depot" ? a : -a; f[o.op] = -cash; break;
    case "service": cash = a; if (o.floatOp) f[o.floatOp] = -a; break; // facture, crédit, pass : payé avec le solde de l'opérateur
    case "vente": cash = a; break;
    case "float":
      if (o.sub === "recharge") { cash = -a - (o.feeCash ? o.fee || 0 : 0); f[o.op] = a; }
      else if (o.sub === "donne") { cash = -a; f[o.op] = a; } // je donne du liquide à un voisin, il m'envoie de l'électronique
      else if (o.sub === "recoit") { cash = a; f[o.op] = -a; }
      else if (o.sub === "vidage") { cash = a; f[o.op] = -a; } // super-agent : je revends de l'électronique contre du liquide
      break;
    case "pret": cash = o.sub === "prete" || o.sub === "rembourse" ? -a : a; break; // prete / rembourse (je rends) : sortie ; emprunte / recu : entrée
    case "depense": cash = o.fromCash === false ? 0 : -a; break;
    case "epargne": cash = -a; break;
    case "ajust": cash = o.sub === "apport" ? a : -a; break;
    case "avance": cash = -a; break;
  }
  return { cash, float: f };
}
function balances(day) {
  const d = S.days[day];
  if (!d || !d.open) return null;
  const b = { cash: d.open.cash, float: { ...d.open.float } };
  for (const o of live(day)) {
    const e = effect(o);
    b.cash += e.cash;
    for (const [k, v] of Object.entries(e.float)) b.float[k] = (b.float[k] || 0) + v;
  }
  return b;
}
function totals(day) {
  const t = {};
  for (const o of OPS()) t[o.id] = { depot: 0, retrait: 0, n: 0, com: 0 };
  for (const o of liveMM(day)) {
    const r = (t[o.op] = t[o.op] || { depot: 0, retrait: 0, n: 0, com: 0 });
    r[o.type] += o.amount; r.n++; r.com += o.commission || 0;
  }
  return t;
}
const previousDay = (day) => Object.keys(S.days).filter((d) => d < day && S.days[d].open).sort().pop() || null;
function suggestedOpening(day) {
  const prev = previousDay(day);
  if (!prev) return null;
  const d = S.days[prev];
  return d.close ? { cash: d.close.cash, float: { ...d.close.float } } : balances(prev);
}

// ---------- Barèmes (commissions de l'agent, frais du client) : paliers « jusqu'à X : Y » ou « Y % »
function tierValue(tiers, amount) {
  const row = (tiers || []).slice().sort((a, b) => (a.max || Infinity) - (b.max || Infinity)).find((r) => !r.max || amount <= r.max);
  if (!row) return 0;
  const v = String(row.val || "").replace(",", ".").trim();
  return v.endsWith("%") ? Math.round((amount * parseFloat(v)) / 100) : num(v);
}
const commissionOf = (op, type, amount) => tierValue(((S.baremes[op] || {})[type]), amount);
const feeOf = (op, type, amount) => tierValue(((S.fees[op] || {})[type]), amount);
const hasBareme = (op) => ["depot", "retrait"].some((k) => ((S.baremes[op] || {})[k] || []).length);

// ---------- Gains : commissions + marge des ventes + revenus des services
function gainOf(o) {
  if (o.cancelled) return 0;
  if (o.kind === "mm" || o.kind === "service") return o.commission || 0;
  if (o.kind === "vente") return o.amount - (o.cost || 0) * (o.qty || 1);
  return 0;
}
const opsBetween = (from, to) => S.ops.filter((o) => !o.cancelled && o.day >= from && o.day <= to);
const gainBetween = (from, to) => sum(opsBetween(from, to), gainOf);
const expensesBetween = (from, to) => sum(opsBetween(from, to).filter((o) => o.kind === "depense" || o.kind === "avance" || (o.kind === "float" && o.sub === "recharge")), (o) => (o.kind === "float" ? o.fee || 0 : o.amount));
const monthBounds = (m) => [m + "-01", addDays(monthOf(addDays(m + "-28", 7)) + "-01", -1)];

// ---------- Opération inhabituelle (alerte au patron) : au-dessus du seuil réglé, ou 3 fois la moyenne
function isUnusual(o) {
  if (o.kind !== "mm") return false;
  if (S.unusual && o.amount >= S.unusual) return true;
  const past = S.ops.filter((x) => x.kind === "mm" && !x.cancelled && x.op === o.op && x.id !== o.id).slice(-200);
  if (past.length < 20) return false;
  return o.amount > 3 * (sum(past, (x) => x.amount) / past.length) && o.amount >= 100000;
}

// ---------- Petits morceaux d'interface
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 2600);
}
const moneyInput = (id, value, label, extra = "") => `<label class="field"><span>${esc(label)}</span>
  <input id="${id}" inputmode="numeric" autocomplete="off" placeholder="0" value="${value ? Number(value).toLocaleString("fr-FR") : ""}" data-money ${extra}></label>`;
const textInput = (id, value, label, extra = "") => `<label class="field"><span>${esc(label)}</span><input id="${id}" value="${esc(value || "")}" autocomplete="off" ${extra}></label>`;
const selectInput = (id, options, value, label) => `<label class="field"><span>${esc(label)}</span><select id="${id}">${options.map(([v, l]) => `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
const val = (id) => (document.getElementById(id) || {}).value || "";
function wireMoney(root = $view) {
  root.querySelectorAll("[data-money]").forEach((i) => i.addEventListener("input", () => {
    const n = num(i.value); i.value = i.value.trim() === "" ? "" : n.toLocaleString("fr-FR");
  }));
}
// Confirmation dans la page (pas de fenêtre du navigateur)
function confirmBox(holder, text, yesLabel, onYes) {
  holder.innerHTML = `<div class="card warn-card"><p>${text}</p>
    <div class="two"><button class="btn danger" data-yes>${esc(yesLabel)}</button><button class="btn alt" data-no>${t("Non")}</button></div></div>`;
  holder.querySelector("[data-no]").onclick = () => (holder.innerHTML = "");
  holder.querySelector("[data-yes]").onclick = onYes;
  holder.scrollIntoView({ behavior: "smooth", block: "center" });
}
function needBoss(what) {
  if (isBoss()) return false;
  $view.innerHTML = `<div class="card"><h2>${t("Réservé au patron")}</h2><p class="muted">${esc(what)}</p><a class="btn alt" href="#accueil">${t("Retour")}</a></div>`;
  return true;
}
// Téléchargement d'un fichier (export, rapport)
function download(name, text, type = "text/csv") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: type + ";charset=utf-8" }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
function copyText(text) {
  return (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast(t("Copié.")), () => toast(text));
}
// Petit graphique en barres (SVG), valeurs positives et négatives
function bars(items, { h = 140, color = "var(--accent)", neg = "var(--out)" } = {}) {
  const w = 320, max = Math.max(1, ...items.map((i) => Math.abs(i.v))), hasNeg = items.some((i) => i.v < 0);
  const base = hasNeg ? h / 2 : h - 18, scale = (hasNeg ? h / 2 - 18 : h - 30) / max, bw = w / items.length;
  return `<svg class="chart" viewBox="0 0 ${w} ${h + 4}" role="img">
    <line x1="0" x2="${w}" y1="${base}" y2="${base}" stroke="var(--line)"/>
    ${items.map((it, i) => { const bh = Math.abs(it.v) * scale, y = it.v >= 0 ? base - bh : base;
      return `<rect x="${i * bw + bw * 0.18}" y="${y}" width="${bw * 0.64}" height="${Math.max(bh, it.v ? 1 : 0)}" rx="2" fill="${it.v >= 0 ? color : neg}"><title>${esc(it.l)} : ${fmt(it.v)}</title></rect>
        <text x="${i * bw + bw / 2}" y="${h}" text-anchor="middle" font-size="10" fill="var(--muted)">${esc(it.l)}</text>`; }).join("")}
  </svg>`;
}

// ---------- Verrouillage par code (4 chiffres, gardé haché) et choix de l'utilisateur
async function makePin(p) { const salt = uid(); return { salt, hash: await sha256(salt + p) }; }
const anyPin = () => S.users.some((u) => u.pin);
let locked = false, hiddenAt = 0;
const LOCK_AFTER = 60 * 1000;
function lock(onDone = () => render()) {
  if (!anyPin()) { ME = S.users[0].id; return onDone(); }
  locked = true;
  let entry = "", tries = 0, who = S.users.length === 1 ? S.users[0].id : null;
  $lock.hidden = false;
  const paint = (msg = "") => {
    const u = S.users.find((x) => x.id === who);
    $lock.innerHTML = `<div class="lock-in">
      <span class="mark big" aria-hidden="true">SM</span>
      <p><b>${esc(S.kiosk || CFG.name)}</b></p>
      ${!who ? `<p class="muted">${t("Qui ouvre la caisse ?")}</p>
        <div class="who">${S.users.map((x) => `<button type="button" data-who="${x.id}">${esc(x.name)}<small>${x.role === "patron" ? t("Patron") : t("Employé")}</small></button>`).join("")}</div>`
      : `<p class="muted">${S.users.length > 1 ? esc(u.name) + " · " : ""}${t("Entre ton code")}</p>
      <div class="dots">${[0, 1, 2, 3].map((i) => `<i class="${i < entry.length ? "on" : ""}"></i>`).join("")}</div>
      <p class="msg-ko lock-msg" aria-live="polite">${esc(msg)}</p>
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "‹", 0, "⌫"].map((k) => `<button type="button" data-k="${k}" aria-label="${k === "⌫" ? t("Effacer") : k === "‹" ? t("Changer d'utilisateur") : k}" ${k === "‹" && S.users.length === 1 ? "disabled" : ""}>${k}</button>`).join("")}</div>
      <p class="small muted">${t("Code oublié ? Le patron peut le changer dans Plus › Employés.")}</p>`}
    </div>`;
    $lock.querySelectorAll("[data-who]").forEach((b) => b.onclick = async () => {
      who = b.dataset.who;
      if (!S.users.find((x) => x.id === who).pin) return unlockAs(who);
      paint();
    });
    $lock.querySelectorAll("[data-k]").forEach((b) => b.onclick = () => press(b.dataset.k));
  };
  const unlockAs = (id) => {
    ME = id; locked = false; $lock.hidden = true; $lock.innerHTML = ""; document.removeEventListener("keydown", onKey);
    logEvent("ouverture"); onDone();
  };
  const press = async (k) => {
    if (!who) return;
    if (k === "‹") { who = null; entry = ""; return paint(); }
    if (k === "⌫") entry = entry.slice(0, -1); else if (entry.length < 4) entry += k;
    paint();
    if (entry.length === 4) {
      const u = S.users.find((x) => x.id === who);
      if ((await sha256(u.pin.salt + entry)) === u.pin.hash) return unlockAs(who);
      tries++; entry = "";
      logEvent("code faux (" + u.name + ")");
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
  else if (!gate && !locked && anyPin() && hiddenAt && Date.now() - hiddenAt > LOCK_AFTER) lock();
});
