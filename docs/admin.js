"use strict";
// admin.js : connexion des clients, compte suspendu, « Mon compte », et l'espace admin du propriétaire.

const AUTH_ERRORS = {
  "auth/invalid-email": "Adresse e-mail invalide.",
  "auth/user-not-found": "Aucun compte avec cette adresse. Choisis « Créer mon compte ».",
  "auth/wrong-password": "Mot de passe incorrect.",
  "auth/invalid-credential": "Adresse ou mot de passe incorrect.",
  "auth/invalid-login-credentials": "Adresse ou mot de passe incorrect.",
  "auth/email-already-in-use": "Un compte existe déjà avec cette adresse. Choisis « J'ai déjà un compte ».",
  "auth/weak-password": "Le mot de passe doit avoir au moins 6 caractères.",
  "auth/network-request-failed": "Pas de connexion internet. Réessaie quand le réseau revient.",
  "auth/too-many-requests": "Trop d'essais. Attends quelques minutes.",
  "auth/popup-closed-by-user": "Fenêtre Google fermée avant la fin.",
};
const authMsg = (e) => t(AUTH_ERRORS[e && e.code] || "La connexion n'a pas marché. Réessaie.");

function viewLogin(mode = location.hash === "#admin" ? "login" : "create", msg = "") {
  document.body.classList.add("bare");
  const create = mode === "create";
  $view.innerHTML = `<div class="hero">
      <span class="mark big" aria-hidden="true">SM</span>
      <h1>${esc(CFG.name)}</h1>
      <p class="muted">${t("Le cahier de caisse de ton kiosque. Connecte-toi une fois : ensuite l'appli marche aussi sans connexion.")}</p>
    </div>
    <div class="card note"><p class="small">${t("Ton cahier est gardé sur ton téléphone, avec une copie dans ton compte pour le retrouver si tu changes de téléphone. Personne d'autre ne peut le modifier ; l'équipe {app} peut le consulter pour t'aider.", { app: esc(CFG.name) })}</p></div>
    <div class="seg"><button type="button" data-m="create" aria-pressed="${create}">${t("Créer mon compte")}</button><button type="button" data-m="login" aria-pressed="${!create}">${t("J'ai déjà un compte")}</button></div>
    <form class="card" id="f">
      ${create ? textInput("name", "", t("Ton nom"), 'maxlength="60" autocomplete="name" required') : ""}
      ${textInput("email", "", t("Adresse e-mail"), 'type="email" autocomplete="email" required')}
      ${textInput("pass", "", t("Mot de passe (6 caractères ou plus)"), `type="password" minlength="6" autocomplete="${create ? "new-password" : "current-password"}" required`)}
      <p class="${msg.startsWith("✓") ? "msg-ok" : "msg-ko"}" id="err" ${msg ? "" : "hidden"}>${esc(msg.replace(/^✓ /, ""))}</p>
      <button class="btn" type="submit">${create ? t("Créer mon compte") : t("Me connecter")}</button>
      ${!create ? `<button class="link" type="button" id="reset">${t("Mot de passe oublié ?")}</button>` : ""}
    </form>
    <button class="btn alt" id="google">${t("Continuer avec Google")}</button>
    <p class="foot"><a href="#admin">${t("Espace propriétaire")}</a></p>`;
  $view.insertAdjacentHTML("afterbegin", `<div id="invite-note"></div>`);
  Compte.readInvite().then((inv) => {
    const el = document.getElementById("invite-note"); if (!el || !inv) return;
    el.innerHTML = inv.usedBy ? `<div class="card warn-card"><p class="small">${t("Cette invitation a déjà servi. Connecte-toi avec ton compte, ou crée un compte normalement.")}</p></div>`
      : `<div class="card note" id="invite-ok"><p>${t("Invitation de l'équipe {app} pour {k}.", { app: esc(CFG.name), k: `<b>${esc(inv.name)}</b>` })}</p><p class="small">${t("Crée ton compte : ton kiosque sera prêt.")}</p></div>`;
  });
  $view.querySelectorAll("[data-m]").forEach((b) => b.onclick = () => viewLogin(b.dataset.m));
  const err = document.getElementById("err"), fail = (e) => { err.className = "msg-ko"; err.textContent = typeof e === "string" ? e : authMsg(e); err.hidden = false; };
  const after = (blocked) => afterSignIn(blocked);
  document.getElementById("f").onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("[type=submit]"); btn.disabled = true;
    try { after(await Compte.signInEmail(val("email").trim(), val("pass"), create, create ? val("name").trim() : "")); }
    catch (er) { fail(er); btn.disabled = false; }
  };
  document.getElementById("google").onclick = async () => { try { after(await Compte.signInGoogle()); } catch (er) { fail(er); } };
  const r = document.getElementById("reset");
  if (r) r.onclick = async () => {
    if (!val("email").trim()) return fail(t("Écris d'abord ton adresse e-mail."));
    try { await Compte.resetPassword(val("email").trim()); viewLogin("login", "✓ " + t("Un e-mail pour changer le mot de passe a été envoyé.")); } catch (er) { fail(er); }
  };
}

function viewSuspended() {
  document.body.classList.add("bare");
  $view.innerHTML = `<div class="hero"><span class="mark big" aria-hidden="true">SM</span><h1>${t("Compte suspendu")}</h1>
      <p id="suspendu">${t("Ton compte est suspendu, contacte l'équipe au {tel}.", { tel: `<b class="copy">${esc(CFG.contact)}</b>` })}</p>
      <p class="small muted">${t("Ton cahier est toujours sur ton téléphone, rien n'est perdu. Tu pourras de nouveau enregistrer dès que l'équipe réactive ton compte.")}</p></div>
    <div class="card">
      <a class="btn" href="${waLink(CFG.whatsapp.slice(3), t("Bonjour, mon compte {app} est suspendu ({k}).", { app: CFG.name, k: S.kiosk || (Compte.user || {}).email || "" }))}" target="_blank" rel="noopener">${t("Écrire à l'équipe sur WhatsApp")}</a>
      <button class="btn alt" id="retry">${t("Réessayer")}</button>
      <button class="link" id="out">${t("Changer de compte")}</button></div>`;
  document.getElementById("retry").onclick = async () => { if (!(await Compte.refresh())) afterSignIn(false); else toast(t("Le compte est toujours suspendu.")); };
  document.getElementById("out").onclick = async () => { await Compte.signOut(); toLogin(); };
}

function viewCompte() {
  const u = Compte.user;
  if (!u) return go("accueil");
  $view.innerHTML = `<h1>${t("Mon compte")}</h1>
    <div class="card"><p class="row"><span>${t("Adresse")}</span><b>${esc(u.email || "—")}</b></p>
      <p class="row"><span>${t("Statut")}</span><b class="good">${t("Actif")}</b></p>
      <p class="small muted">${t("Ton identifiant")} : <span class="copy" id="uid">${esc(u.uid)}</span> <button class="link" id="cpuid">${t("Copier")}</button></p></div>
    <div class="card note"><p class="small">${t("Ton cahier est gardé sur ce téléphone, avec une copie dans ton compte : si tu changes de téléphone, connecte-toi et il revient. L'équipe peut le consulter pour t'aider, sans pouvoir le modifier.")}</p></div>
    <a class="btn alt" href="#aide">${t("Aide et assistance")}</a>
    <div id="confirm"></div>
    <button class="btn alt" id="out">${t("Me déconnecter")}</button>`;
  document.getElementById("cpuid").onclick = () => copyText(u.uid);
  document.getElementById("out").onclick = () => confirmBox(document.getElementById("confirm"), t("Te déconnecter ? Il faudra te reconnecter avec internet pour rouvrir l'appli. Ton cahier reste sur le téléphone."), t("Me déconnecter"), async () => { await Compte.signOut(); toLogin(); });
}

// ---------- Espace admin (#admin) : tous les kiosques, leur activité, les erreurs ; suspendre ; voir un cahier en lecture seule ; présenter l'appli.
// Accès : comptes listés dans CFG.admins et dans firestore.rules (fonction admin()), qui protège les lectures et les écritures.
// Pas de paiement dans l'appli : l'abonnement est encaissé hors de l'appli, rien ne se bloque tout seul.
const tsDate = (ts) => (ts && ts.toDate ? ts.toDate() : null);
const ageDays = (k) => (tsDate(k.created) ? daysBetween(dayOf(tsDate(k.created)), today()) : 0);
// actif : des opérations notées ces 7 derniers jours
const kState = (k, a) => k.blocked ? ["Suspendu", "off"] : !a ? ["…", ""] : a.ops > 0 ? ["Actif", "on"] : ageDays(k) < 7 ? ["Nouveau", "new"] : ["Inactif", "late"];
function qrSvg(text, size = 220) {
  const q = qrcode(0, "M"); q.addData(text); q.make();
  const n = q.getModuleCount(), m = 2, s = n + m * 2;
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m},${r + m}h1v1h-1z`;
  return `<svg class="qr" viewBox="0 0 ${s} ${s}" width="${size}" height="${size}" role="img" aria-label="QR code"><rect width="${s}" height="${s}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
const FILTERS = [["tous", "Tous"], ["Actif", "Actifs"], ["Nouveau", "Nouveaux"], ["Inactif", "Inactifs"], ["Suspendu", "Suspendus"]];

async function viewAdmin() {
  document.body.classList.add("bare", "admin");
  const back = gate ? "" : `<a class="btn alt" href="#accueil">${t("Retour au cahier")}</a>`;
  if (!Compte.enabled) { $view.innerHTML = `<h1>${t("Espace admin")}</h1><div class="card"><p>${t("L'espace admin a besoin du projet Firebase : il n'est pas encore branché dans config.js.")}</p></div>${back}`; return; }
  if (!Compte.user) return viewLogin("login");
  if (!Compte.isAdmin()) {
    $view.innerHTML = `<h1>${t("Espace admin")}</h1><div class="card"><p>${t("Ce compte n'est pas encore administrateur.")}</p>
      <p>${t("Ton identifiant")} : <b class="copy" id="ad-uid">${esc(Compte.user.uid)}</b></p><button class="btn alt" type="button" id="ad-copy">${t("Copier")}</button>
      <p class="small muted">${t("Il doit être ajouté dans l'appli (config.js, liste admins) et dans les règles Firebase (fonction admin()) pour ouvrir l'espace admin.")}</p></div>${back}`;
    document.getElementById("ad-copy").onclick = () => copyText(Compte.user.uid);
    return;
  }
  $view.innerHTML = `<h1>${t("Espace admin")}</h1><p class="muted">${t("Chargement…")}</p>`;
  const since = addDays(today(), -6);
  let rows, errs, invs, act = {};
  try {
    [rows, errs, invs] = await Promise.all([Compte.kiosques(), Compte.errors(Date.now() - 7 * 864e5), Compte.invites()]);
    await Promise.all(rows.map((k) => Compte.activity(k.id, since).then((a) => { act[k.id] = a; }, () => {})));
  } catch (e) {
    $view.innerHTML = `<h1>${t("Espace admin")}</h1><p class="msg-ko">${t("Lecture impossible : {m}", { m: esc(e.code || e.message) })}</p><p class="small muted">${t("Vérifie que les règles Firebase contiennent bien ton identifiant.")}</p><button class="btn alt" id="reload">${t("Réessayer")}</button>`;
    document.getElementById("reload").onclick = viewAdmin; return;
  }
  if (!$view.isConnected || gate !== "admin" && location.hash !== "#admin") return;
  rows.sort((a, b) => (tsDate(b.lastActive) || 0) - (tsDate(a.lastActive) || 0));
  const st = (k) => kState(k, act[k.id])[0], count = (s) => rows.filter((k) => st(k) === s).length;
  const names = Object.fromEntries(rows.map((k) => [k.id, k.name || "?"]));
  let q = viewAdmin.q || "", filter = viewAdmin.filter || "tous";
  $view.innerHTML = `<div class="row"><h1>${t("Espace admin")}</h1><button class="chip" id="reload">${t("Actualiser")}</button></div>
    <div class="stats four">
      <div><span>${t("Inscrits")}</span><b>${rows.length}</b></div>
      <div><span>${t("Actifs cette semaine")}</span><b>${count("Actif")}</b></div>
      <div><span>${t("Inactifs")}</span><b>${count("Inactif")}</b></div>
      <div><span>${t("Erreurs (7 jours)")}</span><b>${errs.length}</b></div>
    </div>
    <div class="card"><h2>${t("Mode présentation")}</h2><p class="small muted">${t("Montre l'appli sur ton seul téléphone, avec des données d'exemple : tu passes de patron à employé avec la barre en haut de l'écran.")}</p>
      <button class="btn alt" id="ad-demo">${t("Présenter l'appli")}</button></div>
    <div class="card"><h2>${t("Nouveau client")}</h2>
      <p class="small muted">${t("Prépare son kiosque, puis envoie-lui le lien ou fais-lui scanner le QR code : il crée son compte et retrouve son kiosque déjà nommé.")}</p>
      <form id="ad-inv">${textInput("inv-name", "", t("Nom du kiosque"), 'maxlength="60" required')}
        <div class="two">${textInput("inv-q", "", t("Quartier"), 'maxlength="60"')}${textInput("inv-tel", "", t("Téléphone"), 'inputmode="tel" maxlength="20"')}</div>
        <button class="btn" type="submit">${t("Créer l'invitation")}</button></form>
      <div id="ad-inv-show"></div><div id="ad-inv-list"></div></div>
    <div id="confirm"></div>
    <div class="card"><h2>${t("Clients")}</h2>
      <input id="ad-q" class="field-in" placeholder="${t("Chercher un nom, un quartier, un téléphone")}" autocomplete="off" value="${esc(q)}">
      <div class="chips" id="ad-f">${FILTERS.map(([f, l]) => `<button type="button" class="chip" data-f="${f}">${t(l)}</button>`).join("")}</div>
      <div id="ad-list"></div>
      <p class="small muted">${t("Activité = opérations notées ces 7 derniers jours. « Voir » ouvre l'appli comme ce client la voit, en lecture seule : tu peux tout regarder, rien modifier.")}</p></div>
    <div class="card"><h2>${t("Erreurs des 7 derniers jours")}</h2><div id="ad-err"></div></div>
    <p class="small muted">${t("Connecté en tant qu'admin")} : ${esc(Compte.user.email || Compte.user.uid)}</p>
    <button class="btn alt" id="out">${t("Me déconnecter")}</button>`;
  function paint() {
    $view.querySelectorAll("#ad-f [data-f]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.f === filter));
    const list = rows.filter((k) => (filter === "tous" || st(k) === filter) && (!q || `${k.name} ${k.quartier} ${k.tel} ${phoneFmt(k.tel)} ${k.id}`.toLowerCase().includes(q.toLowerCase())));
    document.getElementById("ad-list").innerHTML = list.length ? `<ul class="ops">${list.map((k) => {
      const a = act[k.id], [s, cls] = kState(k, a), e = errs.filter((x) => x.uid === k.id).length, c = tsDate(k.created);
      return `<li class="op acct" data-id="${esc(k.id)}">
        <span class="what"><b>${esc(k.name || "—")}</b><br><span class="small muted">${[k.quartier, phoneFmt(k.tel)].filter(Boolean).map(esc).join(" · ")}${k.quartier || k.tel ? " · " : ""}${t("inscrit le {d}", { d: c ? esc(shortDay(dayOf(c))) : "—" })}</span><br>
          <span class="small">${a ? t("{n} opération(s) cette semaine", { n: a.ops }) + (a.last ? " · " + t("dernière le {d}", { d: esc(shortDay(a.last)) }) : "") : t("Activité inconnue")}${e ? ` · <b class="bad">${t("{n} erreur(s)", { n: e })}</b>` : ""}</span></span>
        <span class="pill ${cls}">${t(s)}</span>
        <span class="acts"><button class="link" data-act="${k.blocked ? "unblock" : "block"}">${k.blocked ? t("Réactiver") : t("Suspendre")}</button>
          ${k.tel ? `<a class="link" target="_blank" rel="noopener" href="${waLink(k.tel, t("Bonjour, ici l'équipe {app}. ", { app: CFG.name }))}">WhatsApp</a>` : ""}
          <button class="link" data-act="voir">${t("Voir")}</button></span></li>`;
    }).join("")}</ul>` : `<p class="muted">${t("Aucun client.")}</p>`;
    document.getElementById("ad-err").innerHTML = errs.length ? `<ul class="ops">${errs.map((x) => `<li class="op err">
      <span class="time">${timeOf(new Date(x.at).toISOString())}</span>
      <span class="what"><b class="${x.kind === "plantage" ? "bad" : ""}">${esc(x.kind)}</b> · ${esc(x.msg)}<br>
        <span class="small muted">${esc(shortDay(dayOf(new Date(x.at))))} · ${esc(names[x.uid] || x.kiosque || t("compte sans kiosque"))} · ${esc(x.role || "—")}${x.who ? " (" + esc(x.who) + ")" : ""} · ${t("écran")} ${esc(x.route)}<br>${esc(x.ua)}</span></span>
      <span class="acts"><button class="link" data-er="${esc(x.id)}" aria-label="${t("Effacer l'erreur")}">${t("Effacer")}</button></span></li>`).join("")}</ul>` : `<p class="muted">${t("Aucune erreur. Tout marche.")}</p>`;
  }
  paint();
  const invUrl = (id) => location.href.split("#")[0] + "#invite/" + id;
  function showInvite(inv) {
    const url = invUrl(inv.id);
    document.getElementById("ad-inv-show").innerHTML = `<div class="qr-box" id="inv-qr"><b>${esc(inv.name)}</b>${qrSvg(url, 220)}
      <span class="small">${t("Scanne pour ouvrir ton kiosque {app}", { app: esc(CFG.name) })}</span><span class="small copy" id="inv-url">${esc(url)}</span></div>
      <div class="inv-btns">${navigator.share ? `<button class="btn alt" type="button" id="inv-share">${t("Partager")}</button>` : ""}
        <button class="btn alt" type="button" id="inv-copy">${t("Copier")}</button>
        <a class="btn" id="inv-wa" target="_blank" rel="noopener" href="${waLink(inv.tel, t("Bonjour, voici ton invitation pour {k} sur {app} : {u}", { k: inv.name, app: CFG.name, u: url }))}">WhatsApp</a></div>`;
    document.getElementById("inv-copy").onclick = () => copyText(url);
    const sh = document.getElementById("inv-share"); if (sh) sh.onclick = () => navigator.share({ title: CFG.name, text: inv.name, url }).catch(() => {});
    document.getElementById("ad-inv-show").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function paintInvites() {
    const wait = invs.filter((i) => !i.usedBy).sort((a, b) => (tsDate(b.created) || 0) - (tsDate(a.created) || 0));
    document.getElementById("ad-inv-list").innerHTML = wait.length ? `<h3>${t("Invitations en attente")}</h3><ul class="ops">${wait.map((i) => `<li class="op acct" data-inv="${esc(i.id)}">
      <span class="what"><b>${esc(i.name)}</b><br><span class="small muted">${[i.quartier, phoneFmt(i.tel)].filter(Boolean).map(esc).join(" · ")}${i.quartier || i.tel ? " · " : ""}${t("créée le {d}", { d: tsDate(i.created) ? esc(shortDay(dayOf(tsDate(i.created)))) : "—" })}</span></span>
      <span class="pill new">${t("En attente")}</span>
      <span class="acts"><button class="link" data-iv="qr">${t("QR et lien")}</button><button class="link" data-iv="del">${t("Supprimer")}</button></span></li>`).join("")}</ul>` : "";
  }
  paintInvites();
  document.getElementById("ad-inv").onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("[type=submit]"); btn.disabled = true;
    const d = { name: val("inv-name").trim(), quartier: val("inv-q").trim(), tel: val("inv-tel") };
    try { const id = await Compte.createInvite(d); const inv = { id, ...d, tel: phoneClean(d.tel), created: null, usedBy: null }; invs.push(inv); e.target.reset(); paintInvites(); showInvite(inv); }
    catch { toast(t("Refusé : ce compte n'est pas admin dans les règles Firebase.")); }
    btn.disabled = false;
  };
  document.getElementById("ad-inv-list").onclick = async (e) => {
    const b = e.target.closest("[data-iv]"); if (!b) return;
    const inv = invs.find((i) => i.id === b.closest("[data-inv]").dataset.inv); if (!inv) return;
    if (b.dataset.iv === "qr") return showInvite(inv);
    try { await Compte.removeInvite(inv.id); invs = invs.filter((i) => i !== inv); document.getElementById("ad-inv-show").innerHTML = ""; paintInvites(); } catch { toast(t("Suppression refusée.")); }
  };
  document.getElementById("reload").onclick = viewAdmin;
  document.getElementById("ad-demo").onclick = () => enterDemo();
  document.getElementById("ad-q").oninput = (e) => { q = viewAdmin.q = e.target.value.trim(); paint(); };
  document.getElementById("ad-f").onclick = (e) => { const b = e.target.closest("[data-f]"); if (b) { filter = viewAdmin.filter = b.dataset.f; paint(); } };
  document.getElementById("out").onclick = async () => { await Compte.signOut(); toLogin(); };
  $view.onclick = async (e) => {
    const er = e.target.closest("[data-er]");
    if (er) { try { await Compte.removeError(er.dataset.er); errs = errs.filter((x) => x.id !== er.dataset.er); paint(); } catch { toast(t("Effacement refusé.")); } return; }
    const b = e.target.closest("[data-act]"); if (!b) return;
    const k = rows.find((x) => x.id === b.closest("[data-id]").dataset.id); if (!k) return;
    if (b.dataset.act === "voir") return openVoir(k);
    const block = b.dataset.act === "block";
    const run = async () => {
      document.getElementById("confirm").innerHTML = "";
      try { await Compte.setBlocked(k.id, block); k.blocked = block; toast(block ? t("{n} suspendu.", { n: k.name }) : t("{n} réactivé.", { n: k.name })); paint(); }
      catch { toast(t("Refusé : ce compte n'est pas admin dans les règles Firebase.")); }
    };
    if (!block) return run();
    confirmBox(document.getElementById("confirm"), t("Suspendre {n} ? Il verra « suspendu, contacte l'équipe au {tel} » et ne pourra plus rien enregistrer jusqu'à ce que tu le réactives.", { n: esc(k.name || "ce client"), tel: esc(CFG.contact) }), t("Suspendre"), run);
  };
}
// le $view.onclick de l'espace admin ne doit pas rester sur les autres écrans
window.addEventListener("hashchange", () => { if (location.hash !== "#admin") $view.onclick = null; });

// ---------- « Voir » : le cahier d'un client, tel qu'il le voit, en lecture seule (rien n'est gardé, et les règles refusent toute écriture de l'admin)
async function openVoir(k) {
  let s;
  try { s = await Compte.loadCahier(k.id); } catch (e) { return toast(t("Lecture impossible : {m}", { m: e.code || e.message })); }
  VOIR = { id: k.id, name: k.name || "?" }; KEY = null; store.warned = false;
  S = s; migrate();
  ME = (S.users.find((u) => u.role === "patron") || S.users[0]).id;
  go("accueil");
}
function closeVoir() {
  VOIR = null; KEY = "cahier"; S = Object.assign(DEFAULTS(), store.load()); migrate(); ME = null;
  go("admin");
}

// Barre du haut en mode présentation ou « Voir » : changer de rôle sur un seul téléphone
function paintBar() {
  const bar = document.getElementById("rolebar"), on = demoOn() || !!VOIR;
  bar.hidden = !on;
  if (!on) return;
  const cur = me().role;
  bar.innerHTML = `<span class="small">${VOIR ? t("Vue de {n} · lecture seule", { n: `<b>${esc(VOIR.name)}</b>` }) : t("Présentation")}</span>
    ${[["patron", "Patron"], ["employe", "Employé"]].map(([r, l]) => `<button type="button" class="chip" data-role="${r}" aria-pressed="${cur === r}" ${S.users.some((u) => u.role === r) ? "" : "disabled"}>${t(l)}</button>`).join("")}
    <button type="button" class="btn-ghost" data-role="fin" aria-label="${t("Quitter")}">✕</button>`;
  bar.onclick = (e) => {
    const b = e.target.closest("[data-role]"); if (!b) return;
    if (b.dataset.role === "fin") return VOIR ? closeVoir() : exitDemo();
    ME = S.users.find((u) => u.role === b.dataset.role).id;
    render();
  };
}
