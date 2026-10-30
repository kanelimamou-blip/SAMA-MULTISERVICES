// Parcours complet dans un navigateur, avec les émulateurs Firebase et les vraies règles :
//   FIREBASE_SDK_DIR=node_modules/firebase npx firebase emulators:exec --only firestore,auth "node tests/parcours.test.cjs"
// Connexion admin, liste des clients, erreur remontée, suspension et réactivation, client qui ne peut ni lire les erreurs
// ni se réactiver, « Voir » un client en lecture seule par rôle, mode présentation, cahier retrouvé sur un autre téléphone.
const fs = require("fs");
const path = require("path");
const http = require("http");
const assert = require("assert");
const { chromium } = require("playwright");

const PROJECT = "demo-sms-parcours", AUTH = "http://127.0.0.1:9099", FS = "http://127.0.0.1:8080", PORT = 8790;
const DOCS = path.join(__dirname, "..", "docs"), SDK = process.env.FIREBASE_SDK_DIR;
const post = (url, body, method = "POST") => fetch(url, { method, headers: { "Content-Type": "application/json", Authorization: "Bearer owner" }, body: JSON.stringify(body) }).then((r) => r.json());
const SUSPENDU = "suspendu, contacte l'équipe au 78 272 19 20";

(async () => {
  // 1. compte admin, et son identifiant dans les règles et dans config.js (jamais son e-mail)
  const est = await post(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, { email: "admin@exemple.sn", password: "secret123", returnSecureToken: true });
  const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8").replace("request.auth.uid in []", `request.auth.uid in ['${est.localId}']`);
  await post(`${FS}/emulator/v1/projects/${PROJECT}:securityRules`, { rules: { files: [{ content: rules }] } }, "PUT");
  // 2. l'appli, avec une configuration de test (projet « demo- » => émulateurs) et le SDK Firebase local
  const config = fs.readFileSync(path.join(DOCS, "config.js"), "utf8")
    .replace(/const FIREBASE_CONFIG = (null|\{[^}]*\});/, `const FIREBASE_CONFIG = { apiKey: "fake", authDomain: "localhost", projectId: "${PROJECT}", appId: "test" };`)
    .replace("admins: [],", `admins: ["${est.localId}"],`);
  assert.ok(config.includes(est.localId));
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split("?")[0]);
    const file = u.startsWith("/sdk/") ? path.join(SDK, u.slice(5)) : path.join(DOCS, u === "/" ? "index.html" : u);
    if (u === "/config.js") { res.writeHead(200, { "Content-Type": "text/javascript" }); return res.end(config); }
    if (u === "/sw.js") { res.writeHead(404); return res.end(); }
    fs.readFile(file, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html" }); res.end(b); });
  }).listen(PORT);
  const URL = `http://localhost:${PORT}/`, shots = process.env.SHOTS;
  const browser = await chromium.launch();
  const page = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => { window.FIREBASE_SDK = "/sdk/"; });
    const p = await ctx.newPage(); p.errs = [];
    p.on("pageerror", (e) => p.errs.push(e.message));
    return p;
  };
  const step = (m) => console.log("✓", m);
  const signup = async (p, name, email) => {
    await p.goto(URL); await p.waitForSelector("#email");
    await p.fill("#name", name); await p.fill("#email", email); await p.fill("#pass", "motdepasse");
    await p.click("#f button[type=submit]"); await p.waitForSelector("#kiosk");
  };
  const login = async (p, email, pass, hash = "") => {
    await p.goto(URL + hash); await p.waitForSelector("#email");
    if (await p.$('[data-m="login"][aria-pressed="false"]')) await p.click('[data-m="login"]');
    await p.fill("#email", email); await p.fill("#pass", pass); await p.click("#f button[type=submit]");
  };
  const amount = async (p) => (await p.textContent(".cash .amount")).replace(/\s/g, "");
  // écriture directe dans Firestore depuis la page (comme quelqu'un qui contourne l'appli)
  const tryWrite = (p, fn) => p.evaluate(`(${fn})().then(() => "écrit", (e) => e.code)`);

  // 3. premier client : inscription, kiosque, journée, un employé, une erreur
  const awa = await page();
  await signup(awa, "Awa Diop", "awa@exemple.sn");
  await awa.fill("#kiosk", "Kiosque Médina"); await awa.fill("#quartier", "Médina"); await awa.fill("#tel", "77 123 45 67");
  await awa.click("#f button[type=submit]");
  await awa.waitForSelector("#cash"); await awa.fill("#cash", "100000"); await awa.fill("#fl-wave", "50000"); await awa.fill("#fl-om", "50000");
  await awa.click("#f button[type=submit]"); await awa.waitForSelector(".cash .amount");
  await awa.click('a[href="#saisie/depot"]'); await awa.fill("#amount", "10000"); await awa.click("#save"); await awa.waitForSelector(".cash .amount");
  assert.strictEqual(await amount(awa), "110000F");
  await awa.evaluate(() => { S.users.push({ id: "e1", name: "Modou", role: "employe", pin: null, salary: 0, prime: 0 }); store.save(); return Compte.push(); });
  step("client : compte créé, journée ouverte, dépôt noté, copie en ligne faite (aucun blocage de paiement)");
  await awa.evaluate(() => setTimeout(() => { throw new Error("plantage de test sur la caisse"); }));
  await awa.waitForTimeout(300);
  assert.strictEqual(await tryWrite(awa, () => firebase.firestore().collection("erreurs").get()), "permission-denied");
  assert.strictEqual(await tryWrite(awa, () => firebase.firestore().collection("kiosques").get()), "permission-denied");
  step("client : ne peut lire ni les erreurs ni la liste des clients");
  // au plus 5 erreurs envoyées par visite
  await awa.evaluate(() => { for (let i = 0; i < 8; i++) setTimeout(() => { throw new Error("plantage de test n°" + i); }); });
  await awa.waitForTimeout(800);

  // 4. deuxième client, pas encore réglé (nouveau) ; il ouvre #admin : il voit son identifiant, rien d'autre
  const modou = await page();
  await signup(modou, "Modou Fall", "modou@exemple.sn");
  await modou.evaluate(() => { location.hash = "admin"; }); await modou.waitForSelector("#ad-uid");
  const modouId = await modou.textContent("#ad-uid");
  assert.ok((await modou.textContent("#view")).includes("pas encore administrateur") && !(await modou.$(".kpis")));
  step("client sur #admin : « pas encore administrateur » et son identifiant avec « Copier »");

  // le bouton « Espace admin » du haut n'est pas visible pour un client ; le lien discret « Espace propriétaire » est en bas de l'accueil
  assert.strictEqual(await awa.isVisible("#adminbtn"), false);
  assert.ok(await awa.$('#view .foot a[href="#admin"]'));

  // 5. admin : par le lien discret de l'écran de connexion, puis ouverture directe de l'espace admin
  const ad = await page();
  await ad.goto(URL); await ad.waitForSelector("#email");
  await ad.$eval('.foot a[href="#admin"]', (a) => a.click()); await ad.waitForFunction(() => location.hash === "#admin");
  await login(ad, "admin@exemple.sn", "secret123", "#admin");
  await ad.waitForSelector(".kpis");
  assert.strictEqual(await ad.isVisible("#adminbtn"), true);
  const kpi = async () => ad.$$eval(".kpis b", (b) => b.map((x) => x.textContent));
  assert.deepStrictEqual(await kpi(), ["2", "1", "0", "5"]);
  let txt = await ad.textContent("#view");
  assert.ok(txt.includes("Kiosque Médina") && txt.includes("Médina") && txt.includes("77 123 45 67") && txt.includes("Modou Fall"), "liste des clients");
  assert.ok(txt.includes("plantage de test sur la caisse"), "erreur remontée");
  assert.ok(txt.includes("1 opération(s) cette semaine"), "activité de la semaine");
  const states = await ad.$$eval("#ad-list li", (l) => l.map((x) => x.querySelector(".pill").textContent));
  assert.deepStrictEqual(states.sort(), ["Actif", "Nouveau"]);
  assert.ok(await ad.$('#ad-list a[href^="https://wa.me/221771234567"]'), "bouton WhatsApp");
  if (shots) await ad.screenshot({ path: shots + "/1-espace-admin.png", fullPage: true });
  await ad.fill("#ad-q", "médina"); assert.strictEqual(await ad.$$eval("#ad-list li", (l) => l.length), 1);
  await ad.fill("#ad-q", ""); await ad.click('[data-f="Nouveau"]');
  assert.ok((await ad.textContent("#ad-list")).includes("Modou Fall") && !(await ad.textContent("#ad-list")).includes("Kiosque Médina"));
  await ad.click('[data-f="tous"]');
  step("admin : 2 inscrits, 1 actif, 0 inactif, 5 erreurs (plafond par visite) ; recherche, filtres, WhatsApp");
  // une erreur effacée
  await ad.click("#tab-e");
  const nErr = await ad.$$eval("[data-er]", (b) => b.length);
  await ad.click("[data-er]"); await ad.waitForTimeout(400);
  assert.strictEqual(await ad.$$eval("[data-er]", (b) => b.length), nErr - 1);
  assert.strictEqual(await ad.textContent("#tab-e"), `Erreurs (${nErr - 1})`);
  await ad.click("#tab-k");
  step("admin : efface une erreur");

  // 6. « Voir » le client, par rôle, en lecture seule
  const row = (name) => `#ad-list li:has-text("${name}")`;
  await ad.click(`${row("Kiosque Médina")} [data-act="voir"]`); await ad.waitForSelector(".cash .amount");
  assert.strictEqual(await amount(ad), "110000F");
  assert.ok((await ad.textContent("#rolebar")).includes("lecture seule"));
  if (shots) await ad.screenshot({ path: shots + "/2-voir-patron.png", fullPage: true });
  await ad.click('#rolebar [data-role="employe"]');
  assert.strictEqual(await ad.evaluate(() => me().role), "employe");
  await ad.evaluate(() => { location.hash = "reglages"; }); await ad.waitForTimeout(200);
  assert.ok((await ad.textContent("#view")).includes("Réservé au patron"));
  await ad.click('#rolebar [data-role="patron"]');
  const awaId = await ad.evaluate(() => VOIR.id);
  assert.strictEqual(await tryWrite(ad, `() => firebase.firestore().doc("kiosques/${awaId}/cahier/base").set({ json: "{}", at: firebase.firestore.FieldValue.serverTimestamp() })`), "permission-denied");
  assert.strictEqual(await tryWrite(ad, `() => firebase.firestore().doc("kiosques/${awaId}").update({ name: "piraté" })`), "permission-denied");
  assert.strictEqual(await ad.evaluate(() => localStorage.getItem("cahier")), null);
  await ad.click('#rolebar [data-role="fin"]'); await ad.waitForSelector(".kpis");
  step("admin : « Voir » ouvre le cahier du client en patron puis en employé ; toute écriture est refusée");

  // 7. suspension : l'écran du client change tout de suite, et plus aucune écriture n'est possible
  await ad.click(`${row("Kiosque Médina")} [data-act="block"]`); await ad.click("[data-yes]"); await ad.waitForTimeout(500);
  assert.ok((await ad.textContent(row("Kiosque Médina"))).includes("Suspendu"));
  await awa.waitForSelector("#suspendu");
  assert.ok((await awa.textContent("#suspendu")).includes(SUSPENDU));
  if (shots) await awa.screenshot({ path: shots + "/3-compte-suspendu.png", fullPage: true });
  assert.strictEqual(await tryWrite(awa, `() => firebase.firestore().doc("kiosques/${awaId}/cahier/j_2026-01-01").set({ day: "2026-01-01", n: 1, json: "{}", at: firebase.firestore.FieldValue.serverTimestamp() })`), "permission-denied");
  assert.strictEqual(await tryWrite(awa, `() => firebase.firestore().doc("kiosques/${awaId}").update({ blocked: false })`), "permission-denied");
  await awa.reload(); await awa.waitForSelector("#suspendu");
  step("client suspendu : « " + SUSPENDU + " », écritures refusées par les règles, ne peut pas se réactiver");
  await ad.click(`${row("Kiosque Médina")} [data-act="unblock"]`);
  await awa.waitForSelector(".cash .amount");
  assert.strictEqual(await amount(awa), "110000F");
  step("admin : réactive ; le client retrouve son cahier tout de suite");

  // 8. mode présentation : données d'exemple et barre des rôles
  await ad.click("#ad-demo"); await ad.waitForSelector(".cash .amount");
  assert.ok((await ad.textContent("#rolebar")).includes("Présentation"));
  assert.strictEqual(await ad.evaluate(() => me().role), "patron");
  await ad.click('#rolebar [data-role="employe"]');
  assert.strictEqual(await ad.evaluate(() => me().name), "Modou");
  if (shots) await ad.screenshot({ path: shots + "/4-presentation.png", fullPage: true });
  await ad.click("#adminbtn"); await ad.waitForSelector(".kpis"); assert.strictEqual(await ad.isVisible("#rolebar"), false);
  step("admin : le bouton « Espace admin » du haut ramène à l'espace admin");
  await ad.click("#ad-demo"); await ad.waitForSelector(".cash .amount");
  await ad.click('#rolebar [data-role="fin"]'); await ad.waitForSelector(".kpis");
  step("admin : mode présentation, passage patron → employé, retour à l'espace admin");

  // 9. invitation d'un nouveau propriétaire : lien et QR code créés par l'admin, utilisés une seule fois
  await ad.click("#ad-inv-open");
  await ad.fill("#inv-name", "Kiosque Liberté"); await ad.fill("#inv-q", "Liberté 6"); await ad.fill("#inv-tel", "78 111 22 33");
  await ad.click('#ad-inv button[type=submit]'); await ad.waitForSelector("#inv-qr svg.qr");
  const link = await ad.textContent("#inv-url");
  assert.ok(/#invite\/[a-z0-9]{15}$/.test(link), "lien d'invitation");
  assert.ok(await ad.$('#inv-wa[href^="https://wa.me/221781112233"]') && await ad.$("#inv-copy"), "boutons Copier et WhatsApp");
  assert.ok((await ad.textContent("#ad-inv-list")).includes("Kiosque Liberté"));
  if (shots) await ad.screenshot({ path: shots + "/5-invitation.png", fullPage: true });
  const fatou = await page();
  await fatou.goto(link); await fatou.waitForSelector("#invite-ok");
  assert.ok((await fatou.textContent("#invite-ok")).includes("Kiosque Liberté"));
  if (shots) await fatou.screenshot({ path: shots + "/6-lien-invitation.png", fullPage: true });
  await fatou.fill("#name", "Fatou Sow"); await fatou.fill("#email", "fatou@exemple.sn"); await fatou.fill("#pass", "motdepasse");
  await fatou.click("#f button[type=submit]"); await fatou.waitForSelector("#kiosk");
  assert.strictEqual(await fatou.inputValue("#kiosk"), "Kiosque Liberté");
  assert.strictEqual(await fatou.inputValue("#quartier"), "Liberté 6");
  step("invitation : l'admin crée le lien et le QR code ; le nouveau propriétaire s'inscrit et trouve son kiosque déjà nommé");
  const again = await page();
  await again.goto(link); await again.waitForSelector("#invite-note .warn-card");
  await again.fill("#name", "Autre"); await again.fill("#email", "autre@exemple.sn"); await again.fill("#pass", "motdepasse");
  await again.click("#f button[type=submit]"); await again.waitForSelector("#kiosk");
  assert.strictEqual(await again.inputValue("#kiosk"), "");
  await ad.click("#reload"); await ad.waitForSelector(".kpis");
  assert.ok((await ad.textContent("#ad-list")).includes("Kiosque Liberté") && !(await ad.textContent("#ad-inv-list")).includes("Kiosque Liberté"));
  step("invitation : déjà servie pour un deuxième compte ; le kiosque invité apparaît chez l'admin");

  // l'admin rouvre l'appli : l'espace admin s'ouvre directement
  await ad.goto(URL); await ad.waitForSelector(".kpis");
  step("admin : à l'ouverture de l'appli, l'espace admin s'ouvre directement");

  // 10. le client change de téléphone : il se connecte et retrouve son cahier
  const awa2 = await page();
  await login(awa2, "awa@exemple.sn", "motdepasse"); await awa2.waitForSelector(".cash .amount");
  assert.strictEqual(await amount(awa2), "110000F");
  step("client sur un autre téléphone : cahier récupéré depuis son compte");

  assert.notStrictEqual(modouId, est.localId);
  for (const p of [awa, modou, ad, awa2, fatou, again]) assert.deepStrictEqual(p.errs.filter((e) => !e.includes("plantage de test")), []);
  await browser.close(); server.close();
  console.log("\nParcours réussi");
})().catch((e) => { console.error("ÉCHEC", e); process.exit(1); });
