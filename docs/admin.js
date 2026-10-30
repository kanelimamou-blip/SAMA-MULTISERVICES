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

function viewLogin(mode = "create", msg = "") {
  document.body.classList.add("bare");
  const create = mode === "create";
  $view.innerHTML = `<div class="hero">
      <span class="mark big" aria-hidden="true">SM</span>
      <h1>${esc(CFG.name)}</h1>
      <p class="muted">${t("Le cahier de caisse de ton kiosque. Connecte-toi une fois : ensuite l'appli marche aussi sans connexion.")}</p>
    </div>
    <div class="card note"><p class="small">${t("Ton cahier (opérations, montants, numéros des clients) reste sur ton téléphone. Ton compte sert seulement à te reconnaître.")}</p></div>
    <div class="seg"><button type="button" data-m="create" aria-pressed="${create}">${t("Créer mon compte")}</button><button type="button" data-m="login" aria-pressed="${!create}">${t("J'ai déjà un compte")}</button></div>
    <form class="card" id="f">
      ${create ? textInput("name", "", t("Ton nom"), 'maxlength="60" autocomplete="name" required') : ""}
      ${textInput("email", "", t("Adresse e-mail"), 'type="email" autocomplete="email" required')}
      ${textInput("pass", "", t("Mot de passe (6 caractères ou plus)"), `type="password" minlength="6" autocomplete="${create ? "new-password" : "current-password"}" required`)}
      <p class="${msg.startsWith("✓") ? "msg-ok" : "msg-ko"}" id="err" ${msg ? "" : "hidden"}>${esc(msg.replace(/^✓ /, ""))}</p>
      <button class="btn" type="submit">${create ? t("Créer mon compte") : t("Me connecter")}</button>
      ${!create ? `<button class="link" type="button" id="reset">${t("Mot de passe oublié ?")}</button>` : ""}
    </form>
    <button class="btn alt" id="google">${t("Continuer avec Google")}</button>`;
  $view.querySelectorAll("[data-m]").forEach((b) => b.onclick = () => viewLogin(b.dataset.m));
  const err = document.getElementById("err"), fail = (e) => { err.className = "msg-ko"; err.textContent = typeof e === "string" ? e : authMsg(e); err.hidden = false; };
  const after = (active) => afterSignIn(active);
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
      <p class="muted">${t("Ton compte {app} est suspendu pour le moment. Ton cahier est toujours sur ton téléphone, rien n'est perdu.", { app: esc(CFG.name) })}</p></div>
    <div class="card"><p>${t("Pour le réactiver, écris-nous sur WhatsApp au")} <b class="copy">${esc(phoneFmt(CFG.whatsapp.slice(3)))}</b>.</p>
      <a class="btn" href="${waLink(CFG.whatsapp.slice(3), t("Bonjour, mon compte {app} est suspendu ({e}).", { app: CFG.name, e: (Compte.user || {}).email || "" }))}" target="_blank" rel="noopener">${t("Écrire sur WhatsApp")}</a>
      <button class="btn alt" id="retry">${t("Réessayer")}</button>
      <button class="link" id="out">${t("Changer de compte")}</button></div>`;
  document.getElementById("retry").onclick = async () => { const a = await Compte.refreshActive(); if (a) afterSignIn(true); else toast(t("Le compte est toujours suspendu.")); };
  document.getElementById("out").onclick = async () => { await Compte.signOut(); toLogin(); };
}

function viewCompte() {
  const u = Compte.user;
  if (!u) return go("accueil");
  $view.innerHTML = `<h1>${t("Mon compte")}</h1>
    <div class="card"><p class="row"><span>${t("Adresse")}</span><b>${esc(u.email || "—")}</b></p>
      <p class="row"><span>${t("Statut")}</span><b class="good">${t("Actif")}</b></p>
      <p class="small muted">${t("Ton identifiant")} : <span class="copy" id="uid">${esc(u.uid)}</span> <button class="link" id="cpuid">${t("Copier")}</button></p></div>
    <div class="card note"><p class="small">${t("Ton cahier reste sur ce téléphone. Le compte sert à te reconnaître et à t'aider en cas de problème.")}</p></div>
    <a class="btn alt" href="#aide">${t("Aide et assistance")}</a>
    <div id="confirm"></div>
    <button class="btn alt" id="out">${t("Me déconnecter")}</button>`;
  document.getElementById("cpuid").onclick = () => copyText(u.uid);
  document.getElementById("out").onclick = () => confirmBox(document.getElementById("confirm"), t("Te déconnecter ? Il faudra te reconnecter avec internet pour rouvrir l'appli. Ton cahier reste sur le téléphone."), t("Me déconnecter"), async () => { await Compte.signOut(); toLogin(); });
}

// ---------- Espace admin du propriétaire
const tsDate = (ts) => (ts && ts.toDate ? ts.toDate() : null);
const ago = (d) => {
  if (!d) return "—";
  const days = daysBetween(dayOf(d), today());
  return days === 0 ? t("aujourd'hui") + " " + timeOf(d.toISOString()) : days === 1 ? t("hier") : t("il y a {n} jours", { n: days });
};
async function viewAdmin() {
  if (!Compte.isAdmin()) return go("accueil");
  document.body.classList.add("bare", "admin");
  $view.innerHTML = `<div class="row"><h1>${t("Espace propriétaire")}</h1><button class="chip" id="reload">${t("Actualiser")}</button></div><p class="muted">${t("Chargement…")}</p>`;
  document.getElementById("reload").onclick = viewAdmin;
  let data;
  try { data = await Compte.adminData(); }
  catch (e) { $view.innerHTML = `<h1>${t("Espace propriétaire")}</h1><p class="msg-ko">${t("Lecture refusée ou impossible : {m}", { m: esc(e.code || e.message) })}</p><p class="small muted">${t("Vérifie que les règles Firestore contiennent bien ton identifiant.")}</p><button class="btn alt" id="reload">${t("Réessayer")}</button>`; document.getElementById("reload").onclick = viewAdmin; return; }
  const day = today(), d7 = addDays(day, -6), d30 = addDays(day, -29);
  const users = data.users.filter((u) => u.id !== ADMIN_UID).sort((a, b) => (tsDate(b.lastActive) || 0) - (tsDate(a.lastActive) || 0));
  const actives = (from) => new Set(data.activity.filter((a) => a.day >= from && a.uid !== ADMIN_UID).map((a) => a.uid)).size;
  const newIn = (from) => users.filter((u) => tsDate(u.created) && dayOf(tsDate(u.created)) >= from).length;
  const daily = []; for (let d = addDays(day, -13); d <= day; d = addDays(d, 1)) daily.push({ l: d.slice(8), v: new Set(data.activity.filter((a) => a.day === d && a.uid !== ADMIN_UID).map((a) => a.uid)).size });
  const name = (uid) => { const u = data.users.find((x) => x.id === uid); return u ? u.name || u.email || uid : uid; };
  const filter = viewAdmin.filter || "tous";
  const shown = users.filter((u) => filter === "tous" || (filter === "suspendus" ? u.active === false : u.active !== false));
  $view.innerHTML = `<div class="row"><h1>${t("Espace propriétaire")}</h1><button class="chip" id="reload">${t("Actualiser")}</button></div>
    <div class="stats">
      <div><span>${t("Comptes")}</span><b>${users.length}</b></div>
      <div><span>${t("Actifs")}</span><b>${users.filter((u) => u.active !== false).length}</b></div>
      <div><span>${t("Suspendus")}</span><b>${users.filter((u) => u.active === false).length}</b></div>
    </div>
    <div class="card"><h2>${t("Utilisation")}</h2>
      <div class="table-wrap"><table class="tot"><thead><tr><th></th><th>${t("Jour")}</th><th>${t("7 jours")}</th><th>${t("30 jours")}</th></tr></thead>
        <tbody><tr><th>${t("Comptes qui ont ouvert l'appli")}</th><td>${actives(day)}</td><td>${actives(d7)}</td><td>${actives(d30)}</td></tr>
        <tr><th>${t("Nouveaux comptes")}</th><td>${newIn(day)}</td><td>${newIn(d7)}</td><td>${newIn(d30)}</td></tr></tbody></table></div>
      <p class="small muted">${t("Comptes actifs par jour, 14 derniers jours")}</p>${bars(daily, { h: 110 })}</div>
    <div class="card"><div class="row"><h2>${t("Comptes clients")}</h2>
      <div class="chips">${["tous", "actifs", "suspendus"].map((f) => `<button class="chip" data-f="${f}" aria-pressed="${f === filter}">${t(f[0].toUpperCase() + f.slice(1))}</button>`).join("")}</div></div>
      ${shown.length ? `<ul class="ops">${shown.map((u) => `<li class="op acct">
        <span class="what"><b>${esc(u.name || "—")}</b>${u.kiosk ? " · " + esc(u.kiosk) : ""}<br><span class="small muted">${esc(u.email || "")}</span><br>
          <span class="small">${t("Inscrit le {d}", { d: tsDate(u.created) ? esc(shortDay(dayOf(tsDate(u.created)))) : "—" })} · ${t("dernière activité {a}", { a: esc(ago(tsDate(u.lastActive))) })}</span></span>
        <span class="pill ${u.active === false ? "off" : "on"}">${u.active === false ? t("Suspendu") : t("Actif")}</span>
        <span class="acts"><button class="link" data-toggle="${u.id}" data-to="${u.active === false ? "1" : "0"}">${u.active === false ? t("Réactiver") : t("Suspendre")}</button></span></li>`).join("")}</ul>`
        : `<p class="muted">${t("Aucun compte pour l'instant.")}</p>`}</div>
    <div class="card"><div class="row"><h2>${t("Journal des erreurs")}</h2><span class="small muted">${t("{n} dernière(s)", { n: data.errors.length })}</span></div>
      ${data.errors.length ? `<ul class="ops">${data.errors.map((e) => `<li class="op err">
        <span class="time">${tsDate(e.at) ? timeOf(tsDate(e.at).toISOString()) : "—"}</span>
        <span class="what"><b class="${e.kind === "plantage" ? "bad" : ""}">${esc(e.kind)}</b> · ${esc(e.message)}<br>
          <span class="small muted">${esc(name(e.uid))} · ${t("page")} ${esc(e.page)}${e.where ? " · " + esc(e.where) : ""} · ${tsDate(e.at) ? esc(shortDay(dayOf(tsDate(e.at)))) : ""}${e.app ? " · v" + esc(e.app) : ""}</span></span>
        <span class="acts"><button class="link" data-delerr="${e.id}">${t("Effacer")}</button></span></li>`).join("")}</ul>`
        : `<p class="muted">${t("Aucune erreur enregistrée.")}</p>`}</div>
    <div id="confirm"></div>
    <p class="small muted">${t("Connecté en tant que propriétaire")} : ${esc(Compte.user.email || "")}</p>
    <button class="btn alt" id="out">${t("Me déconnecter")}</button>`;
  document.getElementById("reload").onclick = viewAdmin;
  $view.querySelectorAll("[data-f]").forEach((b) => b.onclick = () => { viewAdmin.filter = b.dataset.f; viewAdmin(); });
  $view.querySelectorAll("[data-toggle]").forEach((b) => b.onclick = () => {
    const on = b.dataset.to === "1", who = name(b.dataset.toggle);
    const run = async () => { try { await Compte.setActive(b.dataset.toggle, on); toast(on ? t("Compte réactivé.") : t("Compte suspendu.")); viewAdmin(); } catch (e) { toast(t("Refusé : {m}", { m: e.code || e.message })); } };
    if (on) return run();
    confirmBox(document.getElementById("confirm"), t("Suspendre le compte de {n} ? Il ne pourra plus ouvrir l'appli jusqu'à ce que tu le réactives.", { n: esc(who) }), t("Suspendre"), run);
  });
  $view.querySelectorAll("[data-delerr]").forEach((b) => b.onclick = async () => { await Compte.deleteError(b.dataset.delerr).catch(() => {}); b.closest("li").remove(); });
  document.getElementById("out").onclick = async () => { await Compte.signOut(); toLogin(); };
}
