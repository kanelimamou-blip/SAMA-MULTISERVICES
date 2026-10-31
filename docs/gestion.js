"use strict";
// gestion.js : gains et commissions, barèmes, dépenses et bénéfice, épargne, float (seuils, prévision, graphiques),
// services et stock, rapports (WhatsApp, mois, export, micro-crédit).

// ---------- Gains : jour, semaine, mois, et comparaison des opérateurs
function viewGains(arg) {
  const day = today(), m = arg && /^\d{4}-\d\d$/.test(arg) ? arg : monthOf(day);
  const [from, to] = monthBounds(m), ws = weekStart(day);
  const ops = opsBetween(from, to);
  const byOp = {};
  for (const o of ops.filter((x) => x.kind === "mm")) { const r = (byOp[o.op] = byOp[o.op] || { com: 0, vol: 0, n: 0 }); r.com += o.commission || 0; r.vol += o.amount; r.n++; }
  const services = sum(ops.filter((o) => o.kind === "service"), gainOf), ventes = sum(ops.filter((o) => o.kind === "vente"), gainOf);
  const gain = gainBetween(from, to), dep = expensesBetween(from, to);
  const days = []; for (let d = addDays(day, -6); d <= day; d = addDays(d, 1)) days.push({ l: shortDay(d).split(" ")[0], v: gainBetween(d, d) });
  const best = Object.entries(byOp).sort((a, b) => b[1].com - a[1].com)[0];
  const prevM = monthOf(addDays(from, -1)), nextM = monthOf(addDays(to, 1));
  $view.innerHTML = `<h1>${t("Mes gains")}</h1>
    <div class="stats">
      <div><span>${t("Aujourd'hui")}</span><b>${fmt(gainBetween(day, day))}</b></div>
      <div><span>${t("Cette semaine")}</span><b>${fmt(gainBetween(ws, day))}</b></div>
      <div><span>${t("Ce mois")}</span><b>${fmt(gainBetween(monthOf(day) + "-01", day))}</b></div>
    </div>
    <div class="card"><h2>${t("7 derniers jours")}</h2>${bars(days)}</div>
    <div class="row daynav">${`<a class="chip" href="#gains/${prevM}">‹</a>`}<h2>${esc(monthName(m))}</h2>${nextM <= monthOf(day) ? `<a class="chip" href="#gains/${nextM}">›</a>` : "<span></span>"}</div>
    <div class="card"><h2>${t("Quel opérateur rapporte le plus ?")}</h2>
      ${Object.keys(byOp).length ? `<div class="table-wrap"><table class="tot"><thead><tr><th>${t("Opérateur")}</th><th>${t("Volume")}</th><th>${t("Nb")}</th><th>${t("Commission")}</th></tr></thead>
        <tbody>${Object.entries(byOp).sort((a, b) => b[1].com - a[1].com).map(([op, r]) => `<tr><th>${esc(opName(op))}</th><td>${fmt(r.vol)}</td><td>${r.n}</td><td><b>${fmt(r.com)}</b></td></tr>`).join("")}</tbody></table></div>
        ${best && best[1].com ? `<p class="small">${t("{op} rapporte le plus ce mois : {m} pour 100 000 F traités.", { op: esc(opName(best[0])), m: fmt(best[1].vol ? (best[1].com * 100000) / best[1].vol : 0) })}</p>` : ""}`
      : `<p class="muted">${t("Pas encore d'opérations ce mois-ci.")}</p>`}
      ${!OPS().some((o) => hasBareme(o.id)) ? `<p class="small muted">${t("Saisis tes barèmes pour calculer les commissions.")} <a href="#baremes">${t("Barèmes")}</a></p>` : ""}
    </div>
    <div class="card"><h2>${t("Bénéfice réel du mois")}</h2>
      <p class="row"><span>${t("Commissions mobile money")}</span><b>${fmt(sum(Object.values(byOp), (r) => r.com))}</b></p>
      <p class="row"><span>${t("Services (crédit, factures…)")}</span><b>${fmt(services)}</b></p>
      <p class="row"><span>${t("Marge sur les ventes")}</span><b>${fmt(ventes)}</b></p>
      <p class="row"><span>${t("Dépenses")}</span><b class="bad">${fmt(-dep)}</b></p>
      <p class="row total"><span>${t("Bénéfice")}</span><b class="${gain - dep >= 0 ? "good" : "bad"}">${fmt(gain - dep)}</b></p>
      <a class="small" href="#depenses/${m}">${t("Voir les dépenses")}</a>
    </div>
    ${epargneCard()}`;
  wireEpargne();
}
function epargneCard() {
  const g = S.epargne.goal || 0, s = savedTotal(), p = g ? Math.min(100, Math.round((100 * s) / g)) : 0;
  return `<div class="card"><h2>${t("Objectif d'épargne")}</h2>
    ${g ? `<p>${esc(S.epargne.label || t("Mon objectif"))} : <b>${fmt(s)}</b> / ${fmt(g)}</p><div class="bar"><i style="width:${p}%"></i></div>
      <p class="small muted">${p >= 100 ? t("Objectif atteint, bravo !") : t("Encore {m} à mettre de côté.", { m: fmt(g - s) })}</p>` : `<p class="small muted">${t("Fixe un objectif (équipement, loyer d'avance, fête…) et note ce que tu mets de côté.")}</p>`}
    <div class="two">${textInput("eplabel", S.epargne.label, t("Pour quoi"), 'maxlength="40"')}${moneyInput("epgoal", g, t("Montant visé"))}</div>
    <div class="two"><button class="btn alt" id="epsave">${t("Enregistrer l'objectif")}</button><a class="btn" href="#autre/epargne">${t("Mettre de côté")}</a></div></div>`;
}
function wireEpargne() {
  wireMoney();
  const b = document.getElementById("epsave");
  if (b) b.onclick = () => { S.epargne = { label: val("eplabel").trim(), goal: num(val("epgoal")) }; store.save(); toast(t("Enregistré.")); render(); };
}

// ---------- Dépenses du mois
function viewDepenses(arg) {
  const m = arg && /^\d{4}-\d\d$/.test(arg) ? arg : monthOf(today()), [from, to] = monthBounds(m);
  const ops = opsBetween(from, to).filter((o) => o.kind === "depense" || o.kind === "avance" || (o.kind === "float" && o.sub === "recharge" && o.fee));
  const cats = {};
  for (const o of ops) { const c = o.kind === "avance" ? t("Salaire") : o.kind === "float" ? t("Transport (recharge de float)") : t(o.cat); cats[c] = (cats[c] || 0) + (o.kind === "float" ? o.fee : o.amount); }
  $view.innerHTML = `<h1>${t("Dépenses de {m}", { m: esc(monthName(m)) })}</h1>
    <div class="card">${Object.keys(cats).length ? Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<p class="row"><span>${esc(c)}</span><b>${fmt(v)}</b></p>`).join("") + `<p class="row total"><span>${t("Total")}</span><b>${fmt(sum(Object.values(cats)))}</b></p>` : `<p class="muted">${t("Aucune dépense notée ce mois-ci.")}</p>`}</div>
    <a class="btn" href="#autre/depense">${t("Noter une dépense")}</a>
    <div class="card"><h2>${t("Note de frais : transport pour la recharge")}</h2>
      ${ops.filter((o) => o.kind === "float" || o.cat === "Transport (recharge de float)").map((o) => `<p class="row small"><span>${esc(shortDay(o.day))} · ${esc(o.partner || o.label || "")}</span><b>${fmt(o.kind === "float" ? o.fee : o.amount)}</b></p>`).join("") || `<p class="small muted">${t("Rien ce mois-ci.")}</p>`}</div>`;
}

// ---------- Barèmes de commission (agent) et de frais (client), saisis par l'agent
function viewBaremes(which = "com") {
  if (needBoss(t("Seul le patron peut changer les barèmes."))) return;
  const src = which === "fees" ? S.fees : S.baremes;
  const op = viewBaremes.op && OPS().some((o) => o.id === viewBaremes.op) ? viewBaremes.op : OPS()[0].id;
  const rows = (k) => ((src[op] || {})[k] || []);
  const table = (k) => `<div class="card"><h2>${t(TYPES[k])}s</h2>
    <p class="small muted">${t("Une ligne par palier : « jusqu'à » (laisser vide pour « au-delà ») et la valeur en F ou en % (ex. 1%).")}</p>
    <div class="tiers" data-k="${k}">${[...rows(k), {}, {}].map((r, i) => `<div class="two tier"><input inputmode="numeric" placeholder="${t("Jusqu'à (F)")}" value="${r.max ? r.max.toLocaleString("fr-FR") : ""}" data-max data-money aria-label="${t("Jusqu'à")}"><input placeholder="${which === "fees" ? t("Frais (F ou %)") : t("Commission (F ou %)")}" value="${esc(r.val || "")}" data-val aria-label="${t("Valeur")}"></div>`).join("")}</div></div>`;
  $view.innerHTML = `<h1>${which === "fees" ? t("Frais payés par le client") : t("Mes barèmes de commission")}</h1>
    <div class="seg"><button type="button" data-w="com" aria-pressed="${which !== "fees"}">${t("Mes commissions")}</button><button type="button" data-w="fees" aria-pressed="${which === "fees"}">${t("Frais client")}</button></div>
    <p class="small muted">${which === "fees" ? t("Recopie la grille de frais de chaque opérateur. Elle sert à la calculatrice et à l'affiche des tarifs.") : t("Recopie la grille que ton opérateur ou ton super-agent t'a donnée. L'appli ne la connaît pas d'avance.")}</p>
    <div class="chips">${OPS().map((o) => `<button type="button" class="chip" data-op="${o.id}" aria-pressed="${o.id === op}">${esc(o.name)}</button>`).join("")}</div>
    ${table("depot")}${table("retrait")}
    <button class="btn" id="save">${t("Enregistrer")}</button>`;
  wireMoney();
  $view.querySelectorAll("[data-w]").forEach((b) => b.onclick = () => go("baremes/" + b.dataset.w));
  $view.querySelectorAll("[data-op]").forEach((b) => b.onclick = () => { viewBaremes.op = b.dataset.op; viewBaremes(which); });
  document.getElementById("save").onclick = () => {
    const out = {};
    $view.querySelectorAll(".tiers").forEach((tb) => {
      out[tb.dataset.k] = [...tb.querySelectorAll(".tier")].map((r) => ({ max: num(r.querySelector("[data-max]").value), val: r.querySelector("[data-val]").value.trim() })).filter((r) => r.val);
    });
    src[op] = out; store.save(); toast(t("Barème {op} enregistré.", { op: opName(op) }));
  };
}

// ---------- Float : seuils, retraits annoncés, jours chargés, graphiques, recharges, échanges et prêts
function viewFloat() {
  const day = today(), from = addDays(day, -6);
  const week = []; for (let d = from; d <= day; d = addDays(d, 1)) { const e = sum(live(d), (o) => effect(o).cash); week.push({ l: shortDay(d).split(" ")[0], v: e }); }
  const hours = Array(24).fill(0), past = S.ops.filter((o) => o.kind === "mm" && !o.cancelled && o.day >= addDays(day, -30));
  for (const o of past) hours[new Date(o.t).getHours()]++;
  const h0 = Math.max(0, hours.findIndex((x) => x)), h1 = 23 - Math.max(0, hours.slice().reverse().findIndex((x) => x));
  const peak = hours.indexOf(Math.max(...hours));
  const rech = S.ops.filter((o) => o.kind === "float" && !o.cancelled).slice(-15).reverse();
  const loans = openLoans();
  $view.innerHTML = `<h1>${t("Mon float et mon liquide")}</h1>
    <div class="card"><h2>${t("Seuils d'alerte")}</h2>
      <p class="small muted">${t("L'appli t'avertit quand ton liquide ou un solde passe sous ce minimum.")}</p>
      ${moneyInput("s-cash", S.seuils.cash, t("Liquide minimum"))}
      ${OPS().map((o) => moneyInput("s-" + o.id, (S.seuils.float || {})[o.id], t("Solde {op} minimum", { op: o.name }))).join("")}
      ${textInput("superphone", S.contacts.super, t("Téléphone de mon super-agent (pour la reconstitution)"), 'type="tel" inputmode="tel" maxlength="14"')}
      <button class="btn alt" id="saveseuils">${t("Enregistrer les seuils")}</button></div>
    <div class="card"><h2>${t("Entrées et sorties de liquide, 7 jours")}</h2>${bars(week)}
      <p class="small muted">${t("Au-dessus : il entre plus de liquide qu'il n'en sort. En dessous : il en sort plus.")}</p></div>
    <div class="card"><h2>${t("Heures de pointe (30 jours)")}</h2>
      ${past.length ? bars(hours.slice(h0, h1 + 1).map((v, i) => ({ l: String(h0 + i), v })), { h: 120 }) + `<p class="small">${t("Le plus d'opérations vers {h} h.", { h: peak })}</p>` : `<p class="small muted">${t("Pas encore assez d'opérations.")}</p>`}</div>
    <div class="card"><h2>${t("Retraits annoncés par les clients")}</h2>
      ${S.annonces.filter((a) => !a.done && a.date >= day).map((a) => `<p class="row small"><span>${esc(shortDay(a.date))} · ${esc(a.client)}</span><span><b>${fmt(a.amount)}</b> <button class="link" data-ann="${a.id}">${t("Retirer")}</button></span></p>`).join("") || `<p class="small muted">${t("Aucun retrait annoncé.")}</p>`}
      <div class="two">${textInput("a-client", "", t("Client"), 'maxlength="40" list="cl2"')}<label class="field"><span>${t("Date")}</span><input id="a-date" type="date" value="${addDays(day, 1)}"></label></div>
      <datalist id="cl2">${S.clients.map((c) => `<option value="${esc(c.name)}">`).join("")}</datalist>
      ${moneyInput("a-amount", "", t("Montant annoncé"))}
      <button class="btn alt" id="addann">${t("Ajouter")}</button></div>
    <div class="card"><h2>${t("Jours chargés")}</h2>
      <p class="small muted">${t("La prévision de liquide tient compte de la fin du mois, des veilles de fête et des jours de marché.")}</p>
      <fieldset class="field"><legend>${t("Jours de marché")}</legend><div class="checks">${["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((d, i) => `<label class="check"><input type="checkbox" data-market="${i}" ${(S.marketDays || []).includes(i) ? "checked" : ""}> ${t(d)}</label>`).join("")}</div></fieldset>
      ${S.fetes.filter((f) => f.date >= day).map((f) => `<p class="row small"><span>${esc(shortDay(f.date))} · ${esc(f.label)}</span><button class="link" data-fete="${f.date}">${t("Retirer")}</button></p>`).join("")}
      <div class="two">${textInput("f-label", "", t("Fête"), 'maxlength="30" placeholder="Tabaski"')}<label class="field"><span>${t("Date")}</span><input id="f-date" type="date"></label></div>
      <button class="btn alt" id="addfete">${t("Enregistrer")}</button></div>
    <div class="card"><h2>${t("Recharges et échanges de float")}</h2>
      ${rech.length ? `<ul class="ops">${rech.map((o) => `<li class="opday">${esc(shortDay(o.day))}</li>` + opRow(o) + (o.fee ? `<li class="small muted">${t("Coût")} : ${fmt(o.fee)}</li>` : "")).join("")}</ul>
        <p class="small">${t("Coût des recharges sur 30 jours")} : <b>${fmt(sum(S.ops.filter((o) => o.kind === "float" && !o.cancelled && o.day >= addDays(day, -30)), (o) => o.fee || 0))}</b></p>` : `<p class="small muted">${t("Aucune recharge notée.")}</p>`}
      <a class="btn alt" href="#autre/float">${t("Noter une recharge ou un échange")}</a></div>
    <div class="card"><h2>${t("Prêts de liquide entre agents")}</h2>
      ${loans.map((l) => `<p class="row"><span>${esc(l.partner)}</span><b class="${l.bal > 0 ? "good" : "bad"}">${l.bal > 0 ? t("te doit {m}", { m: fmt(l.bal) }) : t("tu lui dois {m}", { m: fmt(-l.bal) })}</b></p>`).join("") || `<p class="small muted">${t("Aucun prêt en cours.")}</p>`}
      <a class="btn alt" href="#autre/pret">${t("Noter un prêt ou un remboursement")}</a></div>`;
  wireMoney();
  document.getElementById("saveseuils").onclick = () => {
    S.seuils = { cash: num(val("s-cash")), float: Object.fromEntries(OPS().map((o) => [o.id, num(val("s-" + o.id))])) };
    S.contacts.super = phoneClean(val("superphone")); store.save(); toast(t("Seuils enregistrés."));
  };
  document.getElementById("addann").onclick = () => {
    if (!val("a-client").trim() || !num(val("a-amount")) || !val("a-date")) return toast(t("Remplis le client, la date et le montant."));
    S.annonces.push({ id: uid(), client: val("a-client").trim(), date: val("a-date"), amount: num(val("a-amount")) }); store.save(); viewFloat();
  };
  $view.querySelectorAll("[data-ann]").forEach((b) => b.onclick = () => { S.annonces = S.annonces.filter((a) => a.id !== b.dataset.ann); store.save(); viewFloat(); });
  $view.querySelectorAll("[data-market]").forEach((c) => c.onchange = () => { S.marketDays = [...$view.querySelectorAll("[data-market]:checked")].map((x) => +x.dataset.market); store.save(); });
  document.getElementById("addfete").onclick = () => { if (!val("f-date") || !val("f-label").trim()) return toast(t("Écris la fête et sa date.")); S.fetes.push({ date: val("f-date"), label: val("f-label").trim() }); store.save(); viewFloat(); };
  $view.querySelectorAll("[data-fete]").forEach((b) => b.onclick = () => { S.fetes = S.fetes.filter((f) => f.date !== b.dataset.fete); store.save(); viewFloat(); });
}

// ---------- Services du kiosque (crédit, pass, factures, autres revenus) et petit stock
const SVC_PRESETS = [
  ["Crédit téléphonique", "commission"], ["Pass internet", "commission"], ["Facture Senelec", "commission"], ["Woyofal", "commission"],
  ["Facture Sen'Eau", "commission"], ["Ticket de transport", "commission"], ["Colis (point relais)", "revenu"], ["Photocopie et impression", "revenu"], ["Recharge de téléphone", "revenu"],
];
function viewServices() {
  if (needBoss(t("Seul le patron peut changer les services."))) return;
  $view.innerHTML = `<h1>${t("Services du kiosque")}</h1>
    <p class="small muted">${t("Crédit, pass, factures, tickets, colis, photocopies… Chaque vente se note dans « Crédit, facture » et compte dans tes gains.")}</p>
    <div class="card">${S.services.length ? S.services.map((s) => `<div class="row"><span><b>${esc(s.name)}</b><br><span class="small muted">${s.mode === "revenu" ? t("Revenu du kiosque") : `${s.floatOp ? t("Payé avec le solde {op}", { op: esc(opName(s.floatOp)) }) + " · " : ""}${t("Commission")} ${s.comType === "pct" ? s.com + " %" : fmt(s.com)}`}</span></span><button class="link" data-del="${s.id}">${t("Retirer")}</button></div>`).join("") : `<p class="muted">${t("Aucun service pour l'instant.")}</p>`}</div>
    <form class="card" id="f"><h2>${t("Ajouter un service")}</h2>
      <div class="chips">${SVC_PRESETS.filter(([n]) => !S.services.some((s) => s.name === t(n))).map(([n, m]) => `<button type="button" class="chip" data-preset="${esc(n)}" data-mode="${m}">${t(n)}</button>`).join("")}</div>
      ${textInput("name", "", t("Nom"), 'maxlength="40" required')}
      ${selectInput("mode", [["commission", t("Je touche une commission")], ["revenu", t("Tout le montant est pour le kiosque")]], "commission", t("Type"))}
      ${selectInput("floatop", [["", t("Aucun (stock à part)")], ...OPS().map((o) => [o.id, o.name])], "", t("Payé avec le solde de"))}
      <div class="two">${textInput("com", "", t("Commission"), 'inputmode="decimal" maxlength="8"')}${selectInput("comtype", [["pct", "%"], ["fixe", "F"]], "pct", t("En"))}</div>
      <button class="btn" type="submit">${t("Ajouter")}</button></form>`;
  $view.querySelectorAll("[data-preset]").forEach((b) => b.onclick = () => { document.getElementById("name").value = b.textContent; document.getElementById("mode").value = b.dataset.mode; });
  $view.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => { S.services = S.services.filter((s) => s.id !== b.dataset.del); store.save(); viewServices(); });
  document.getElementById("f").onsubmit = (e) => {
    e.preventDefault();
    S.services.push({ id: uid(), name: val("name").trim(), mode: val("mode"), floatOp: val("floatop"), com: parseFloat(val("com").replace(",", ".")) || 0, comType: val("comtype") });
    store.save(); toast(t("Service ajouté.")); viewServices();
  };
}
function viewStock() {
  if (needBoss(t("Seul le patron peut changer le stock."))) return;
  $view.innerHTML = `<h1>${t("Produits et stock")}</h1>
    <div class="card">${S.stock.length ? `<div class="table-wrap"><table class="tot"><thead><tr><th>${t("Produit")}</th><th>${t("Achat")}</th><th>${t("Vente")}</th><th>${t("Stock")}</th></tr></thead>
      <tbody>${S.stock.map((s) => `<tr><th>${esc(s.name)}<br><button class="link" data-plus="${s.id}">${t("+ Arrivage")}</button></th><td>${fmt(s.cost)}</td><td>${fmt(s.price)}</td><td class="${s.min && s.qty <= s.min ? "bad" : ""}">${s.qty}</td></tr>`).join("")}</tbody></table></div>
      <p class="small">${t("Valeur du stock (prix d'achat)")} : <b>${fmt(sum(S.stock, (s) => s.cost * s.qty))}</b></p>` : `<p class="muted">${t("Aucun produit. Cartes SIM, chargeurs, écouteurs, petite épicerie…")}</p>`}</div>
    <div id="arr"></div>
    <form class="card" id="f"><h2>${t("Ajouter un produit")}</h2>
      ${textInput("name", "", t("Nom"), 'maxlength="40" required placeholder="Carte SIM"')}
      <div class="two">${moneyInput("cost", "", t("Prix d'achat"))}${moneyInput("price", "", t("Prix de vente"))}</div>
      <div class="two">${textInput("qty", "", t("Quantité"), 'inputmode="numeric"')}${textInput("min", "", t("Alerte sous"), 'inputmode="numeric"')}</div>
      <button class="btn" type="submit">${t("Ajouter")}</button></form>`;
  wireMoney();
  $view.querySelectorAll("[data-plus]").forEach((b) => b.onclick = () => {
    const it = S.stock.find((s) => s.id === b.dataset.plus), box = document.getElementById("arr");
    box.innerHTML = `<div class="card"><h2>${t("Arrivage : {p}", { p: esc(it.name) })}</h2>${textInput("aq", "", t("Quantité reçue"), 'inputmode="numeric"')}
      <label class="check"><input type="checkbox" id="apay"> ${t("Payé avec le liquide de la caisse")}</label><button class="btn" id="aok">${t("Ajouter au stock")}</button></div>`;
    box.scrollIntoView({ behavior: "smooth" });
    document.getElementById("aok").onclick = () => {
      const q = num(val("aq")); if (!q) return;
      it.qty += q;
      if (document.getElementById("apay").checked && balances(today()) && !S.days[today()].close) S.ops.push({ id: uid(), t: new Date().toISOString(), day: today(), kind: "depense", cat: "Fournitures", label: t("Achat stock : {p} ×{n}", { p: it.name, n: q }), amount: it.cost * q, fromCash: true, user: ME });
      store.save(); viewStock();
    };
  });
  document.getElementById("f").onsubmit = (e) => {
    e.preventDefault();
    S.stock.push({ id: uid(), name: val("name").trim(), cost: num(val("cost")), price: num(val("price")), qty: num(val("qty")), min: num(val("min")) });
    store.save(); toast(t("Produit ajouté.")); viewStock();
  };
}

// ---------- Rapports
const noSeuils = () => !(S.seuils.cash || Object.values(S.seuils.float || {}).some(Boolean));
function dayReport(day) {
  const tot = totals(day), d = S.days[day] || {}, b = balances(day), c = d.close, o0 = d.open;
  const flagged = live(day).filter((o) => o.flag);
  // une ligne par caisse : matin, soir (compté si la journée est clôturée), écart
  const line = (name, morning, expected, counted, seuil) => {
    const soir = counted ?? expected, low = seuil && soir < seuil;
    return `${name} : ${t("matin")} ${o0 ? fmt(morning || 0) : "—"} · ${t("soir")} ${b ? fmt(soir) : "—"}${counted != null ? ` · ${t("écart")} ${fmtSigned(counted - expected)}` : ""}${low ? ` ⚠ ${t("sous le seuil de {s}", { s: fmt(seuil) })}` : ""}`;
  };
  const lines = [
    t("Rapport du {d} · {k}", { d: longDay(day), k: S.kiosk || CFG.name }),
    "",
    t("Soldes (matin · soir · écart)") + " :",
    b ? line(t("Liquide"), o0 && o0.cash, c ? c.expected.cash : b.cash, c ? c.cash : null, S.seuils.cash) : t("Journée pas encore ouverte."),
    ...(b ? OPS().map((o) => line(o.name, o0 && o0.float[o.id], c ? (c.expected.float[o.id] || 0) : (b.float[o.id] || 0), c ? (c.float[o.id] || 0) : null, (S.seuils.float || {})[o.id])) : []),
    ...(c ? [] : b ? ["(" + t("journée pas encore clôturée : montants calculés par l'appli") + ")"] : []),
    "",
    t("Opérations") + " :",
    ...Object.entries(tot).filter(([, r]) => r.n).map(([op, r]) => `${opName(op)} : ${t("dépôts")} ${fmt(r.depot)}, ${t("retraits")} ${fmt(r.retrait)} (${r.n})`),
    "",
    `${t("Gain du jour")} : ${fmt(gainBetween(day, day))}`,
    `${t("Dépenses")} : ${fmt(expensesBetween(day, day))}`,
    ...(flagged.length ? ["", t("Opérations inhabituelles") + " :", ...flagged.map((o) => `- ${timeOf(o.t)} ${describe(o)} ${fmt(o.amount)} (${userName(o.user)})`)] : []),
    ...(S.ops.some((o) => o.day === day && o.cancelled) ? ["", t("Annulations : {n}", { n: S.ops.filter((o) => o.day === day && o.cancelled).length })] : []),
  ];
  return lines.join("\n");
}
// Envoi du rapport au propriétaire : son numéro WhatsApp, puis un lien wa.me avec le texte prêt
function reportBox(day) {
  return `<div class="card"><h2>${t("Rapport au propriétaire")}</h2>
    ${textInput("patron", phoneFmt(S.contacts.patron), t("Numéro WhatsApp du propriétaire"), 'type="tel" inputmode="tel" maxlength="14"')}
    <div class="two"><a class="btn" id="wa" href="${waLink(S.contacts.patron, dayReport(day))}" target="_blank" rel="noopener">${t("Envoyer par WhatsApp")}</a><button class="btn alt" id="cp" type="button">${t("Copier")}</button></div></div>`;
}
function wireReportBox(day) {
  const p = document.getElementById("patron");
  p.onchange = () => { S.contacts.patron = phoneClean(p.value); store.save(); document.getElementById("wa").href = waLink(S.contacts.patron, dayReport(day)); };
  document.getElementById("cp").onclick = () => copyText(dayReport(day));
}
function viewRapports() {
  if (needBoss(t("Les rapports sont réservés au patron."))) return;
  const m = monthOf(today()), prevM = monthOf(addDays(m + "-01", -1));
  $view.innerHTML = `<h1>${t("Rapports")}</h1>
    <div class="card"><h2>${t("Rapport du jour")}</h2>
      <pre class="report">${esc(dayReport(today()))}</pre></div>
    ${reportBox(today())}
    <div class="menu">
      <a class="menu-item" href="#mois/${m}"><b>${t("Rapport mensuel imprimable")}</b><span>${esc(monthName(m))} · <span class="link">${esc(monthName(prevM))}</span></span></a>
      <a class="menu-item" href="#microcredit"><b>${t("Bilan pour un micro-crédit")}</b><span>${t("Les 3 derniers mois, à montrer à la mutuelle ou à la banque")}</span></a>
      <a class="menu-item" href="#export"><b>${t("Export pour le comptable")}</b><span>${t("Fichier tableur (CSV) de toutes les opérations")}</span></a>
      <a class="menu-item" href="#depenses"><b>${t("Dépenses et notes de frais")}</b><span>${t("Loyer, électricité, salaires, transport")}</span></a>
      <a class="menu-item" href="#impots"><b>${t("Patente et impôts")}</b><span>${t("Repères simples")}</span></a>
    </div>`;
  wireReportBox(today());
}
function monthSummary(m) {
  const [from, to] = monthBounds(m), ops = opsBetween(from, to), mm = ops.filter((o) => o.kind === "mm");
  const byOp = {};
  for (const o of mm) { const r = (byOp[o.op] = byOp[o.op] || { depot: 0, retrait: 0, n: 0, com: 0 }); r[o.type] += o.amount; r.n++; r.com += o.commission || 0; }
  const daysOpen = Object.keys(S.days).filter((d) => d >= from && d <= to && S.days[d].open);
  const ecarts = daysOpen.filter((d) => S.days[d].close).map((d) => S.days[d].close.cash - S.days[d].close.expected.cash);
  return { from, to, byOp, n: mm.length, vol: sum(mm, (o) => o.amount), gain: gainBetween(from, to), dep: expensesBetween(from, to), daysOpen: daysOpen.length, ecart: sum(ecarts), services: sum(ops.filter((o) => o.kind === "service"), gainOf), ventes: sum(ops.filter((o) => o.kind === "vente"), gainOf) };
}
function viewMonth(arg) {
  const m = arg && /^\d{4}-\d\d$/.test(arg) ? arg : monthOf(today()), s = monthSummary(m);
  const prevM = monthOf(addDays(s.from, -1)), nextM = monthOf(addDays(s.to, 1));
  $view.innerHTML = `<div class="row daynav noprint"><a class="chip" href="#mois/${prevM}">‹</a><span></span>${nextM <= monthOf(today()) ? `<a class="chip" href="#mois/${nextM}">›</a>` : "<span></span>"}</div>
    <article class="print">
      <h1>${esc(S.kiosk || CFG.name)}</h1><p class="muted">${t("Rapport de {m}", { m: esc(monthName(m)) })}</p>
      <div class="table-wrap"><table class="tot"><thead><tr><th>${t("Opérateur")}</th><th>${t("Dépôts")}</th><th>${t("Retraits")}</th><th>${t("Nb")}</th><th>${t("Commission")}</th></tr></thead>
        <tbody>${Object.entries(s.byOp).map(([op, r]) => `<tr><th>${esc(opName(op))}</th><td>${fmt(r.depot)}</td><td>${fmt(r.retrait)}</td><td>${r.n}</td><td>${fmt(r.com)}</td></tr>`).join("")}</tbody>
        <tfoot><tr><th>${t("Total")}</th><td>${fmt(sum(Object.values(s.byOp), (r) => r.depot))}</td><td>${fmt(sum(Object.values(s.byOp), (r) => r.retrait))}</td><td>${s.n}</td><td>${fmt(sum(Object.values(s.byOp), (r) => r.com))}</td></tr></tfoot></table></div>
      <p class="row"><span>${t("Services")}</span><b>${fmt(s.services)}</b></p>
      <p class="row"><span>${t("Marge sur les ventes")}</span><b>${fmt(s.ventes)}</b></p>
      <p class="row"><span>${t("Gains totaux")}</span><b>${fmt(s.gain)}</b></p>
      <p class="row"><span>${t("Dépenses")}</span><b>${fmt(s.dep)}</b></p>
      <p class="row total"><span>${t("Bénéfice")}</span><b>${fmt(s.gain - s.dep)}</b></p>
      <p class="row"><span>${t("Jours ouverts")}</span><b>${s.daysOpen}</b></p>
      <p class="row"><span>${t("Écarts de caisse cumulés")}</span><b class="${s.ecart ? "bad" : "good"}">${fmtSigned(s.ecart)}</b></p>
      <p class="small muted">${t("Établi le {d} avec {app}.", { d: longDay(today()), app: CFG.name })}</p>
    </article>
    <button class="btn noprint" onclick="window.print()">${t("Imprimer ou enregistrer en PDF")}</button>`;
}
function viewMicrocredit() {
  const ms = [...new Set([monthOf(addDays(monthOf(today()) + "-01", -1)), monthOf(addDays(monthOf(today()) + "-01", -32)), monthOf(addDays(monthOf(today()) + "-01", -63))])].reverse();
  const rows = ms.map((m) => [m, monthSummary(m)]);
  const avg = (f) => Math.round(sum(rows, ([, s]) => f(s)) / rows.length);
  $view.innerHTML = `<article class="print">
    <h1>${t("Bilan d'activité")}</h1><p><b>${esc(S.kiosk || CFG.name)}</b></p>
    <p class="small muted">${t("Trois derniers mois complets, tirés du cahier de caisse.")}</p>
    <div class="table-wrap"><table class="tot"><thead><tr><th>${t("Mois")}</th><th>${t("Volume traité")}</th><th>${t("Gains")}</th><th>${t("Dépenses")}</th><th>${t("Bénéfice")}</th></tr></thead>
      <tbody>${rows.map(([m, s]) => `<tr><th>${esc(monthName(m))}</th><td>${fmt(s.vol)}</td><td>${fmt(s.gain)}</td><td>${fmt(s.dep)}</td><td>${fmt(s.gain - s.dep)}</td></tr>`).join("")}</tbody>
      <tfoot><tr><th>${t("Moyenne")}</th><td>${fmt(avg((s) => s.vol))}</td><td>${fmt(avg((s) => s.gain))}</td><td>${fmt(avg((s) => s.dep))}</td><td>${fmt(avg((s) => s.gain - s.dep))}</td></tr></tfoot></table></div>
    <p class="row"><span>${t("Liquide moyen à l'ouverture")}</span><b>${fmt(avgOpening())}</b></p>
    <p class="row"><span>${t("Jours ouverts")}</span><b>${sum(rows, ([, s]) => s.daysOpen)}</b></p>
    <p class="small muted">${t("Établi le {d} avec {app}. Chiffres saisis par l'agent.", { d: longDay(today()), app: CFG.name })}</p></article>
    <button class="btn noprint" onclick="window.print()">${t("Imprimer ou enregistrer en PDF")}</button>`;
}
const avgOpening = () => { const d = Object.values(S.days).filter((x) => x.open).slice(-90); return d.length ? sum(d, (x) => x.open.cash) / d.length : 0; };
function viewExport() {
  if (needBoss(t("L'export est réservé au patron."))) return;
  const head = ["date", "heure", "type", "detail", "operateur", "montant", "effet_liquide", "commission_ou_marge", "numero_client", "client", "employe", "statut"];
  const q = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const lines = S.ops.map((o) => [o.day, timeOf(o.t), o.kind === "mm" ? o.type : o.kind, describe(o), opName(o.op || o.floatOp || ""), o.amount, effect(o).cash, gainOf({ ...o, cancelled: false }), o.phone || "", o.client || "", userName(o.user), o.cancelled ? (o.correctedBy ? "corrigée" : "annulée") : "ok"].map(q).join(";"));
  $view.innerHTML = `<h1>${t("Export pour le comptable")}</h1>
    <div class="card"><p>${t("{n} lignes, de la première à la dernière opération. Le fichier s'ouvre dans Excel ou Google Sheets.", { n: S.ops.length })}</p>
    <button class="btn" id="dl">${t("Télécharger le fichier")}</button>
    <button class="btn alt" id="bk">${t("Sauvegarde complète du cahier")}</button>
    <label class="btn alt filebtn">${t("Restaurer une sauvegarde")}<input type="file" id="rs" accept=".json,application/json" hidden></label>
    <p class="small muted">${t("La sauvegarde complète permet de remettre le cahier sur un autre téléphone.")}</p></div>`;
  document.getElementById("dl").onclick = () => download(`operations-${today()}.csv`, [head.join(";"), ...lines].join("\n"));
  document.getElementById("bk").onclick = () => download(`cahier-${today()}.json`, JSON.stringify(S), "application/json");
  document.getElementById("rs").onchange = async (e) => {
    try { const data = JSON.parse(await e.target.files[0].text()); if (!Array.isArray(data.ops)) throw 0; S = Object.assign(DEFAULTS(), data); migrate(); store.save(); toast(t("Cahier restauré.")); go("accueil"); }
    catch { toast(t("Ce fichier n'est pas une sauvegarde du cahier.")); }
  };
}
function viewImpots() {
  $view.innerHTML = `<h1>${t("Patente et impôts")}</h1>
    <div class="card note"><p class="small">${t("Repères généraux seulement. Les montants dépendent de ta commune et de ta situation : renseigne-toi au centre des impôts de ton quartier ou auprès d'un comptable.")}</p></div>
    <div class="card"><ul class="steps">
      <li>${t("Un kiosque qui vend des services est une activité commerciale : il est en principe soumis à la contribution des patentes (ou à l'impôt qui la remplace pour les petites entreprises).")}</li>
      <li>${t("Les petites entreprises peuvent relever d'un régime simplifié, calculé sur le chiffre d'affaires. Demande lequel s'applique à toi.")}</li>
      <li>${t("Garde tes rapports mensuels et tes reçus de loyer : ils servent à justifier ton activité.")}</li>
      <li>${t("Note chaque paiement d'impôt comme dépense « Patente et impôts » pour voir ton vrai bénéfice.")}</li>
    </ul></div>
    <a class="btn" href="#autre/depense">${t("Noter un paiement")}</a>`;
}
