"use strict";
// compte.js : comptes des clients (Firebase Auth + Firestore), copie en ligne du cahier, suspension, erreurs, et lectures de l'espace admin.
// Le cahier reste d'abord sur le téléphone (l'appli marche sans connexion) ; une copie part en ligne dans kiosques/{uid}/cahier
// pour le retrouver sur un autre téléphone et pour que l'admin puisse le regarder (lecture seule).
// Sans FIREBASE_CONFIG, l'appli marche sans compte (Compte.enabled = false).

const Compte = (() => {
  const SDK = window.FIREBASE_SDK || "https://www.gstatic.com/firebasejs/10.12.2/";
  const enabled = !!FIREBASE_CONFIG;
  let auth = null, db = null, user = null, fiche = null, unwatch = null, onStatus = () => {};
  const CACHE = "cahier-compte";
  // dernier statut connu, pour ouvrir l'appli hors connexion
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(CACHE) || "{}"); } catch {}
  const keep = (o) => { cache = { ...cache, ...o }; try { localStorage.setItem(CACHE, JSON.stringify(cache)); } catch {} };
  const ts = () => firebase.firestore.FieldValue.serverTimestamp();
  const online = () => !!(user && db && !user.offline);

  const load = (src) => new Promise((ok, ko) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });

  // Résout avec { user, blocked } ; user = null si personne n'est connecté.
  // Hors connexion (SDK introuvable), on reprend le dernier statut connu.
  async function start(statusChanged) {
    onStatus = statusChanged || onStatus;
    if (!enabled) return { user: null, blocked: false };
    try {
      await load(SDK + "firebase-app-compat.js");
      await Promise.all([load(SDK + "firebase-auth-compat.js"), load(SDK + "firebase-firestore-compat.js")]);
    } catch {
      return cache.uid ? { user: { uid: cache.uid, email: cache.email, offline: true }, blocked: !!cache.blocked } : { user: null, blocked: false, offline: true };
    }
    firebase.initializeApp(FIREBASE_CONFIG);
    auth = firebase.auth(); db = firebase.firestore();
    // projet de test (« demo-… ») sur cet ordinateur : on parle aux émulateurs Firebase
    if (FIREBASE_CONFIG.projectId.startsWith("demo-") && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      auth.useEmulator("http://127.0.0.1:9099"); db.useEmulator("127.0.0.1", 8080);
    }
    try { await db.enablePersistence({ synchronizeTabs: true }); } catch {}
    await auth.getRedirectResult().catch(() => null);
    user = await new Promise((ok) => { const off = auth.onAuthStateChanged((u) => { off(); ok(u); }); });
    if (!user) return { user: null, blocked: false };
    return { user, blocked: await attach() };
  }

  // Fiche du kiosque : créée à la première connexion, suivie en direct (suspension, réactivation).
  // Le compte admin n'a pas de fiche : il ne tient pas de cahier.
  async function attach() {
    keep({ uid: user.uid, email: user.email });
    flushErrors();
    if (isAdmin()) return false;
    const ref = db.collection("kiosques").doc(user.uid);
    let snap;
    try { snap = await ref.get(); } catch (e) { refused("lecture du kiosque", e); return !!cache.blocked; }
    if (!snap.exists) {
      const d = { name: (S.kiosk || user.displayName || "").slice(0, 60), quartier: (S.quartier || "").slice(0, 60), tel: phoneClean(S.tel).slice(0, 20), owner: user.uid, created: ts(), lastActive: ts() };
      if (!(await useInvite(ref, d))) { try { await ref.set(d); } catch (e) { refused("création du kiosque", e); } }
      fiche = { ...d, blocked: false };
    } else fiche = snap.data();
    keep({ blocked: fiche.blocked === true });
    if (unwatch) unwatch();
    unwatch = ref.onSnapshot((s) => {
      if (!s.exists) return;
      const was = fiche && fiche.blocked === true;
      fiche = s.data(); keep({ blocked: fiche.blocked === true });
      if (was !== (fiche.blocked === true)) onStatus(fiche.blocked === true);
    }, () => {});
    await pull();
    return fiche.blocked === true;
  }
  // ---------- Invitation envoyée par l'admin (lien ou QR code #invite/CODE) : le kiosque est créé avec le nom, le quartier
  // et le téléphone préparés par l'admin, et l'invitation est marquée utilisée dans la même écriture.
  let inviteCode = null;
  try { inviteCode = sessionStorage.getItem("invite"); } catch {}
  function setInvite(code) { inviteCode = code; try { code ? sessionStorage.setItem("invite", code) : sessionStorage.removeItem("invite"); } catch {} }
  const readInvite = () => (inviteCode && db ? db.collection("invitations").doc(inviteCode).get().then((s) => (s.exists ? { id: s.id, ...s.data() } : null), () => null) : Promise.resolve(null));
  async function useInvite(ref, d) {
    const inv = await readInvite();
    setInvite(null);
    if (!inv || inv.usedBy) return false;
    Object.assign(d, { name: inv.name, quartier: inv.quartier, tel: inv.tel, invite: inv.id });
    const b = db.batch();
    b.update(db.collection("invitations").doc(inv.id), { usedBy: user.uid, usedAt: ts() });
    b.set(ref, d);
    try { await b.commit(); } catch (e) { refused("invitation", e); delete d.invite; return false; }
    if (KEY === "cahier" && !S.kiosk) { Object.assign(S, { kiosk: inv.name, quartier: inv.quartier, tel: inv.tel }); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }
    return true;
  }
  const blocked = () => !!(fiche ? fiche.blocked === true : cache.blocked);

  // ---------- Copie en ligne du cahier : un document « base » (réglages, équipe, clients…) et un document par jour (opérations + ouverture/clôture)
  const pushed = {};
  function parts(s) {
    const base = { ...s, ops: undefined, days: undefined, users: s.users.map((u) => ({ ...u, pin: null })) };
    const out = { base: { json: JSON.stringify(base) } }, byDay = {};
    for (const o of s.ops) (byDay[o.day] = byDay[o.day] || []).push(o);
    for (const day of new Set([...Object.keys(byDay), ...Object.keys(s.days || {})])) {
      const ops = byDay[day] || [];
      out["j_" + day] = { day, n: ops.filter((o) => !o.cancelled).length, json: JSON.stringify({ ops, rec: (s.days || {})[day] || null }) };
    }
    return out;
  }
  function assemble(docs) {
    const b = docs.find((d) => d.id === "base");
    const s = Object.assign(DEFAULTS(), b ? JSON.parse(b.data().json) : {});
    s.ops = []; s.days = {};
    for (const d of docs) {
      if (d.id === "base") continue;
      const { ops, rec } = JSON.parse(d.data().json);
      s.ops.push(...ops); if (rec) s.days[d.data().day] = rec;
    }
    s.ops.sort((a, b) => (a.t < b.t ? -1 : 1));
    return s;
  }
  // Au démarrage : ce qui est déjà en ligne ; sur un téléphone neuf, on récupère le cahier
  async function pull() {
    let snap;
    try { snap = await db.collection("kiosques").doc(user.uid).collection("cahier").get(); } catch (e) { return refused("lecture du cahier en ligne", e); }
    snap.docs.forEach((d) => { pushed[d.id] = d.data().json; });
    if (KEY === "cahier" && (!S.operators || !S.operators.length) && !S.ops.length && snap.docs.some((d) => d.id === "base")) {
      S = assemble(snap.docs); migrate();
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {}
      setTimeout(() => toast(t("Ton cahier a été récupéré depuis ton compte.")), 600);
    } else dirty();
  }
  let timer = null, busy = null, again = false;
  function dirty() { if (!online() || isAdmin()) return; clearTimeout(timer); timer = setTimeout(push, 2500); }
  async function push() {
    clearTimeout(timer);
    if (!online() || isAdmin() || KEY !== "cahier" || blocked()) return;
    if (busy) { again = true; return busy; }
    busy = (async () => {
      const col = db.collection("kiosques").doc(user.uid).collection("cahier"), now = parts(S), writes = [];
      for (const [id, d] of Object.entries(now)) if (pushed[id] !== d.json) writes.push([id, d]);
      for (const id of Object.keys(pushed)) if (!now[id]) writes.push([id, null]);
      const info = { name: (S.kiosk || "").slice(0, 60), quartier: (S.quartier || "").slice(0, 60), tel: phoneClean(S.tel).slice(0, 20) }, hour = today() + new Date().getHours();
      const up = {};
      for (const k of Object.keys(info)) if (fiche && info[k] && fiche[k] !== info[k]) up[k] = info[k];
      if (Object.keys(up).length || cache.lastTouch !== hour) up.lastActive = ts();
      try {
        for (let i = 0; i < writes.length || (i === 0 && up.lastActive); i += 400) {
          const b = db.batch();
          if (i === 0 && up.lastActive) b.update(db.collection("kiosques").doc(user.uid), up);
          for (const [id, d] of writes.slice(i, i + 400)) d ? b.set(col.doc(id), { ...d, at: ts() }) : b.delete(col.doc(id));
          await b.commit();
          for (const [id, d] of writes.slice(i, i + 400)) d ? (pushed[id] = d.json) : delete pushed[id];
        }
        if (up.lastActive) keep({ lastTouch: hour });
      } catch (e) { refused("enregistrement du cahier en ligne", e); }
    })();
    await busy; busy = null;
    if (again) { again = false; return push(); }
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") push(); });

  // ---------- Connexion
  async function signInGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try { await auth.signInWithPopup(provider); }
    catch (e) { if (/popup|operation-not-supported/.test(e.code || "")) return auth.signInWithRedirect(provider); throw e; }
    user = auth.currentUser; return attach();
  }
  async function signInEmail(email, pass, create, name) {
    const r = create ? await auth.createUserWithEmailAndPassword(email, pass) : await auth.signInWithEmailAndPassword(email, pass);
    user = r.user;
    if (create && name) await user.updateProfile({ displayName: name }).catch(() => {});
    return attach();
  }
  const resetPassword = (email) => auth.sendPasswordResetEmail(email);
  async function signOut() {
    await push().catch(() => {});
    if (unwatch) unwatch(); unwatch = null; fiche = null;
    if (auth) await auth.signOut(); user = null;
    for (const k of Object.keys(pushed)) delete pushed[k];
    keep({ uid: null, email: null, blocked: false, lastTouch: null });
  }
  async function refresh() {
    if (!online() || isAdmin()) return blocked();
    try { const s = await db.collection("kiosques").doc(user.uid).get({ source: "server" }); if (s.exists) { fiche = s.data(); keep({ blocked: fiche.blocked === true }); } } catch {}
    return blocked();
  }

  // ---------- Erreurs envoyées à l'espace admin : plantage ou écriture refusée (au plus 5 par visite, sans doublon)
  const seen = new Set(), queue = [];
  let sent = 0;
  function report(kind, msg) {
    msg = String(msg || "?").slice(0, 500);
    if (!enabled || seen.has(kind + msg) || sent + queue.length >= 5) return;
    seen.add(kind + msg);
    let role = "", who = "";
    try { role = isAdmin() ? "admin" : me().role || ""; who = me().name || ""; } catch {}
    queue.push({ kind, msg, route: (location.hash || "#accueil").slice(0, 60), role: role.slice(0, 20), who: String(who).slice(0, 40),
      kiosque: String(S.kiosk || "").slice(0, 60), ua: navigator.userAgent.slice(0, 200), app: APP_VERSION, at: Date.now() });
    flushErrors();
  }
  function flushErrors() {
    while (queue.length && online()) { sent++; db.collection("erreurs").add({ ...queue.shift(), uid: user.uid }).catch(() => {}); }
  }
  function refused(what, e) {
    const code = (e && e.code) || "";
    report(code === "permission-denied" ? "refus" : "erreur", `${what} : ${code || (e && e.message) || e}`);
  }
  window.addEventListener("error", (e) => report("plantage", `${e.message || "erreur"} (${(e.filename || "").split("/").pop()}:${e.lineno || ""})`));
  window.addEventListener("unhandledrejection", (e) => { const r = e.reason || {}; report(r.code === "permission-denied" ? "refus" : "plantage", r.message || String(r)); });

  // ---------- Espace admin (les règles Firestore refusent ces lectures et ces écritures à tout autre compte)
  const isAdmin = () => !!(user && CFG.admins.includes(user.uid));
  const kiosques = () => db.collection("kiosques").get().then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));
  // activité d'un kiosque depuis un jour donné : nombre d'opérations et dernier jour avec des opérations
  const activity = (id, since) => db.collection("kiosques").doc(id).collection("cahier").where("day", ">=", since).get()
    .then((s) => { const ds = s.docs.map((d) => d.data()).filter((d) => d.n > 0); return { ops: sum(ds, (d) => d.n), last: ds.map((d) => d.day).sort().pop() || null }; });
  const errors = (sinceMs) => db.collection("erreurs").where("at", ">=", sinceMs).orderBy("at", "desc").limit(200).get().then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));
  const setBlocked = (id, b) => db.collection("kiosques").doc(id).update({ blocked: b });
  const removeError = (id) => db.collection("erreurs").doc(id).delete();
  const createInvite = async ({ name, quartier, tel }) => {
    const code = [...crypto.getRandomValues(new Uint8Array(15))].map((x) => "abcdefghijkmnpqrstuvwxyz23456789"[x % 32]).join("");
    await db.collection("invitations").doc(code).set({ name: name.slice(0, 60), quartier: quartier.slice(0, 60), tel: phoneClean(tel).slice(0, 20), created: ts(), by: user.uid, usedBy: null });
    return code;
  };
  const invites = () => db.collection("invitations").get().then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));
  const removeInvite = (id) => db.collection("invitations").doc(id).delete();
  const loadCahier = (id) => db.collection("kiosques").doc(id).collection("cahier").get().then((s) => assemble(s.docs));

  return { enabled, start, signInGoogle, signInEmail, resetPassword, signOut, refresh, dirty, push, report, isAdmin, blocked,
    kiosques, activity, errors, setBlocked, removeError, loadCahier, setInvite, readInvite, createInvite, invites, removeInvite,
    get user() { return user; }, get fiche() { return fiche; } };
})();
