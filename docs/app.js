"use strict";
// app.js : navigation entre les écrans et démarrage.

function go(h) { if (location.hash === "#" + h) render(); else location.hash = h; }
function paintTop() {
  document.getElementById("kname").textContent = S.kiosk || CFG.name;
  // bouton visible par l'admin seul
  document.getElementById("adminbtn").hidden = !(Compte.enabled && Compte.isAdmin());
}
const ROUTES = {
  accueil: () => viewHome(), saisie: (a) => viewEntry(a), corriger: (a) => (isBoss() ? viewEntry(null, a) : go("journal")), autre: (a) => viewOther(a),
  journal: (a) => viewJournal(a), ouverture: () => viewOpen(), cloture: () => viewClose(), releve: () => viewHandover(),
  plus: () => viewMore(), gains: (a) => viewGains(a), depenses: (a) => viewDepenses(a), baremes: (a) => viewBaremes(a), float: () => viewFloat(),
  services: () => viewServices(), stock: () => viewStock(), rapports: () => viewRapports(), mois: (a) => viewMonth(a), microcredit: () => viewMicrocredit(),
  export: () => viewExport(), impots: () => viewImpots(), equipe: () => viewTeam(), planning: () => viewPlanning(),
  securite: () => viewSecurite(), alerte: () => viewAlerte(), regles: () => viewRegles(), "journal-acces": () => viewAccessLog(),
  clients: () => viewClients(), file: () => viewQueue(), calcul: () => viewCalc(), affiche: () => viewAffiche(),
  cours: () => viewCours(), quiz: () => viewQuiz(), fiches: () => viewFiches(), compte: () => viewCompte(), admin: () => viewAdmin(), parrainage: () => viewParrainage(),
  aide: () => viewAide(), reglages: () => viewSettings(), demo: () => (KEY === "cahier" && !VOIR ? enterDemo() : go("accueil")),
};
const TAB_OF = { saisie: "accueil", autre: "accueil", ouverture: "accueil", releve: "accueil", corriger: "journal", cloture: "cloture" };
function render() {
  if (locked) return;
  paintTop(); paintBar();
  if (gate === "login") return viewLogin();
  if (gate === "suspended") return viewSuspended();
  const [page, ...rest] = location.hash.slice(1).split("/"), arg = rest.join("/");
  // « Espace admin » pendant une présentation ou un « Voir » : on en sort d'abord
  if (page === "admin" && Compte.isAdmin() && (VOIR || demoOn())) return VOIR ? closeVoir() : exitDemo();
  if (page === "admin" || (gate === "admin" && !demoOn() && !VOIR)) return viewAdmin();
  document.body.classList.remove("admin");
  if (VOIR && (!S.operators || !S.operators.length)) { document.body.classList.add("bare"); $view.innerHTML = `<div class="card"><p>${t("Ce client n'a pas encore réglé son cahier.")}</p></div>`; return; }
  if ((!S.operators || !S.operators.length) && page !== "demo") return viewSetup();
  document.body.classList.remove("bare");
  const tab = TAB_OF[page] || (["accueil", "journal", "cloture"].includes(page) ? page : page ? "plus" : "accueil");
  document.querySelectorAll(".tabs a").forEach((a) => a.setAttribute("aria-current", a.dataset.tab === tab ? "page" : "false"));
  window.scrollTo(0, 0);
  (ROUTES[page] || ROUTES.accueil)(arg);
  $view.focus({ preventScroll: true });
}
window.addEventListener("hashchange", render);
$view.addEventListener("click", (e) => { const a = e.target.closest("a[href^='#']"); if (a && a.getAttribute("href") === location.hash) render(); });

// Installation sur l'écran d'accueil
let installEvt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; document.getElementById("install").hidden = standalone(); const b = document.getElementById("install2"); if (b) b.hidden = false; });
async function installNow() { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; document.getElementById("install").hidden = true; render(); }
document.getElementById("install").onclick = installNow;
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
// Carte « Installer l'appli » : bouton direct sur Android (Chrome), sinon le geste à faire selon le téléphone
function installCard(always) {
  if (standalone()) return always ? `<div class="card"><h2>${t("Appli installée")}</h2><p class="small muted">${t("Tu l'ouvres depuis son icône, en plein écran. Elle marche aussi sans connexion.")}</p></div>` : "";
  if (!always) { try { if (localStorage.getItem("cahier-install-plus-tard")) return ""; } catch {} }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return `<div class="card note install-card"><h2>${t("Installe l'appli sur ton téléphone")}</h2>
    <p class="small">${t("Elle s'ouvre alors comme une vraie appli : une icône sur l'écran d'accueil, plein écran, et elle marche même sans connexion.")}</p>
    <button class="btn" id="install2" ${installEvt ? "" : "hidden"}>${t("Installer maintenant")}</button>
    ${installEvt ? "" : `<ol class="small steps">${ios
      ? `<li>${t("Ouvre ce lien dans Safari.")}</li><li>${t("Touche le bouton Partager (le carré avec une flèche).")}</li><li>${t("Choisis « Sur l'écran d'accueil », puis « Ajouter ».")}</li>`
      : `<li>${t("Ouvre ce lien dans Chrome.")}</li><li>${t("Touche le menu ⋮ en haut à droite.")}</li><li>${t("Choisis « Installer l'application » ou « Ajouter à l'écran d'accueil ».")}</li>`}</ol>`}
    ${always ? "" : `<button class="link" id="install-later">${t("Plus tard")}</button>`}</div>`;
}
function wireInstall() {
  const b = document.getElementById("install2"); if (b) b.onclick = installNow;
  const l = document.getElementById("install-later"); if (l) l.onclick = () => { try { localStorage.setItem("cahier-install-plus-tard", "1"); } catch {} l.closest(".card").remove(); };
}
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});

// Démarrage : compte en ligne (si Firebase est configuré), puis le cahier
function startCahier() { if (!S.operators || !S.operators.length) { ME = S.users[0].id; render(); } else lock(); }
function afterSignIn(blocked) {
  gate = Compte.isAdmin() ? "admin" : blocked ? "suspended" : null;
  if (gate === "admin" && !demoOn() && location.hash !== "#admin") { history.replaceState(null, "", "#admin"); }
  if (gate) { document.body.classList.add("bare"); return render(); }
  document.body.classList.remove("bare");
  startCahier();
}
// L'admin suspend ou réactive ce compte : l'écran change tout de suite
function statusChanged(blocked) {
  if (Compte.isAdmin()) return;
  if (blocked) { gate = "suspended"; locked = false; $lock.hidden = true; $lock.innerHTML = ""; render(); }
  else if (gate === "suspended") afterSignIn(false);
}
function toLogin() {
  gate = "login"; VOIR = null; document.body.classList.remove("admin");
  if (KEY !== "cahier") { KEY = "cahier"; S = Object.assign(DEFAULTS(), store.load()); migrate(); }
  location.hash = ""; render();
}
async function boot() {
  // lien ou QR code d'invitation envoyé par l'admin : #invite/CODE
  const inv = location.hash.match(/^#invite\/([a-z0-9]{10,40})$/);
  if (inv) { Compte.setInvite(inv[1]); history.replaceState(null, "", location.pathname + location.search); }
  // le mode démonstration survit au rechargement de la page
  try { if (sessionStorage.getItem("demo")) { KEY = "cahier-demo"; S = Object.assign(DEFAULTS(), store.load()); migrate(); } } catch {}
  document.documentElement.lang = LANG;
  if (!Compte.enabled) return startCahier();
  document.body.classList.add("bare");
  $view.innerHTML = `<p class="muted">${t("Ouverture…")}</p>`;
  const { user, blocked } = await Compte.start(statusChanged);
  if (!user) { gate = "login"; return render(); }
  afterSignIn(blocked);
}
boot();
