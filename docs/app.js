"use strict";
// app.js : navigation entre les écrans et démarrage.

function go(h) { if (location.hash === "#" + h) render(); else location.hash = h; }
function paintTop() { document.getElementById("kname").textContent = S.kiosk || CFG.name; }
const ROUTES = {
  accueil: () => viewHome(), saisie: (a) => viewEntry(a), corriger: (a) => (isBoss() ? viewEntry(null, a) : go("journal")), autre: (a) => viewOther(a),
  journal: (a) => viewJournal(a), ouverture: () => viewOpen(), cloture: () => viewClose(), releve: () => viewHandover(),
  plus: () => viewMore(), gains: (a) => viewGains(a), depenses: (a) => viewDepenses(a), baremes: (a) => viewBaremes(a), float: () => viewFloat(),
  services: () => viewServices(), stock: () => viewStock(), rapports: () => viewRapports(), mois: (a) => viewMonth(a), microcredit: () => viewMicrocredit(),
  export: () => viewExport(), impots: () => viewImpots(), equipe: () => viewTeam(), planning: () => viewPlanning(),
  securite: () => viewSecurite(), alerte: () => viewAlerte(), regles: () => viewRegles(), "journal-acces": () => viewAccessLog(),
  clients: () => viewClients(), file: () => viewQueue(), calcul: () => viewCalc(), affiche: () => viewAffiche(),
  cours: () => viewCours(), quiz: () => viewQuiz(), fiches: () => viewFiches(), compte: () => viewCompte(), admin: () => viewAdmin(), parrainage: () => viewParrainage(),
  aide: () => viewAide(), reglages: () => viewSettings(), demo: () => (KEY === "cahier" ? enterDemo() : go("accueil")),
};
const TAB_OF = { saisie: "accueil", autre: "accueil", ouverture: "accueil", releve: "accueil", corriger: "journal", cloture: "cloture" };
function render() {
  if (locked) return;
  paintTop();
  if (gate === "login") return viewLogin();
  if (gate === "suspended") return viewSuspended();
  if (gate === "admin") return viewAdmin();
  const [page, ...rest] = location.hash.slice(1).split("/"), arg = rest.join("/");
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
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; document.getElementById("install").hidden = false; });
document.getElementById("install").onclick = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; document.getElementById("install").hidden = true; };
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});

// Démarrage : compte en ligne (si Firebase est configuré), puis le cahier
function startCahier() { if (!S.operators || !S.operators.length) { ME = S.users[0].id; render(); } else lock(); }
function afterSignIn(active) {
  gate = Compte.isAdmin() ? "admin" : active ? null : "suspended";
  if (gate) { document.body.classList.add("bare"); return render(); }
  document.body.classList.remove("bare");
  Compte.flushErrors();
  startCahier();
}
function toLogin() { gate = "login"; document.body.classList.remove("admin"); location.hash = ""; render(); }
async function boot() {
  // le mode démonstration survit au rechargement de la page
  try { if (sessionStorage.getItem("demo")) { KEY = "cahier-demo"; S = Object.assign(DEFAULTS(), store.load()); migrate(); } } catch {}
  document.documentElement.lang = LANG;
  if (!Compte.enabled) return startCahier();
  document.body.classList.add("bare");
  $view.innerHTML = `<p class="muted">${t("Ouverture…")}</p>`;
  const { user, active } = await Compte.start();
  if (!user) { gate = "login"; return render(); }
  afterSignIn(active);
}
boot();
