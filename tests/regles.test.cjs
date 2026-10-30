// Tests des règles Firestore avec l'émulateur :
//   npx firebase emulators:exec --only firestore,auth "node tests/regles.test.cjs"
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { initializeTestEnvironment, assertSucceeds, assertFails } = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, serverTimestamp, query, where } = require("firebase/firestore");

const ADMIN = "proprietaire-uid";
(async () => {
  const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8").replace("'ADMIN_UID'", `'${ADMIN}'`);
  const env = await initializeTestEnvironment({ projectId: "demo-sms-regles", firestore: { rules, host: "127.0.0.1", port: 8080 } });
  const alice = env.authenticatedContext("alice").firestore();
  const bob = env.authenticatedContext("bob").firestore();
  const admin = env.authenticatedContext(ADMIN).firestore();
  const anon = env.unauthenticatedContext().firestore();
  const fiche = (name) => ({ name, email: name + "@ex.sn", kiosk: "Kiosque " + name, created: serverTimestamp(), lastActive: serverTimestamp(), active: true });
  let n = 0; const ok = async (label, p) => { await assertSucceeds(p); n++; console.log("ok   ", label); };
  const no = async (label, p) => { await assertFails(p); n++; console.log("refus", label); };

  // fiches clients
  await no("créer un compte déjà suspendu", setDoc(doc(alice, "users/alice"), { ...fiche("alice"), active: false }));
  await no("créer la fiche d'un autre", setDoc(doc(bob, "users/alice"), fiche("alice")));
  await no("créer sa fiche avec une date choisie", setDoc(doc(alice, "users/alice"), { ...fiche("alice"), created: new Date(2020, 0, 1) }));
  await ok("créer sa fiche", setDoc(doc(alice, "users/alice"), fiche("alice")));
  await ok("créer sa fiche (bob)", setDoc(doc(bob, "users/bob"), fiche("bob")));
  await ok("lire sa fiche", getDoc(doc(alice, "users/alice")));
  await no("lire la fiche d'un autre", getDoc(doc(bob, "users/alice")));
  await no("lister les comptes (client)", getDocs(collection(alice, "users")));
  await no("lire sans être connecté", getDoc(doc(anon, "users/alice")));
  await ok("noter sa dernière activité", updateDoc(doc(alice, "users/alice"), { lastActive: serverTimestamp(), kiosk: "Kiosque Médina" }));
  await no("changer sa date d'inscription", updateDoc(doc(alice, "users/alice"), { created: serverTimestamp(), lastActive: serverTimestamp() }));
  await no("supprimer sa fiche", deleteDoc(doc(alice, "users/alice")));
  // propriétaire
  await ok("propriétaire : lister les comptes", getDocs(collection(admin, "users")));
  await ok("propriétaire : suspendre", updateDoc(doc(admin, "users/bob"), { active: false, statusAt: serverTimestamp() }));
  await no("propriétaire : changer le nom d'un client", updateDoc(doc(admin, "users/bob"), { name: "x" }));
  await no("client suspendu : se réactiver", updateDoc(doc(bob, "users/bob"), { active: true, statusAt: serverTimestamp() }));
  await ok("client suspendu : voir son statut", getDoc(doc(bob, "users/bob")).then((s) => assert.strictEqual(s.data().active, false)));
  await ok("propriétaire : réactiver", updateDoc(doc(admin, "users/bob"), { active: true, statusAt: serverTimestamp() }));
  // activité
  await ok("noter l'activité du jour", setDoc(doc(alice, "activity/alice_2026-10-30"), { uid: "alice", day: "2026-10-30", at: serverTimestamp() }));
  await no("noter l'activité d'un autre", setDoc(doc(bob, "activity/alice_2026-10-31"), { uid: "alice", day: "2026-10-31", at: serverTimestamp() }));
  await no("lire l'activité (client)", getDocs(collection(alice, "activity")));
  await ok("propriétaire : lire l'activité", getDocs(query(collection(admin, "activity"), where("day", ">=", "2026-10-01"))));
  // erreurs
  const err = (uid) => ({ uid, kind: "plantage", message: "x is undefined", where: "app.js:12", page: "#cloture", app: "2026.10.30", ua: "test", at: serverTimestamp() });
  await ok("enregistrer une erreur", addDoc(collection(alice, "errors"), err("alice")));
  await no("enregistrer une erreur au nom d'un autre", addDoc(collection(bob, "errors"), err("alice")));
  await no("enregistrer une erreur sans être connecté", addDoc(collection(anon, "errors"), err("alice")));
  await no("erreur avec un champ en trop", addDoc(collection(alice, "errors"), { ...err("alice"), cahier: "tout le cahier" }));
  await no("erreur trop longue", addDoc(collection(alice, "errors"), { ...err("alice"), message: "x".repeat(600) }));
  await no("lire les erreurs (client)", getDocs(collection(alice, "errors")));
  const errs = await getDocs(collection(admin, "errors"));
  await ok("propriétaire : lire les erreurs", Promise.resolve(assert.strictEqual(errs.size, 1)));
  await no("client : effacer une erreur", deleteDoc(doc(alice, "errors/" + errs.docs[0].id)));
  await ok("propriétaire : effacer une erreur", deleteDoc(doc(admin, "errors/" + errs.docs[0].id)));
  await env.cleanup();
  console.log(`\n${n} vérifications des règles réussies`);
})().catch((e) => { console.error("ÉCHEC", e); process.exit(1); });
