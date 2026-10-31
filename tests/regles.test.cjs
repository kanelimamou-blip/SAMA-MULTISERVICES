// Tests des règles Firestore avec l'émulateur :
//   npx firebase emulators:exec --only firestore,auth "node tests/regles.test.cjs"
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { initializeTestEnvironment, assertSucceeds, assertFails } = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, serverTimestamp, query, where, writeBatch } = require("firebase/firestore");

const ADMIN = "proprietaire-uid";
(async () => {
  const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8").replace(/request.auth.uid in \[[^\]]*\]/, `request.auth.uid in ['${ADMIN}']`);
  assert.ok(rules.includes(ADMIN), "identifiant admin placé dans admin()");
  const env = await initializeTestEnvironment({ projectId: "demo-sms-regles", firestore: { rules, host: "127.0.0.1", port: 8080 } });
  const alice = env.authenticatedContext("alice").firestore();
  const bob = env.authenticatedContext("bob").firestore();
  const admin = env.authenticatedContext(ADMIN).firestore();
  const anon = env.unauthenticatedContext().firestore();
  const fiche = (uid) => ({ name: "Kiosque " + uid, quartier: "Médina", tel: "771234567", owner: uid, created: serverTimestamp(), lastActive: serverTimestamp() });
  const jour = (day) => ({ day, n: 3, json: JSON.stringify({ ops: [], rec: null }), at: serverTimestamp() });
  let n = 0; const ok = async (label, p) => { await assertSucceeds(p); n++; console.log("ok   ", label); };
  const no = async (label, p) => { await assertFails(p); n++; console.log("refus", label); };

  // fiches des kiosques
  await no("créer un kiosque déjà suspendu", setDoc(doc(alice, "kiosques/alice"), { ...fiche("alice"), blocked: false }));
  await no("créer le kiosque d'un autre", setDoc(doc(bob, "kiosques/alice"), fiche("alice")));
  await no("créer son kiosque avec une date choisie", setDoc(doc(alice, "kiosques/alice"), { ...fiche("alice"), created: new Date(2020, 0, 1) }));
  await ok("créer son kiosque", setDoc(doc(alice, "kiosques/alice"), fiche("alice")));
  await ok("créer son kiosque (bob)", setDoc(doc(bob, "kiosques/bob"), fiche("bob")));
  await ok("lire son kiosque", getDoc(doc(alice, "kiosques/alice")));
  await no("lire le kiosque d'un autre", getDoc(doc(bob, "kiosques/alice")));
  await no("lister les kiosques (client)", getDocs(collection(alice, "kiosques")));
  await no("lire sans être connecté", getDoc(doc(anon, "kiosques/alice")));
  await ok("changer son nom et son activité", updateDoc(doc(alice, "kiosques/alice"), { name: "Kiosque Médina", lastActive: serverTimestamp() }));
  await no("changer sa date d'inscription", updateDoc(doc(alice, "kiosques/alice"), { created: serverTimestamp(), lastActive: serverTimestamp() }));
  await no("se suspendre ou se marquer non suspendu", updateDoc(doc(alice, "kiosques/alice"), { blocked: false }));
  await no("supprimer son kiosque", deleteDoc(doc(alice, "kiosques/alice")));
  // cahier en ligne
  await ok("enregistrer la base du cahier", setDoc(doc(alice, "kiosques/alice/cahier/base"), { json: "{}", at: serverTimestamp() }));
  await ok("enregistrer une journée", setDoc(doc(alice, "kiosques/alice/cahier/j_2026-10-30"), jour("2026-10-30")));
  await ok("enregistrer une journée (bob)", setDoc(doc(bob, "kiosques/bob/cahier/j_2026-10-30"), jour("2026-10-30")));
  await no("journée au mauvais nom", setDoc(doc(alice, "kiosques/alice/cahier/j_2026-10-31"), jour("2026-10-30")));
  await no("écrire dans le cahier d'un autre", setDoc(doc(bob, "kiosques/alice/cahier/j_2026-10-29"), jour("2026-10-29")));
  await no("lire le cahier d'un autre", getDocs(collection(bob, "kiosques/alice/cahier")));
  // admin
  await ok("admin : lister les kiosques", getDocs(collection(admin, "kiosques")));
  await ok("admin : lire un cahier (Voir)", getDocs(collection(admin, "kiosques/alice/cahier")));
  await ok("admin : activité de la semaine", getDocs(query(collection(admin, "kiosques/alice/cahier"), where("day", ">=", "2026-10-24"))));
  await no("admin : modifier le cahier d'un client", setDoc(doc(admin, "kiosques/alice/cahier/j_2026-10-30"), jour("2026-10-30")));
  await no("admin : effacer une journée d'un client", deleteDoc(doc(admin, "kiosques/alice/cahier/j_2026-10-30")));
  await no("admin : changer le nom d'un kiosque", updateDoc(doc(admin, "kiosques/bob"), { name: "x" }));
  await ok("admin : noter un paiement et un tarif", updateDoc(doc(admin, "kiosques/alice"), { payeLe: "2026-10-31", payeMois: "2026-10", tarif: 3000 }));
  await no("client : se noter payé", updateDoc(doc(alice, "kiosques/alice"), { payeMois: "2026-12", lastActive: serverTimestamp() }));
  await no("client : changer son tarif", updateDoc(doc(alice, "kiosques/alice"), { tarif: 0, lastActive: serverTimestamp() }));
  await ok("admin : suspendre", updateDoc(doc(admin, "kiosques/bob"), { blocked: true }));
  // client suspendu
  await ok("client suspendu : voir qu'il est suspendu", getDoc(doc(bob, "kiosques/bob")).then((s) => assert.strictEqual(s.data().blocked, true)));
  await no("client suspendu : se réactiver", updateDoc(doc(bob, "kiosques/bob"), { blocked: false }));
  await no("client suspendu : noter son activité", updateDoc(doc(bob, "kiosques/bob"), { lastActive: serverTimestamp() }));
  await no("client suspendu : enregistrer une journée", setDoc(doc(bob, "kiosques/bob/cahier/j_2026-10-31"), jour("2026-10-31")));
  await no("client suspendu : modifier une journée", setDoc(doc(bob, "kiosques/bob/cahier/j_2026-10-30"), jour("2026-10-30")));
  await no("client suspendu : effacer une journée", deleteDoc(doc(bob, "kiosques/bob/cahier/j_2026-10-30")));
  await ok("client suspendu : relire son cahier", getDocs(collection(bob, "kiosques/bob/cahier")));
  await ok("admin : réactiver", updateDoc(doc(admin, "kiosques/bob"), { blocked: false }));
  await ok("client réactivé : enregistrer de nouveau", setDoc(doc(bob, "kiosques/bob/cahier/j_2026-10-31"), jour("2026-10-31")));
  // erreurs
  const err = (uid) => ({ uid, kind: "plantage", msg: "x is undefined", route: "#cloture", role: "patron", who: "Awa", kiosque: "Kiosque Médina", ua: "test", app: "2026.10.30", at: Date.now() });
  await ok("envoyer une erreur", addDoc(collection(alice, "erreurs"), err("alice")));
  await no("envoyer une erreur au nom d'un autre", addDoc(collection(bob, "erreurs"), err("alice")));
  await no("envoyer une erreur sans être connecté", addDoc(collection(anon, "erreurs"), err("alice")));
  await no("erreur avec un champ en trop", addDoc(collection(alice, "erreurs"), { ...err("alice"), cahier: "tout le cahier" }));
  await no("erreur trop longue", addDoc(collection(alice, "erreurs"), { ...err("alice"), msg: "x".repeat(600) }));
  await no("lire les erreurs (client)", getDocs(collection(alice, "erreurs")));
  const errs = await getDocs(collection(admin, "erreurs"));
  await ok("admin : lire les erreurs", Promise.resolve(assert.strictEqual(errs.size, 1)));
  await no("client : effacer une erreur", deleteDoc(doc(alice, "erreurs/" + errs.docs[0].id)));
  await ok("admin : effacer une erreur", deleteDoc(doc(admin, "erreurs/" + errs.docs[0].id)));
  // invitations de l'admin (lien ou QR code)
  const carol = env.authenticatedContext("carol").firestore(), dan = env.authenticatedContext("dan").firestore();
  const inv = { name: "Kiosque Liberté", quartier: "Liberté 6", tel: "781112233", created: serverTimestamp(), by: ADMIN, usedBy: null };
  await no("client : créer une invitation", setDoc(doc(alice, "invitations/codeA"), { ...inv, by: "alice" }));
  await ok("admin : créer une invitation", setDoc(doc(admin, "invitations/code-liberte-123"), inv));
  await no("admin : invitation déjà utilisée à la création", setDoc(doc(admin, "invitations/code2"), { ...inv, usedBy: "carol" }));
  await ok("lire une invitation avec son code, sans compte", getDoc(doc(anon, "invitations/code-liberte-123")));
  await no("lister les invitations (client)", getDocs(collection(alice, "invitations")));
  await ok("admin : lister les invitations", getDocs(collection(admin, "invitations")));
  await no("marquer l'invitation utilisée sans créer son kiosque", updateDoc(doc(carol, "invitations/code-liberte-123"), { usedBy: "carol", usedAt: serverTimestamp() }));
  await no("kiosque avec une invitation qu'on n'utilise pas", setDoc(doc(carol, "kiosques/carol"), { ...fiche("carol"), invite: "code-liberte-123" }));
  await no("utiliser l'invitation pour un compte qui a déjà un kiosque", (() => { const b = writeBatch(alice); b.update(doc(alice, "invitations/code-liberte-123"), { usedBy: "alice", usedAt: serverTimestamp() }); b.set(doc(alice, "kiosques/alice"), { ...fiche("alice"), invite: "code-liberte-123" }); return b.commit(); })());
  const use = (db, uid) => { const b = writeBatch(db); b.update(doc(db, "invitations/code-liberte-123"), { usedBy: uid, usedAt: serverTimestamp() }); b.set(doc(db, "kiosques/" + uid), { ...fiche(uid), name: inv.name, invite: "code-liberte-123" }); return b.commit(); };
  await ok("nouveau propriétaire : utiliser l'invitation en créant son kiosque", use(carol, "carol"));
  await no("réutiliser une invitation déjà servie", use(dan, "dan"));
  await no("client : supprimer une invitation", deleteDoc(doc(carol, "invitations/code-liberte-123")));
  await ok("admin : supprimer une invitation", deleteDoc(doc(admin, "invitations/code-liberte-123")));
  await env.cleanup();
  console.log(`\n${n} vérifications des règles réussies`);
})().catch((e) => { console.error("ÉCHEC", e); process.exit(1); });
