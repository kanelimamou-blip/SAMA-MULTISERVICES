// Parcours complet dans un navigateur, avec les émulateurs Firebase et les vraies règles :
//   FIREBASE_SDK_DIR=node_modules/firebase npx firebase emulators:exec --only firestore,auth "node tests/parcours.test.cjs"
// Crée un compte propriétaire et deux clients, provoque une erreur, suspend puis réactive un compte.
const fs = require("fs");
const path = require("path");
const http = require("http");
const assert = require("assert");
const { chromium } = require("playwright");

const PROJECT = "demo-sms-parcours", AUTH = "http://127.0.0.1:9099", FS = "http://127.0.0.1:8080", PORT = 8790;
const DOCS = path.join(__dirname, "..", "docs"), SDK = process.env.FIREBASE_SDK_DIR;
const post = (url, body, method = "POST") => fetch(url, { method, headers: { "Content-Type": "application/json", Authorization: "Bearer owner" }, body: JSON.stringify(body) }).then((r) => r.json());

(async () => {
  // 1. compte du propriétaire et règles avec son identifiant
  const owner = await post(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, { email: "est@exemple.sn", password: "secret123", returnSecureToken: true });
  const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8").replace("'ADMIN_UID'", `'${owner.localId}'`);
  await post(`${FS}/emulator/v1/projects/${PROJECT}:securityRules`, { rules: { files: [{ content: rules }] } }, "PUT");
  // 2. l'appli, avec une configuration de test (projet « demo- » => émulateurs) et le SDK Firebase local
  const config = fs.readFileSync(path.join(DOCS, "config.js"), "utf8")
    .replace("const FIREBASE_CONFIG = null;", `const FIREBASE_CONFIG = { apiKey: "fake", authDomain: "localhost", projectId: "${PROJECT}", appId: "test" };`)
    .replace('const ADMIN_UID = "";', `const ADMIN_UID = "${owner.localId}";`);
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split("?")[0]);
    let file = u.startsWith("/sdk/") ? path.join(SDK, u.slice(5)) : path.join(DOCS, u === "/" ? "index.html" : u);
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

  // 3. premier client : inscription, cahier, une erreur
  const awa = await page();
  await signup(awa, "Awa Diop", "awa@exemple.sn");
  if (shots) await awa.screenshot({ path: shots + "/1-inscription-ok.png", fullPage: true });
  await awa.fill("#kiosk", "Kiosque Médina"); await awa.click("#f button[type=submit]");
  await awa.waitForSelector("#cash"); await awa.fill("#cash", "100000"); await awa.fill("#fl-wave", "50000"); await awa.fill("#fl-om", "50000");
  await awa.click("#f button[type=submit]"); await awa.waitForSelector(".cash .amount");
  await awa.click('a[href="#saisie/depot"]'); await awa.fill("#amount", "10000"); await awa.click("#save"); await awa.waitForSelector(".cash .amount");
  assert.strictEqual((await awa.textContent(".cash .amount")).replace(/\s/g, ""), "110000F");
  step("client : compte créé, journée ouverte, dépôt noté (aucun blocage de paiement)");
  await awa.evaluate(() => setTimeout(() => { throw new Error("plantage de test sur la clôture"); }));
  await awa.evaluate(() => { location.hash = "plus"; });
  await awa.waitForTimeout(300);
  const refused = await awa.evaluate(() => Compte.adminData().then(() => "lu", (e) => e.code));
  assert.strictEqual(refused, "permission-denied");
  step("client : l'espace admin lui est refusé par les règles (" + refused + ")");
  await awa.waitForTimeout(800);

  // 4. deuxième client
  const modou = await page();
  await signup(modou, "Modou Fall", "modou@exemple.sn");
  step("deuxième client inscrit");

  // 5. propriétaire
  const est = await page();
  await est.goto(URL); await est.waitForSelector("#email");
  await est.click('[data-m="login"]'); await est.fill("#email", "est@exemple.sn"); await est.fill("#pass", "secret123"); await est.click("#f button[type=submit]");
  await est.waitForSelector(".stats");
  const txt = await est.textContent("#view");
  assert.ok(txt.includes("Awa Diop") && txt.includes("Modou Fall") && txt.includes("Kiosque Médina"), "liste des comptes");
  assert.ok(txt.includes("plantage de test sur la clôture"), "journal des erreurs");
  assert.ok(txt.includes("refus"), "refus enregistré");
  const comptes = await est.$$eval(".stats b", (b) => b.map((x) => x.textContent));
  assert.deepStrictEqual(comptes, ["2", "2", "0"]);
  if (shots) await est.screenshot({ path: shots + "/2-espace-admin.png", fullPage: true });
  step("propriétaire : 2 comptes, chiffres et journal des erreurs visibles");
  // suspendre Awa
  const awaId = await est.evaluate(() => [...document.querySelectorAll("[data-toggle]")].find((b) => b.closest("li").textContent.includes("Awa")).dataset.toggle);
  await est.click(`[data-toggle="${awaId}"]`); await est.click("[data-yes]"); await est.waitForTimeout(800);
  assert.deepStrictEqual(await est.$$eval(".stats b", (b) => b.map((x) => x.textContent)), ["2", "1", "1"]);
  step("propriétaire : compte d'Awa suspendu");
  await awa.reload(); await awa.waitForSelector("#retry");
  if (shots) await awa.screenshot({ path: shots + "/3-compte-suspendu.png", fullPage: true });
  step("client suspendu : écran « Compte suspendu », cahier fermé");
  await est.click(`[data-toggle="${awaId}"]`); await est.waitForTimeout(800);
  await awa.click("#retry"); await awa.waitForSelector(".tabs a"); await awa.evaluate(() => { location.hash = "accueil"; }); await awa.waitForSelector(".cash .amount");
  assert.strictEqual((await awa.textContent(".cash .amount")).replace(/\s/g, ""), "110000F");
  step("propriétaire : compte réactivé ; le client retrouve son cahier intact");

  for (const p of [awa, modou, est]) assert.deepStrictEqual(p.errs.filter((e) => !e.includes("plantage de test")), []);
  await browser.close(); server.close();
  console.log("\nParcours réussi");
})().catch((e) => { console.error("ÉCHEC", e); process.exit(1); });
