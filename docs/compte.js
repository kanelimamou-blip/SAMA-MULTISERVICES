"use strict";
// compte.js : comptes des clients (Firebase Auth + Firestore), statut actif ou suspendu, activité, journal des erreurs.
// Le cahier lui-même reste sur le téléphone : seuls le nom, la date d'inscription, l'activité et les erreurs vont en ligne.
// Sans FIREBASE_CONFIG, l'appli marche sans compte (Compte.enabled = false).

const Compte = (() => {
  const SDK = window.FIREBASE_SDK || "https://www.gstatic.com/firebasejs/10.12.2/";
  const enabled = !!FIREBASE_CONFIG;
  let auth = null, db = null, user = null, ready = false;
  const CACHE = "cahier-compte";
  // dernier statut connu, pour ouvrir l'appli hors connexion
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(CACHE) || "{}"); } catch {}
  const keep = (o) => { cache = { ...cache, ...o }; try { localStorage.setItem(CACHE, JSON.stringify(cache)); } catch {} };

  const load = (src) => new Promise((ok, ko) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });

  // Résout avec { user, active } ; user = null si personne n'est connecté.
  // Hors connexion (SDK introuvable), on reprend le dernier statut connu.
  async function start() {
    if (!enabled) return { user: null, active: true };
    try {
      await load(SDK + "firebase-app-compat.js");
      await Promise.all([load(SDK + "firebase-auth-compat.js"), load(SDK + "firebase-firestore-compat.js")]);
    } catch {
      return cache.uid ? { user: { uid: cache.uid, email: cache.email, offline: true }, active: cache.active !== false } : { user: null, active: true, offline: true };
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
    ready = true;
    if (!user) return { user: null, active: true };
    return { user, active: await profile() };
  }

  // Crée la fiche du client à sa première connexion, puis note sa dernière activité (au plus une fois par heure)
  async function profile() {
    const ref = db.collection("users").doc(user.uid);
    let snap;
    try { snap = await ref.get(); } catch (e) { logError({ kind: "refus", message: "lecture du compte : " + (e.code || e.message) }); return cache.active !== false; }
    if (!snap.exists) {
      const ts = firebase.firestore.FieldValue.serverTimestamp();
      await ref.set({ name: (user.displayName || "").slice(0, 60), email: (user.email || "").slice(0, 100), kiosk: (S.kiosk || "").slice(0, 60), created: ts, lastActive: ts, active: true })
        .catch((e) => logError({ kind: "refus", message: "création du compte : " + (e.code || e.message) }));
      keep({ uid: user.uid, email: user.email, active: true });
      touch();
      return true;
    }
    const d = snap.data(), active = d.active !== false;
    keep({ uid: user.uid, email: user.email, active });
    if (active) touch(d);
    return active;
  }
  function touch(d) {
    if (!user || !db) return;
    const day = today();
    if (cache.lastTouch === day + timeNowHour()) return;
    keep({ lastTouch: day + timeNowHour() });
    const ts = firebase.firestore.FieldValue.serverTimestamp(), up = { lastActive: ts };
    if (S.kiosk && (!d || d.kiosk !== S.kiosk)) up.kiosk = S.kiosk.slice(0, 60);
    db.collection("users").doc(user.uid).update(up).catch((e) => logError({ kind: "refus", message: "activité : " + (e.code || e.message) }));
    db.collection("activity").doc(user.uid + "_" + day).set({ uid: user.uid, day, at: ts }).catch(() => {});
  }
  const timeNowHour = () => String(new Date().getHours());
  // le nom du kiosque, pour que le propriétaire reconnaisse le client
  function setKiosk(name) {
    if (!user || !db || user.offline) return;
    db.collection("users").doc(user.uid).update({ kiosk: String(name || "").slice(0, 60), lastActive: firebase.firestore.FieldValue.serverTimestamp() })
      .catch((e) => logError({ kind: "refus", message: "nom du kiosque : " + (e.code || e.message) }));
  }

  // ---------- Connexion
  async function signInGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try { await auth.signInWithPopup(provider); }
    catch (e) { if (/popup|operation-not-supported/.test(e.code || "")) return auth.signInWithRedirect(provider); throw e; }
    user = auth.currentUser; return profile();
  }
  async function signInEmail(email, pass, create, name) {
    const r = create ? await auth.createUserWithEmailAndPassword(email, pass) : await auth.signInWithEmailAndPassword(email, pass);
    user = r.user;
    if (create && name) await user.updateProfile({ displayName: name }).catch(() => {});
    return profile();
  }
  const resetPassword = (email) => auth.sendPasswordResetEmail(email);
  async function signOut() { if (auth) await auth.signOut(); user = null; keep({ uid: null, email: null, active: true, lastTouch: null }); }
  async function refreshActive() { if (!user || !db || user.offline) return cache.active !== false; return profile(); }

  // ---------- Journal des erreurs : plantage ou action refusée chez un client (au plus 20 par visite, sans doublon)
  const seen = new Set(), queue = [];
  let sent = 0;
  function logError({ kind = "erreur", message = "", where = "" }) {
    const msg = String(message).slice(0, 500), key = kind + msg;
    if (!enabled || seen.has(key) || sent >= 20) return;
    seen.add(key);
    const rec = { kind: kind.slice(0, 20), message: msg, where: String(where).slice(0, 300), page: (location.hash || "#accueil").slice(0, 60), app: APP_VERSION, ua: navigator.userAgent.slice(0, 200) };
    if (!user || !db || user.offline) { queue.push(rec); return; }
    sent++;
    db.collection("errors").add({ ...rec, uid: user.uid, at: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
  }
  function flushErrors() { while (queue.length && user && db && !user.offline) { const r = queue.shift(); seen.delete(r.kind + r.message); logError(r); } }
  window.addEventListener("error", (e) => logError({ kind: "plantage", message: e.message || "erreur", where: `${(e.filename || "").split("/").pop()}:${e.lineno || ""}` }));
  window.addEventListener("unhandledrejection", (e) => { const r = e.reason || {}; logError({ kind: r.code === "permission-denied" ? "refus" : "plantage", message: r.message || String(r), where: (r.stack || "").split("\n")[1] || "" }); });

  // ---------- Espace admin (les règles Firestore refusent ces lectures à tout autre compte)
  const isAdmin = () => !!(user && ADMIN_UID && user.uid === ADMIN_UID);
  async function adminData() {
    const d30 = addDays(today(), -29);
    let us, act, errs;
    try {
      [us, act, errs] = await Promise.all([
        db.collection("users").get(),
        db.collection("activity").where("day", ">=", d30).get(),
        db.collection("errors").orderBy("at", "desc").limit(200).get(),
      ]);
    } catch (e) { logError({ kind: "refus", message: "lecture de l'espace admin : " + (e.code || e.message) }); throw e; }
    return {
      users: us.docs.map((x) => ({ id: x.id, ...x.data() })),
      activity: act.docs.map((x) => x.data()),
      errors: errs.docs.map((x) => ({ id: x.id, ...x.data() })),
    };
  }
  const setActive = (uid, active) => db.collection("users").doc(uid).update({ active, statusAt: firebase.firestore.FieldValue.serverTimestamp() });
  const deleteError = (id) => db.collection("errors").doc(id).delete();

  return { enabled, start, setKiosk, signInGoogle, signInEmail, resetPassword, signOut, refreshActive, logError, flushErrors, isAdmin, adminData, setActive, deleteError,
    get user() { return user; }, get ready() { return ready; } };
})();
