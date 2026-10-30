"use strict";
// plus.js : menu « Plus », employés, sécurité, clients, formation, outils, abonnement, réglages, démonstration.

function viewMore() {
  const boss = isBoss();
  const g = (title, items) => `<h2 class="group">${t(title)}</h2><div class="menu">${items.filter(Boolean).map(([h, l, d]) => `<a class="menu-item" href="#${h}"><b>${t(l)}</b><span>${t(d)}</span></a>`).join("")}</div>`;
  $view.innerHTML = `<h1>${t("Plus")}</h1>
    ${g("Argent", [["gains", "Mes gains", "Jour, semaine, mois, bénéfice, épargne"], boss && ["baremes", "Barèmes", "Commissions et frais client par opérateur"], ["float", "Float et liquide", "Seuils, prévision, recharges, prêts, heures de pointe"], ["depenses", "Dépenses", "Loyer, électricité, salaires, transport"]])}
    ${g("Kiosque", [boss && ["services", "Services", "Crédit, pass, factures, tickets, colis, photocopies"], boss && ["stock", "Produits et stock", "Cartes SIM, accessoires, épicerie"], ["clients", "Clients", "Habitués, fidélité, rendez-vous, réclamations, avis"], ["file", "File d'attente", "Tickets numérotés en heure de pointe"]])}
    ${g("Outils", [["calcul", "Calculatrice de frais", "Répondre vite au client"], ["affiche", "Affiche des tarifs", "À imprimer et coller au kiosque"], boss && ["rapports", "Rapports", "Jour, mois, export, micro-crédit, impôts"]])}
    ${g("Sécurité", [["securite", "Fiches anti-arnaque", "Faux SMS, erreur de transfert, faux agent, blanchiment"], ["alerte", "Alerte discrète", "Prévenir un proche en un geste"], boss && ["regles", "Règles et plafonds", "Pièce d'identité, plafonds, opérations inhabituelles, numéros suspects"], boss && ["journal-acces", "Qui a ouvert l'appli", "Journal des ouvertures et des actions"]])}
    ${g("Équipe", [boss && ["equipe", "Employés", "Codes, droits, salaires, avances, primes"], ["planning", "Planning", "Qui travaille quel jour"]])}
    ${g("Apprendre", [["cours", "Petit cours de gestion", "Float, trésorerie, marge"], ["quiz", "Quiz et badge", "Règles et arnaques : deviens « agent formé »"], ["fiches", "Fiches à garder", "Nouveaux services, règles du secteur, conseils aux clients"], ["demo", "Mode démonstration", "Essayer avec des exemples, former un nouvel agent"]])}
    ${g("Compte", [["abonnement", "Abonnement", paidLeft() > 0 ? "Actif" : trialLeft() > 0 ? "Essai en cours" : "Essai terminé"], ["parrainage", "Parrainer un agent", "Partager l'appli à un collègue"], ["aide", "Aide", "Guide d'utilisation et assistance WhatsApp"], boss && ["reglages", "Réglages", "Kiosque, opérateurs, horaires, langue"]])}
    <button class="btn alt" id="lockbtn">${anyPin() ? t("Verrouiller maintenant") : t("Mettre un code à l'appli")}</button>`;
  document.getElementById("lockbtn").onclick = () => (anyPin() ? lock() : go(isBoss() ? "equipe" : "accueil"));
}

// ---------- Employés : codes, droits, salaires, avances, primes
function viewTeam() {
  if (needBoss(t("Seul le patron gère les employés."))) return;
  const m = monthOf(today()), [from, to] = monthBounds(m);
  $view.innerHTML = `<h1>${t("Employés")}</h1>
    <p class="small muted">${t("Chaque personne a son code. Les opérations, les relèves de caisse et les écarts sont notés à son nom. Un employé ne peut ni annuler, ni corriger, ni changer les réglages.")}</p>
    ${S.users.map((u) => {
      const ops = opsBetween(from, to).filter((o) => o.user === u.id), com = sum(ops, gainOf);
      const advFor = sum(opsBetween(from, to).filter((o) => o.kind === "avance" && o.userId === u.id), (o) => o.amount);
      const ecarts = Object.entries(S.days).filter(([d]) => d >= from && d <= to).flatMap(([, d]) => [...(d.shifts || []).filter((s) => s.from === u.id).map((s) => s.ecart), ...(d.close && d.close.by === u.id && d.close.expected ? [d.close.cash - d.close.expected.cash] : [])]);
      return `<div class="card">
        <div class="row"><h2>${esc(u.name)}</h2><span class="pill">${u.role === "patron" ? t("Patron") : t("Employé")}</span></div>
        <p class="small">${t("Ce mois")} : ${t("{n} opération(s)", { n: ops.filter((o) => o.kind === "mm").length })} · ${t("gains générés")} <b>${fmt(com)}</b> · ${t("écarts")} <b class="${sum(ecarts) ? "bad" : "good"}">${fmtSigned(sum(ecarts))}</b></p>
        ${u.role !== "patron" ? `<p class="small">${t("Salaire")} : <b>${fmt(u.salary || 0)}</b> · ${t("Avances ce mois")} : <b>${fmt(advFor)}</b> · ${t("Prime ({p} % des gains)", { p: u.prime || 0 })} : <b>${fmt(Math.round((com * (u.prime || 0)) / 100))}</b><br>
          ${t("Reste à payer")} : <b>${fmt((u.salary || 0) + Math.round((com * (u.prime || 0)) / 100) - advFor)}</b></p>` : ""}
        <details class="more"><summary>${t("Modifier")}</summary>
          <div class="stack" data-u="${u.id}">
            ${textInput("n-" + u.id, u.name, t("Nom"), 'maxlength="30"')}
            ${u.role !== "patron" ? `<div class="two">${moneyInput("sal-" + u.id, u.salary, t("Salaire mensuel"))}${textInput("pr-" + u.id, u.prime || "", t("Prime en % des gains"), 'inputmode="decimal" maxlength="4"')}</div>` : ""}
            <div class="two"><input class="pin" id="p1-${u.id}" inputmode="numeric" maxlength="4" placeholder="${t("Nouveau code")}" autocomplete="off"><input class="pin" id="p2-${u.id}" inputmode="numeric" maxlength="4" placeholder="${t("Encore une fois")}" autocomplete="off"></div>
            <button class="btn alt" data-save="${u.id}">${t("Enregistrer")}</button>
            ${u.role !== "patron" ? `<div class="two">${moneyInput("av-" + u.id, "", t("Avance donnée"))}<button class="btn alt" data-adv="${u.id}">${t("Noter l'avance")}</button></div>
              <button class="link bad" data-del="${u.id}">${t("Retirer cet employé")}</button>` : u.pin ? `<button class="link" data-nopin="${u.id}">${t("Enlever le code")}</button>` : ""}
          </div></details></div>`; }).join("")}
    <form class="card" id="f"><h2>${t("Ajouter un employé")}</h2>
      ${textInput("name", "", t("Nom"), 'maxlength="30" required')}
      <div class="two"><input class="pin" id="np1" inputmode="numeric" maxlength="4" placeholder="${t("Code")}" autocomplete="off" required><input class="pin" id="np2" inputmode="numeric" maxlength="4" placeholder="${t("Encore une fois")}" autocomplete="off" required></div>
      ${!me().pin ? `<p class="small bad">${t("Mets d'abord un code au patron, sinon l'employé pourra ouvrir les réglages.")}</p>` : ""}
      <button class="btn" type="submit">${t("Ajouter")}</button></form>
    <div id="confirm"></div>`;
  wireMoney();
  const pinOf = async (a, b) => { if (!a && !b) return undefined; if (!/^\d{4}$/.test(a)) throw t("Le code doit avoir 4 chiffres."); if (a !== b) throw t("Les deux codes ne sont pas pareils."); return makePin(a); };
  $view.querySelectorAll("[data-save]").forEach((b) => b.onclick = async () => {
    const u = S.users.find((x) => x.id === b.dataset.save);
    try { const p = await pinOf(val("p1-" + u.id), val("p2-" + u.id)); if (p) u.pin = p; } catch (e) { return toast(e); }
    u.name = val("n-" + u.id).trim() || u.name;
    if (u.role !== "patron") { u.salary = num(val("sal-" + u.id)); u.prime = parseFloat(val("pr-" + u.id).replace(",", ".")) || 0; }
    store.save(); toast(t("Enregistré.")); viewTeam();
  });
  $view.querySelectorAll("[data-adv]").forEach((b) => b.onclick = () => {
    const n = num(val("av-" + b.dataset.adv)); if (!n) return;
    if (!balances(today()) || S.days[today()].close) return toast(t("Ouvre la journée pour noter une avance."));
    S.ops.push({ id: uid(), t: new Date().toISOString(), day: today(), kind: "avance", userId: b.dataset.adv, amount: n, user: ME }); store.save(); toast(t("Avance notée.")); viewTeam();
  });
  $view.querySelectorAll("[data-nopin]").forEach((b) => b.onclick = () => {
    if (S.users.length > 1) return toast(t("Avec des employés, le patron doit garder un code."));
    S.users.find((x) => x.id === b.dataset.nopin).pin = null; store.save(); viewTeam();
  });
  $view.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => confirmBox(document.getElementById("confirm"), t("Retirer {n} ? Ses opérations restent dans le cahier.", { n: esc(userName(b.dataset.del)) }), t("Oui, retirer"), () => {
    S.users = S.users.filter((u) => u.id !== b.dataset.del); store.save(); viewTeam();
  }));
  document.getElementById("f").onsubmit = async (e) => {
    e.preventDefault();
    let p; try { p = await pinOf(val("np1"), val("np2")); } catch (er) { return toast(er); }
    if (!p) return toast(t("Le code doit avoir 4 chiffres."));
    S.users.push({ id: uid(), name: val("name").trim(), role: "employe", pin: p, salary: 0, prime: 0 });
    logEvent("employé ajouté : " + val("name").trim()); store.save(); toast(t("Employé ajouté.")); viewTeam();
  };
}
function viewPlanning() {
  const ws = addDays(weekStart(today()), (viewPlanning.w || 0) * 7), days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(ws, i));
  const team = S.users;
  $view.innerHTML = `<div class="row daynav"><button class="chip" id="pw">‹</button><h1>${t("Semaine du {d}", { d: esc(shortDay(ws)) })}</h1><button class="chip" id="nw">›</button></div>
    <div class="table-wrap"><table class="tot plan"><thead><tr><th></th>${days.map((d) => `<th>${esc(shortDay(d).split(" ").slice(0, 2).join(" "))}</th>`).join("")}</tr></thead>
      <tbody>${team.map((u) => `<tr><th>${esc(u.name)}</th>${days.map((d) => { const on = (S.planning[d] || []).includes(u.id); return `<td><button class="cell ${on ? "on" : ""}" data-d="${d}" data-u="${u.id}" ${isBoss() ? "" : "disabled"} aria-pressed="${on}" aria-label="${esc(u.name)} ${esc(shortDay(d))}">${on ? "✓" : ""}</button></td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="small muted">${isBoss() ? t("Touche une case pour dire qui travaille ce jour-là.") : t("Seul le patron peut changer le planning.")}</p>
    <a class="btn alt" href="${waLink("", planningText(days))}" target="_blank" rel="noopener">${t("Envoyer le planning par WhatsApp")}</a>`;
  document.getElementById("pw").onclick = () => { viewPlanning.w = (viewPlanning.w || 0) - 1; viewPlanning(); };
  document.getElementById("nw").onclick = () => { viewPlanning.w = (viewPlanning.w || 0) + 1; viewPlanning(); };
  $view.querySelectorAll(".cell").forEach((c) => c.onclick = () => {
    const l = (S.planning[c.dataset.d] = S.planning[c.dataset.d] || []);
    const i = l.indexOf(c.dataset.u); if (i >= 0) l.splice(i, 1); else l.push(c.dataset.u);
    store.save(); viewPlanning();
  });
}
const planningText = (days) => [t("Planning {k}", { k: S.kiosk }), ...days.map((d) => `${shortDay(d)} : ${(S.planning[d] || []).map(userName).join(", ") || "—"}`)].join("\n");

// ---------- Sécurité
const FICHES = [
  ["Faux SMS de dépôt", ["Un client montre un SMS « Vous avez reçu 50 000 F » et demande du liquide.", "Le SMS peut être faux : il vient d'un numéro ordinaire, pas de l'opérateur.", "Vérifie toujours le solde dans ton appli ou ton menu d'agent avant de donner l'argent.", "Ne te laisse pas presser, même s'il y a la queue."]],
  ["« Erreur de transfert »", ["Quelqu'un appelle : « Je me suis trompé, je t'ai envoyé de l'argent, renvoie-le moi ».", "Souvent, rien n'a été envoyé, ou il veut que tu renvoies avant d'annuler de son côté.", "Vérifie ton solde. En cas de vraie erreur, passe par le service client de l'opérateur, jamais directement.", "Ne renvoie jamais d'argent à la demande d'un inconnu."]],
  ["Faux agent de l'opérateur", ["Une personne se dit « contrôleur » ou « technicien » de l'opérateur et demande ton code, ton téléphone ou une opération test.", "Un vrai agent de l'opérateur ne te demande jamais ton code secret.", "Appelle le service client (numéro dans Plus › Règles) pour vérifier.", "Ne laisse personne manipuler ton téléphone d'agent."]],
  ["Ne jamais donner son code secret", ["Ton code secret Wave, Orange Money, Free Money ou Wizall est à toi seul.", "Personne n'en a besoin : ni l'opérateur, ni le super-agent, ni un client, ni cette appli.", "Change-le si quelqu'un a pu le voir.", "Ne l'écris pas sur le téléphone ou sur le cahier."]],
  ["Argent liquide en fin de journée", ["Compte la caisse à l'abri des regards, pas devant le comptoir.", "Ne garde pas tout le liquide au kiosque la nuit.", "Change d'heure et de chemin pour aller déposer ou recharger.", "Ne dis pas combien tu as en caisse."]],
  ["Transporter le liquide", ["Sépare l'argent en plusieurs endroits sur toi.", "Fais-toi accompagner pour les grosses sommes.", "Évite les sacs voyants et les mêmes horaires chaque jour.", "Préviens un proche de ton trajet (bouton Alerte discrète)."]],
  ["Blanchiment : opérations à refuser", ["Un client fait beaucoup de petits dépôts pour éviter le plafond.", "Une personne dépose pour le compte d'autres sans raison claire.", "Un client refuse de montrer sa pièce pour un gros montant.", "En cas de doute, refuse poliment et préviens ton super-agent ou ton opérateur."]],
];
function viewSecurite() {
  $view.innerHTML = `<h1>${t("Fiches anti-arnaque")}</h1>
    <div class="card note"><p><b>${t("Rappel : ne donne jamais ton code secret.")}</b> ${t("Ni à un client, ni à un « agent de l'opérateur », ni à cette appli, qui ne te le demandera jamais.")}</p></div>
    ${FICHES.map(([titre, pts]) => `<details class="card fiche"><summary><b>${t(titre)}</b></summary><ul class="steps">${pts.map((p) => `<li>${t(p)}</li>`).join("")}</ul></details>`).join("")}
    <a class="btn alt" href="#quiz">${t("Tester mes connaissances")}</a>`;
}
function viewAlerte() {
  const c = S.contacts.alerte;
  const msg = t("Alerte de {k} : j'ai besoin d'aide au kiosque, appelle-moi ou viens vite.", { k: S.kiosk || "mon kiosque" });
  $view.innerHTML = `<h1>${t("Alerte discrète")}</h1>
    <p class="muted">${t("Un appui long sur le bouton envoie un message d'aide à ton proche, sans bruit.")}</p>
    ${textInput("alertphone", phoneFmt(c), t("Numéro du proche à prévenir"), 'type="tel" inputmode="tel" maxlength="14"')}
    <button class="btn alt" id="savealert">${t("Enregistrer")}</button>
    ${c ? `<button class="sos" id="sos">${t("Appui long pour alerter")}</button>
      <p class="small muted">${t("Le message part par SMS. Si le SMS ne s'ouvre pas, utilise WhatsApp :")} <a href="${waLink(c, msg)}" target="_blank" rel="noopener">WhatsApp</a></p>` : ""}`;
  document.getElementById("savealert").onclick = () => { S.contacts.alerte = phoneClean(val("alertphone")); store.save(); toast(t("Enregistré.")); viewAlerte(); };
  const sos = document.getElementById("sos");
  if (sos) {
    let timer;
    const fire = () => { location.href = `sms:+221${c}?body=${encodeURIComponent(msg)}`; logEvent("alerte discrète"); };
    sos.addEventListener("pointerdown", () => { sos.classList.add("hold"); timer = setTimeout(fire, 1200); });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => sos.addEventListener(ev, () => { sos.classList.remove("hold"); clearTimeout(timer); }));
  }
}
function viewRegles() {
  if (needBoss(t("Seul le patron change ces règles."))) return;
  $view.innerHTML = `<h1>${t("Règles et plafonds")}</h1>
    <form class="card" id="f">
      <p class="small muted">${t("Recopie les règles de tes opérateurs. L'appli t'avertit pendant la saisie.")}</p>
      ${moneyInput("idt", S.idThreshold, t("Pièce d'identité demandée à partir de"))}
      ${OPS().map((o) => moneyInput("pl-" + o.id, S.plafonds[o.id], t("Plafond par opération {op}", { op: o.name }))).join("")}
      ${moneyInput("unusual", S.unusual, t("Alerte au patron à partir de"))}
      <label class="check"><input type="checkbox" id="mask" ${S.mask ? "checked" : ""}> ${t("Masquer les numéros des clients à l'écran")}</label>
      <button class="btn" type="submit">${t("Enregistrer")}</button></form>
    <div class="card"><h2>${t("Service client des opérateurs")}</h2>
      ${OPS().map((o) => textInput("sc-" + o.id, (S.contacts.service || {})[o.id], o.name, 'inputmode="tel" maxlength="20"')).join("")}
      <button class="btn alt" id="savesc">${t("Enregistrer")}</button>
      ${OPS().filter((o) => (S.contacts.service || {})[o.id]).map((o) => `<p class="row small"><span>${esc(o.name)}</span><b class="copy">${esc(S.contacts.service[o.id])}</b></p>`).join("")}</div>
    <div class="card"><h2>${t("Numéros suspects")}</h2>
      <p class="small muted">${t("Ta liste à toi : l'appli t'avertit si un de ces numéros revient. Note seulement des faits (tentative d'arnaque constatée).")}</p>
      ${(S.suspects || []).map((s) => `<p class="row small"><span>${esc(phoneFmt(s.phone))} · ${esc(s.why)}</span><button class="link" data-sus="${s.phone}">${t("Retirer")}</button></p>`).join("")}
      <div class="two">${textInput("sp", "", t("Numéro"), 'type="tel" inputmode="tel" maxlength="14"')}${textInput("sw", "", t("Ce qui s'est passé"), 'maxlength="60"')}</div>
      <button class="btn alt" id="addsus">${t("Ajouter")}</button></div>`;
  wireMoney();
  document.getElementById("f").onsubmit = (e) => {
    e.preventDefault();
    S.idThreshold = num(val("idt")); S.unusual = num(val("unusual")); S.mask = document.getElementById("mask").checked;
    S.plafonds = Object.fromEntries(OPS().map((o) => [o.id, num(val("pl-" + o.id))]));
    store.save(); toast(t("Enregistré."));
  };
  document.getElementById("savesc").onclick = () => { S.contacts.service = Object.fromEntries(OPS().map((o) => [o.id, val("sc-" + o.id).trim()])); store.save(); viewRegles(); };
  document.getElementById("addsus").onclick = () => { const p = phoneClean(val("sp")); if (p.length !== 9) return toast(t("Numéro à 9 chiffres.")); (S.suspects = S.suspects || []).push({ phone: p, why: val("sw").trim(), day: today() }); store.save(); viewRegles(); };
  $view.querySelectorAll("[data-sus]").forEach((b) => b.onclick = () => { S.suspects = S.suspects.filter((s) => s.phone !== b.dataset.sus); store.save(); viewRegles(); });
}
function viewAccessLog() {
  if (needBoss(t("Réservé au patron."))) return;
  $view.innerHTML = `<h1>${t("Qui a ouvert l'appli")}</h1><div class="card"><ul class="ops">
    ${S.log.slice().reverse().slice(0, 150).map((l) => `<li class="op"><span class="time">${timeOf(l.t)}</span><span class="what">${esc(l.ev)}<br><span class="small muted">${esc(shortDay(dayOf(new Date(l.t))))} · ${esc(userName(l.user))}</span></span><span></span></li>`).join("") || `<li class="muted">${t("Rien pour l'instant.")}</li>`}</ul></div>`;
}

// ---------- Clients
function viewClients() {
  const counts = {};
  for (const o of S.ops) if (o.phone && !o.cancelled) counts[o.phone] = (counts[o.phone] || 0) + 1;
  const every = S.loyalty || 20;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  $view.innerHTML = `<h1>${t("Clients")}</h1>
    <div class="card"><h2>${t("Clients habituels")}</h2>
      ${S.clients.map((c) => `<p class="row"><span><b>${esc(c.name)}</b><br><span class="small muted">${esc(phoneShow(c.phone))} · ${t("{n} passage(s)", { n: counts[c.phone] || 0 })}</span></span><span><a class="link" href="#journal/q=${c.phone}">${t("Historique")}</a> <button class="link" data-del="${c.id}">${t("Retirer")}</button></span></p>`).join("") || `<p class="small muted">${t("Enregistre tes habitués : leur nom apparaît pendant la saisie.")}</p>`}
      <div class="two">${textInput("cn", "", t("Nom"), 'maxlength="30"')}${textInput("cp", "", t("Numéro"), 'type="tel" inputmode="tel" maxlength="14"')}</div>
      <button class="btn alt" id="addc">${t("Ajouter")}</button></div>
    <div class="card"><h2>${t("Fidélité")}</h2>
      <p class="small muted">${t("Un cadeau tous les {n} passages. L'appli te le rappelle pendant la saisie.", { n: every })}</p>
      ${top.map(([p, n]) => { const c = S.clients.find((x) => x.phone === p); return `<p class="row small"><span>${esc(c ? c.name : phoneShow(p))}</span><b>${n} · ${t("cadeau dans {k}", { k: every - (n % every) })}</b></p>`; }).join("") || `<p class="small muted">${t("Pas encore de passages avec numéro.")}</p>`}
      ${isBoss() ? `<div class="two">${textInput("loy", every, t("Cadeau tous les"), 'inputmode="numeric" maxlength="3"')}<button class="btn alt" id="saveloy">${t("Enregistrer")}</button></div>` : ""}</div>
    ${listCard("rdv", "Service à domicile (rendez-vous)", "Pour les personnes âgées ou malades.", [["date", "Date", "date"], ["client", "Client"], ["lieu", "Adresse"], ["note", "Opération et montant"]])}
    ${listCard("reclamations", "Réclamations des clients", "Note la plainte et suis-la jusqu'à la solution.", [["client", "Client"], ["note", "Problème"]])}
    ${listCard("avis", "Avis des clients", "Ce que les clients disent du kiosque.", [["client", "Client"], ["note", "Avis"]])}`;
  document.getElementById("addc").onclick = () => {
    const p = phoneClean(val("cp")); if (!val("cn").trim() || p.length !== 9) return toast(t("Écris le nom et un numéro à 9 chiffres."));
    S.clients = S.clients.filter((c) => c.phone !== p); S.clients.push({ id: uid(), name: val("cn").trim(), phone: p }); store.save(); viewClients();
  };
  $view.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => { S.clients = S.clients.filter((c) => c.id !== b.dataset.del); store.save(); viewClients(); });
  const sl = document.getElementById("saveloy"); if (sl) sl.onclick = () => { S.loyalty = Math.max(2, num(val("loy"))); store.save(); viewClients(); };
  wireLists(viewClients);
}
// Petites listes (rendez-vous, réclamations, avis) : ajout, « fait », retrait
function listCard(key, title, hint, fields) {
  const items = S[key] || [];
  return `<div class="card"><h2>${t(title)}</h2><p class="small muted">${t(hint)}</p>
    ${items.slice().reverse().map((it) => `<div class="row small ${it.done ? "done" : ""}"><span>${fields.map(([f]) => esc(f === "date" ? shortDay(it[f]) : it[f])).filter(Boolean).join(" · ")}</span>
      <span>${!it.done ? `<button class="link" data-done="${key}:${it.id}">${key === "reclamations" ? t("Réglée") : t("Fait")}</button>` : `<span class="good">✓</span>`} <button class="link" data-rm="${key}:${it.id}">${t("Retirer")}</button></span></div>`).join("")}
    <div class="stack">${fields.map(([f, l, type]) => `<input id="${key}-${f}" ${type ? `type="${type}"` : 'maxlength="80"'} placeholder="${t(l)}" aria-label="${t(l)}" autocomplete="off">`).join("")}</div>
    <button class="btn alt" data-add="${key}" data-fields="${fields.map(([f]) => f).join(",")}">${t("Ajouter")}</button></div>`;
}
function wireLists(again) {
  $view.querySelectorAll("[data-add]").forEach((b) => b.onclick = () => {
    const k = b.dataset.add, it = { id: uid(), day: today() };
    for (const f of b.dataset.fields.split(",")) it[f] = val(`${k}-${f}`).trim();
    if (!Object.values(it).some((v, i) => i > 1 && v)) return;
    (S[k] = S[k] || []).push(it); store.save(); again();
  });
  $view.querySelectorAll("[data-done]").forEach((b) => b.onclick = () => { const [k, id] = b.dataset.done.split(":"); S[k].find((x) => x.id === id).done = today(); store.save(); again(); });
  $view.querySelectorAll("[data-rm]").forEach((b) => b.onclick = () => { const [k, id] = b.dataset.rm.split(":"); S[k] = S[k].filter((x) => x.id !== id); store.save(); again(); });
}
// File d'attente : tickets numérotés, grand affichage
function viewQueue() {
  const q = (S.queue = S.queue && S.queue.day === today() ? S.queue : { day: today(), last: 0, now: 0 });
  $view.innerHTML = `<div class="queue">
    <p class="muted">${t("Client servi")}</p><b class="qnow">${q.now || "—"}</b>
    <p class="muted">${t("{n} personne(s) en attente", { n: Math.max(0, q.last - q.now) })}</p>
    <div class="two"><button class="btn" id="next">${t("Client suivant")}</button><button class="btn alt" id="ticket">${t("Nouveau ticket")} (${q.last + 1})</button></div>
    <button class="link" id="reset">${t("Remettre à zéro")}</button></div>`;
  document.getElementById("next").onclick = () => { if (q.now < q.last) q.now++; store.save(); viewQueue(); };
  document.getElementById("ticket").onclick = () => { q.last++; store.save(); toast(t("Ticket n° {n}", { n: q.last })); viewQueue(); };
  document.getElementById("reset").onclick = () => { S.queue = { day: today(), last: 0, now: 0 }; store.save(); viewQueue(); };
}

// ---------- Outils : calculatrice de frais et affiche des tarifs
function viewCalc() {
  const ops = OPS();
  $view.innerHTML = `<h1>${t("Calculatrice de frais")}</h1>
    <div class="seg" id="ct"><button type="button" data-t="depot" aria-pressed="false">${t("Dépôt")}</button><button type="button" data-t="retrait" aria-pressed="true">${t("Retrait")}</button></div>
    <label class="field amount-field"><span>${t("Montant")}</span><input id="amount" inputmode="numeric" data-money placeholder="0" autocomplete="off"><b class="unit">F</b></label>
    <div class="card" id="res"></div>
    <p class="small muted">${t("Les frais viennent de la grille que tu as saisie dans Barèmes › Frais client.")}</p>`;
  wireMoney();
  let type = "retrait";
  const show = () => {
    const n = num(val("amount"));
    $view.querySelectorAll("[data-t]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.t === type));
    document.getElementById("res").innerHTML = ops.map((o) => { const f = feeOf(o.id, type, n), has = ((S.fees[o.id] || {})[type] || []).length;
      return `<p class="row"><span>${esc(o.name)}</span>${has ? `<span><b>${fmt(f)}</b> <span class="small muted">· ${type === "retrait" ? t("total à envoyer {m}", { m: fmt(n + f) }) : t("reçu {m}", { m: fmt(n) })}</span></span>` : `<a class="small" href="#baremes/fees">${t("Grille à saisir")}</a>`}</p>`; }).join("");
  };
  document.getElementById("amount").addEventListener("input", show);
  $view.querySelectorAll("[data-t]").forEach((b) => b.onclick = () => { type = b.dataset.t; show(); });
  show();
}
function viewAffiche() {
  const amounts = [5000, 10000, 20000, 50000, 100000, 200000];
  const ops = OPS().filter((o) => ["depot", "retrait"].some((k) => ((S.fees[o.id] || {})[k] || []).length));
  $view.innerHTML = `<article class="print poster">
    <span class="mark big" aria-hidden="true">SM</span>
    <h1>${esc(S.kiosk || t("Mon kiosque"))}</h1>
    <p>${t("Dépôts et retraits")} : ${OPS().map((o) => esc(o.name)).join(" · ")}</p>
    ${S.hours ? `<p><b>${t("Horaires")}</b> : ${esc(S.hours)}</p>` : ""}
    ${ops.length ? `<div class="table-wrap"><table class="tot"><thead><tr><th>${t("Retrait de")}</th>${ops.map((o) => `<th>${esc(o.name)}</th>`).join("")}</tr></thead>
      <tbody>${amounts.map((a) => `<tr><th>${fmt(a)}</th>${ops.map((o) => `<td>${fmt(feeOf(o.id, "retrait", a))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="small">${t("Frais indiqués par l'opérateur, payés par le client.")}</p>` : `<p class="muted noprint">${t("Saisis les frais client dans")} <a href="#baremes/fees">${t("Barèmes")}</a> ${t("pour afficher le tableau.")}</p>`}
    <p><b>${t("Nous ne demandons jamais votre code secret.")}</b></p></article>
    <button class="btn noprint" onclick="window.print()">${t("Imprimer ou enregistrer en PDF")}</button>`;
}

// ---------- Formation
const COURS = [
  ["Le float, c'est quoi ?", "Le float est l'argent électronique sur ton compte d'agent chez chaque opérateur. Quand un client dépose, ton float baisse et ton liquide monte. Quand il retire, c'est l'inverse. Ton argent total (liquide + float) ne bouge presque pas : seule la commission s'ajoute."],
  ["La trésorerie", "Ta trésorerie, c'est ce que tu as pour servir les clients : liquide et float. Si l'un des deux est vide, tu perds des clients. Regarde ta prévision le matin, recharge avant d'être à zéro, et note les retraits annoncés."],
  ["La marge", "Ta marge, c'est ce que tu gagnes vraiment : commissions + marges des ventes, moins les dépenses (loyer, électricité, salaire, transport pour recharger). Un gros volume ne veut pas dire un gros bénéfice : compare les opérateurs dans « Mes gains »."],
  ["Bien clôturer", "Chaque soir, compte le liquide et note tes soldes. Un petit écart expliqué tout de suite évite une grosse perte à la fin du mois. Regarde la liste « écart expliqué » : doublons, montant inversé, opération oubliée."],
];
const CONSEILS_CLIENTS = [
  ["Garder son code pour soi", "Personne, même l'agent, n'a besoin de votre code secret."],
  ["Vérifier le numéro", "Relisez le numéro avant d'envoyer : une erreur est difficile à rattraper."],
  ["Épargner un peu", "Laisser une petite somme sur son compte chaque semaine aide pour les imprévus."],
  ["Garder les reçus", "Le reçu WhatsApp ou le SMS de l'opérateur sert en cas de problème."],
];
function viewCours() {
  $view.innerHTML = `<h1>${t("Petit cours de gestion")}</h1>
    ${COURS.map(([h, p]) => `<details class="card fiche"><summary><b>${t(h)}</b></summary><p>${t(p)}</p></details>`).join("")}
    <h2 class="group">${t("Conseils à expliquer aux clients")}</h2>
    ${CONSEILS_CLIENTS.map(([h, p]) => `<div class="card"><b>${t(h)}</b><p class="small">${t(p)}</p></div>`).join("")}`;
}
const QUIZ = [
  ["Un client montre un SMS de dépôt de 50 000 F. Que fais-tu ?", ["Je donne le liquide tout de suite", "Je vérifie mon solde avant de payer", "Je lui demande son code secret"], 1],
  ["Un « agent de l'opérateur » demande ton code secret pour une vérification.", ["Je le donne, c'est l'opérateur", "Je refuse et j'appelle le service client", "Je donne seulement les 2 premiers chiffres"], 1],
  ["Quelqu'un appelle : « Je t'ai envoyé de l'argent par erreur, renvoie-le ».", ["Je renvoie vite", "Je vérifie mon solde et je passe par le service client", "Je renvoie la moitié"], 1],
  ["Un client dépose : que devient ton float ?", ["Il baisse", "Il monte", "Il ne bouge pas"], 0],
  ["Un client retire : que devient ton liquide ?", ["Il monte", "Il baisse", "Il ne bouge pas"], 1],
  ["Ta caisse a 2 000 F de moins que prévu. Que regardes-tu d'abord ?", ["Les opérations de 2 000 F ou 1 000 F (sens inversé)", "Rien, ce n'est pas grave", "Je recommence la journée"], 0],
  ["Un client fait 5 petits dépôts de suite pour éviter le plafond.", ["C'est normal", "C'est un signe de blanchiment : je refuse poliment", "Je l'aide à en faire plus"], 1],
  ["Ton bénéfice réel, c'est…", ["Le total des dépôts", "Les commissions et marges moins les dépenses", "Le liquide en caisse"], 1],
  ["Fin de journée : où compter la caisse ?", ["Devant le comptoir", "À l'abri des regards", "Dans la rue"], 1],
  ["Pour un gros retrait annoncé demain, tu…", ["Le notes et prévois le liquide", "Attends demain pour voir", "Refuses"], 0],
];
function viewQuiz() {
  let i = 0, score = 0;
  const step = () => {
    if (i >= QUIZ.length) {
      const pass = score >= 8;
      S.quiz = { best: Math.max(score, S.quiz.best || 0), badge: S.quiz.badge || (pass ? today() : null), last: today() };
      store.save();
      $view.innerHTML = `<div class="card"><h1>${t("{s} / {n}", { s: score, n: QUIZ.length })}</h1>
        ${S.quiz.badge ? `<p class="badge">${t("Agent formé")}</p><p class="small muted">${t("Badge obtenu le {d}.", { d: esc(longDay(S.quiz.badge)) })}</p>` : `<p>${t("Il faut 8 bonnes réponses pour le badge « agent formé ». Relis les fiches et réessaie.")}</p>`}
        <p class="small muted">${t("Reviens chaque mois : le quiz garde ton meilleur score.")}</p>
        <a class="btn" href="#securite">${t("Relire les fiches")}</a><button class="btn alt" id="again">${t("Recommencer")}</button></div>`;
      document.getElementById("again").onclick = viewQuiz;
      return;
    }
    const [q, ch, a] = QUIZ[i];
    $view.innerHTML = `<p class="small muted">${t("Question {i} / {n}", { i: i + 1, n: QUIZ.length })}${S.quiz.badge ? " · " + t("Agent formé") : ""}</p>
      <h2>${t(q)}</h2><div class="stack">${ch.map((c, k) => `<button class="btn alt choice" data-k="${k}">${t(c)}</button>`).join("")}</div><p id="fb"></p>`;
    $view.querySelectorAll("[data-k]").forEach((b) => b.onclick = () => {
      const ok = +b.dataset.k === a; if (ok) score++;
      $view.querySelectorAll("[data-k]").forEach((x) => { x.disabled = true; if (+x.dataset.k === a) x.classList.add("right"); });
      if (!ok) b.classList.add("wrong");
      document.getElementById("fb").innerHTML = `<button class="btn" id="nx">${t("Suivant")}</button>`;
      document.getElementById("nx").onclick = () => { i++; step(); };
    });
  };
  step();
}
function viewFiches() {
  $view.innerHTML = `<h1>${t("Fiches à garder")}</h1>
    <p class="small muted">${t("Note ici les nouveaux services des opérateurs, les nouvelles règles du secteur (BCEAO, opérateurs) et tout ce que tu veux retrouver vite.")}</p>
    ${listCard("fiches", "Mes fiches", "Titre et contenu.", [["titre", "Titre"], ["note", "Contenu"]])}`;
  wireLists(viewFiches);
}

// ---------- Abonnement : mois ou année, payé par Wave ou Orange Money, puis code reçu
function viewSub(reason = "", pay = "wave") {
  const number = pay === "om" ? CFG.om_number : CFG.wave_number;
  const msg = t("Bonjour, j'ai payé l'abonnement {app} du kiosque « {k} » par {via}. Voici ma capture :", { app: CFG.name, via: pay === "om" ? "Orange Money" : "Wave", k: S.kiosk });
  $view.innerHTML = `<h1>${t("Abonnement")}</h1>
    ${reason ? `<p><b>${esc(reason)}</b></p>` : ""}
    <div class="card">
      ${paidLeft() > 0 ? `<p class="good"><b>${t("Abonnement actif jusqu'au {d}.", { d: esc(longDay(S.paidUntil)) })}</b></p>`
        : trialLeft() > 0 ? `<p>${t("Essai gratuit en cours : encore {n} jour(s) avec tout débloqué.", { n: trialLeft() })}</p>`
        : `<p>${t("Ton essai de {n} jours est terminé. Sans abonnement : {f} opérations par jour.", { n: CFG.trial_days, f: CFG.free_ops_per_day })}</p>`}
      <div class="prices">
        <div><b>${fmt(CFG.price_fcfa)}</b><span>${t("par mois")}</span></div>
        <div><b>${fmt(CFG.price_year)}</b><span>${t("par an")}</span></div>
        <div><b>${fmt(CFG.price_multi)}</b><span>${t("par mois et par kiosque, à partir de {n} kiosques", { n: CFG.multi_from })}</span></div>
      </div>
      <ul class="steps"><li>${t("Opérations sans limite")}</li><li>${t("Commissions, gains, rapports et employés")}</li><li>${t("Les nouveautés ajoutées chaque mois")}</li></ul>
    </div>
    <div class="card"><h2>${t("Comment payer")}</h2>
      <div class="seg"><button type="button" data-pay="wave" aria-pressed="${pay === "wave"}">Wave</button><button type="button" data-pay="om" aria-pressed="${pay === "om"}">Orange Money</button></div>
      <ol class="steps">
        <li>${t("Envoie le montant par {via} au", { via: pay === "om" ? "Orange Money" : "Wave" })} <b class="copy">${esc(number)}</b> <button class="link" type="button" id="copy">${t("Copier")}</button></li>
        <li>${t("Envoie la capture du paiement par WhatsApp au même numéro.")}</li>
        <li>${t("Tu reçois ton code d'abonnement. Entre-le ci-dessous.")}</li>
      </ol>
      <a class="btn alt" href="${waLink(CFG.whatsapp.slice(3), msg)}" target="_blank" rel="noopener">${t("Envoyer la capture sur WhatsApp")}</a>
      <p class="small muted">${t("Ce paiement concerne seulement l'abonnement à l'appli. L'appli ne fait aucun transfert pour tes clients.")}</p>
    </div>
    <div class="card"><h2>${t("J'ai un code")}</h2>
      <input class="code" id="code" placeholder="XXXXX-XXXXXX" autocomplete="off" maxlength="13">
      <button class="btn" id="unlock">${t("Activer")}</button><p id="codemsg" class="small"></p></div>`;
  $view.querySelectorAll("[data-pay]").forEach((b) => b.onclick = () => viewSub(reason, b.dataset.pay));
  document.getElementById("copy").onclick = () => copyText(number.replace(/\s/g, ""));
  document.getElementById("unlock").onclick = async () => {
    const raw = document.getElementById("code").value.trim().toUpperCase().replace(/\s/g, "");
    const code = raw.length === 11 && !raw.includes("-") ? raw.slice(0, 5) + "-" + raw.slice(5) : raw;
    const m = document.getElementById("codemsg"), h = await sha256(CFG.salt + code);
    const days = S.usedCodes.includes(code) ? 0 : CFG.codes.includes(h) ? CFG.sub_days : (CFG.codes_year || []).includes(h) ? 365 : 0;
    if (!days) { m.className = "msg-ko"; m.textContent = t("Code inconnu ou déjà utilisé. Vérifie les lettres et les chiffres."); return; }
    const from = S.paidUntil && S.paidUntil >= today() ? addDays(S.paidUntil, 1) : today();
    S.paidUntil = addDays(from, days - 1); S.usedCodes.push(code); store.save();
    m.className = "msg-ok"; m.textContent = t("Code accepté : abonnement actif jusqu'au {d}.", { d: longDay(S.paidUntil) });
    setTimeout(() => { if (location.hash === "#abonnement") viewSub(); }, 1400);
  };
}
function viewParrainage() {
  const url = location.href.split("#")[0];
  const text = t("J'utilise {app} pour tenir la caisse de mon kiosque : dépôts, retraits, liquide, commissions et clôture du soir. 10 jours gratuits, sans connexion. Essaie : {u}", { app: CFG.name, u: url });
  $view.innerHTML = `<h1>${t("Parrainer un agent")}</h1>
    <div class="card"><p>${t("Partage l'appli avec un agent de ton quartier. Dis-lui de donner le nom de ton kiosque quand il s'abonne.")}</p>
    <pre class="report">${esc(text)}</pre>
    <a class="btn" href="${waLink("", text)}" target="_blank" rel="noopener">${t("Partager sur WhatsApp")}</a><button class="btn alt" id="cp">${t("Copier")}</button></div>`;
  document.getElementById("cp").onclick = () => copyText(text);
}
function viewAide() {
  const steps = [
    ["Le matin", "Ouvre la journée : compte le liquide et note le solde de chaque opérateur."],
    ["À chaque client", "Appuie sur Dépôt ou Retrait, choisis l'opérateur, écris le montant. Le numéro du client est facultatif mais aide à vérifier et à envoyer un reçu."],
    ["Autres ventes", "Crédit, factures, produits, recharges de float, dépenses : bouton « Autre… » sur la caisse."],
    ["Le soir", "Clôture : compte le liquide, note les soldes réels. L'appli montre l'écart et les opérations à vérifier."],
    ["Une erreur ?", "Dans le Journal, le patron peut annuler ou corriger : l'ancienne ligne reste barrée, rien ne s'efface."],
  ];
  $view.innerHTML = `<h1>${t("Aide")}</h1>
    <div class="card"><h2>${t("Guide en 5 étapes")}</h2><ol class="steps">${steps.map(([h, p]) => `<li><b>${t(h)}</b> : ${t(p)}</li>`).join("")}</ol></div>
    <a class="card linkcard" href="#demo"><b>${t("Essayer en mode démonstration")}</b><span class="small muted">${t("Des exemples pour apprendre sans toucher à ton cahier.")}</span></a>
    <div class="card"><h2>${t("Assistance")}</h2><p class="small">${t("Une question, un problème ? Écris-nous sur WhatsApp au")} <b class="copy">${esc(CFG.wave_number)}</b>.</p>
      <a class="btn" href="${waLink(CFG.whatsapp.slice(3), t("Bonjour, j'ai une question sur {app} :", { app: CFG.name }))}" target="_blank" rel="noopener">${t("Écrire sur WhatsApp")}</a></div>
    <div class="card note"><p class="small">${t("L'appli ne fait aucun transfert et ne te demandera jamais ton code secret d'opérateur.")}</p></div>`;
}

// ---------- Réglages
function viewSettings() {
  if (needBoss(t("Seul le patron change les réglages."))) return;
  $view.innerHTML = `<h1>${t("Réglages")}</h1>
    <form class="card" id="fk">
      ${textInput("kiosk", S.kiosk, t("Nom du kiosque"), 'maxlength="40"')}
      <fieldset class="field"><legend>${t("Opérateurs que tu proposes")}</legend>
        <div class="checks">${CFG.operators.map((o) => `<label class="check"><input type="checkbox" name="op" value="${o.id}" ${S.operators.includes(o.id) ? "checked" : ""}> ${esc(o.name)}</label>`).join("")}</div></fieldset>
      ${textInput("hours", S.hours, t("Horaires d'ouverture"), 'maxlength="60" placeholder="Lun–Sam 8 h – 21 h"')}
      <label class="field"><span>${t("Rappel de clôture à")}</span><input id="closeat" type="time" value="${esc(S.closeAt || "")}"></label>
      <button class="btn" type="submit">${t("Enregistrer")}</button></form>
    ${"Notification" in window && Notification.permission === "default" ? `<button class="btn alt" id="notif">${t("Autoriser les rappels (notifications)")}</button>` : ""}
    ${woReady() ? `<div class="card"><h2>${t("Langue")}</h2><div class="seg">${Object.entries(LANGS).map(([k, v]) => `<button type="button" data-lang="${k}" aria-pressed="${LANG === k}">${v}</button>`).join("")}</div></div>` : ""}
    <a class="card linkcard" href="#equipe"><b>${t("Codes et employés")}</b><span class="small muted">${anyPin() ? t("L'appli se verrouille à l'ouverture et après 1 minute hors de l'écran.") : t("Aucun code : n'importe qui peut ouvrir ton cahier.")}</span></a>
    <a class="card linkcard" href="#export"><b>${t("Sauvegarde")}</b><span class="small muted">${Sync.enabled ? t("Sauvegarde en ligne active.") : t("Le cahier est gardé sur ce téléphone. Fais une sauvegarde de temps en temps.")}</span></a>
    <div class="card"><h2>${t("Effacer le cahier")}</h2><p class="small muted">${t("Supprime toutes les opérations de ce téléphone. Écris EFFACER pour confirmer.")}</p>
      <input id="wipe" autocomplete="off" placeholder="EFFACER"><button class="btn danger" id="wipebtn">${t("Tout effacer")}</button></div>`;
  document.getElementById("fk").onsubmit = (e) => {
    e.preventDefault();
    const ops = [...$view.querySelectorAll("input[name=op]:checked")].map((i) => i.value);
    if (!ops.length) return toast(t("Coche au moins un opérateur."));
    Object.assign(S, { kiosk: val("kiosk").trim(), operators: ops, hours: val("hours").trim(), closeAt: val("closeat") });
    store.save(); paintTop(); toast(t("Enregistré."));
  };
  const nb = document.getElementById("notif"); if (nb) nb.onclick = () => Notification.requestPermission().then(() => viewSettings());
  $view.querySelectorAll("[data-lang]").forEach((b) => b.onclick = () => { setLang(b.dataset.lang); render(); });
  document.getElementById("wipebtn").onclick = () => {
    if (val("wipe").trim().toUpperCase() !== "EFFACER") return toast(t("Écris EFFACER pour confirmer."));
    // l'essai et l'abonnement restent : effacer le cahier ne relance pas l'essai
    const keep = { trialStart: S.trialStart, paidUntil: S.paidUntil, usedCodes: S.usedCodes };
    S = Object.assign(DEFAULTS(), keep); migrate(); store.save(); location.hash = ""; render();
  };
}

// ---------- Première ouverture
function viewSetup() {
  document.body.classList.add("bare");
  $view.innerHTML = `<div class="hero">
      <span class="mark big" aria-hidden="true">SM</span>
      <h1>${t("Bienvenue dans {app}", { app: esc(CFG.name) })}</h1>
      <p class="muted">${t("Le cahier de caisse de ton kiosque : tu notes tes dépôts et retraits, l'appli calcule ton liquide, tes soldes et tes gains.")}</p>
    </div>
    <div class="card note"><p><b>${t("L'appli ne fait aucun transfert.")}</b> ${t("Elle n'est pas reliée à Wave, Orange Money ou aux autres. Elle ne te demandera jamais ton code secret d'opérateur.")}</p></div>
    <form class="card" id="f">
      ${textInput("kiosk", "", t("Nom du kiosque"), `maxlength="40" required placeholder="${t("Ex. Kiosque Médina")}"`)}
      ${textInput("boss", "", t("Ton prénom"), 'maxlength="30"')}
      <fieldset class="field"><legend>${t("Opérateurs que tu proposes")}</legend>
        <div class="checks">${CFG.operators.map((o) => `<label class="check"><input type="checkbox" name="op" value="${o.id}" ${o.id === "wave" || o.id === "om" ? "checked" : ""}> ${esc(o.name)}</label>`).join("")}</div></fieldset>
      <fieldset class="field"><legend>${t("Code de l'appli (4 chiffres)")}</legend>
        <p class="small muted">${t("Il protège ton cahier si quelqu'un prend ton téléphone. Choisis un code différent de tes codes Wave ou Orange Money.")}</p>
        <div class="two"><input id="pin1" inputmode="numeric" maxlength="4" placeholder="${t("Code")}" autocomplete="off" class="pin"><input id="pin2" inputmode="numeric" maxlength="4" placeholder="${t("Encore une fois")}" autocomplete="off" class="pin"></div></fieldset>
      <p class="msg-ko" id="err" hidden></p>
      <button class="btn" type="submit">${t("Commencer")}</button>
    </form>
    <a class="btn alt" href="#demo">${t("Voir d'abord une démonstration")}</a>`;
  document.getElementById("f").onsubmit = async (e) => {
    e.preventDefault();
    const err = document.getElementById("err"), fail = (m) => { err.textContent = m; err.hidden = false; };
    const ops = [...$view.querySelectorAll("input[name=op]:checked")].map((i) => i.value);
    const p1 = val("pin1"), p2 = val("pin2");
    if (!ops.length) return fail(t("Coche au moins un opérateur."));
    if (p1 || p2) { if (!/^\d{4}$/.test(p1)) return fail(t("Le code doit avoir 4 chiffres.")); if (p1 !== p2) return fail(t("Les deux codes ne sont pas pareils.")); }
    S.kiosk = val("kiosk").trim(); S.operators = ops;
    const boss = S.users[0]; boss.name = val("boss").trim() || t("Patron"); if (p1) boss.pin = await makePin(p1);
    ME = boss.id;
    store.save(); document.body.classList.remove("bare"); go("ouverture");
  };
}

// ---------- Mode démonstration : un cahier d'exemple, à part du vrai
function enterDemo() {
  KEY = "cahier-demo";
  const d = DEFAULTS(), day = today(), ops = ["wave", "om", "free"];
  Object.assign(d, { kiosk: t("Kiosque exemple"), operators: ops, users: [{ id: "patron", name: "Awa", role: "patron", pin: null }, { id: "e1", name: "Modou", role: "employe", pin: null, salary: 60000, prime: 10 }],
    trialStart: day, seuils: { cash: 50000, float: { wave: 50000, om: 30000, free: 20000 } }, hours: "Lun–Sam 8 h – 21 h",
    baremes: { wave: { depot: [{ max: 0, val: "0" }], retrait: [{ max: 0, val: "0,5%" }] }, om: { depot: [{ max: 0, val: "0,3%" }], retrait: [{ max: 0, val: "0,6%" }] }, free: { depot: [{ max: 0, val: "0,3%" }], retrait: [{ max: 0, val: "0,6%" }] } },
    services: [{ id: "s1", name: t("Crédit téléphonique"), mode: "commission", floatOp: "om", com: 5, comType: "pct" }, { id: "s2", name: t("Woyofal"), mode: "commission", floatOp: "wave", com: 1, comType: "pct" }, { id: "s3", name: t("Photocopie et impression"), mode: "revenu", floatOp: "" }],
    stock: [{ id: "p1", name: t("Carte SIM"), cost: 300, price: 500, qty: 18, min: 5 }, { id: "p2", name: t("Chargeur"), cost: 1500, price: 2500, qty: 4, min: 3 }],
    clients: [{ id: "c1", name: "Fatou", phone: "771234567" }, { id: "c2", name: "Ibrahima", phone: "781112233" }],
    annonces: [{ id: "a1", client: "Ibrahima", date: day, amount: 150000 }] });
  let cash = 200000; const fl = { wave: 300000, om: 150000, free: 80000 };
  let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let k = 13; k >= 0; k--) {
    const dd = addDays(day, -k);
    d.days[dd] = { open: { cash, float: { ...fl }, at: dd + "T08:00:00", by: "patron" } };
    const n = k === 0 ? 9 : 12 + Math.floor(rnd() * 14);
    for (let i = 0; i < n; i++) {
      const type = rnd() < 0.55 ? "retrait" : "depot", op = ops[Math.floor(rnd() * 3)], amount = [2000, 5000, 10000, 15000, 20000, 25000, 50000, 100000][Math.floor(rnd() * 8)];
      const h = 8 + Math.floor(rnd() * 12), phone = rnd() < 0.6 ? ["771234567", "781112233", "70" + String(1000000 + Math.floor(rnd() * 8999999))][Math.floor(rnd() * 3)] : "";
      const o = { id: uid() + i, t: `${dd}T${pad(h)}:${pad(Math.floor(rnd() * 60))}:00`, day: dd, kind: "mm", type, op, amount, phone, client: phone === "771234567" ? "Fatou" : phone === "781112233" ? "Ibrahima" : "", user: rnd() < 0.5 ? "patron" : "e1" };
      d.ops.push(Object.assign(o, { commission: tierValue(d.baremes[op][type], amount) }));
    }
    if (k % 3 === 0) d.ops.push({ id: uid() + "s", t: dd + "T12:00:00", day: dd, kind: "service", svc: "s1", label: t("Crédit téléphonique"), floatOp: "om", amount: 3000, commission: 150, user: "patron" });
    if (k % 4 === 1) d.ops.push({ id: uid() + "v", t: dd + "T15:00:00", day: dd, kind: "vente", item: "p1", label: t("Carte SIM"), qty: 2, amount: 1000, cost: 300, user: "e1" });
    if (k === 6) d.ops.push({ id: uid() + "d", t: dd + "T10:00:00", day: dd, kind: "depense", cat: "Électricité", label: t("Électricité"), amount: 8000, fromCash: true, user: "patron" });
    // rééquilibrage du matin chez le super-agent, pour que l'exemple reste réaliste
    const S0 = S; S = d; let b = balances(dd);
    const lowOp = ops.slice().sort((x, y) => (b.float[x] || 0) - (b.float[y] || 0))[0], highOp = ops.slice().sort((x, y) => (b.float[y] || 0) - (b.float[x] || 0))[0];
    if (b.cash < 150000) d.ops.push({ id: uid() + "r", t: dd + "T08:30:00", day: dd, kind: "float", sub: "vidage", op: highOp, amount: Math.ceil((200000 - b.cash) / 10000) * 10000, partner: "Super-agent", fee: 0, user: "patron" });
    else if ((b.float[lowOp] || 0) < 100000) d.ops.push({ id: uid() + "r", t: dd + "T08:30:00", day: dd, kind: "float", sub: "recharge", op: lowOp, amount: 150000, partner: "Super-agent", fee: 1000, feeCash: true, user: "patron" });
    d.ops.sort((a, b) => (a.t < b.t ? -1 : 1));
    b = balances(dd); S = S0;
    if (k > 0) { const gap = [0, 0, 0, -1000, 0, 500][k % 6]; d.days[dd].close = { cash: b.cash + gap, float: { ...b.float }, expected: { cash: b.cash, float: { ...b.float } }, at: dd + "T21:00:00", by: k % 2 ? "patron" : "e1" }; cash = b.cash + gap; Object.assign(fl, b.float); }
  }
  S = d; ME = "patron";
  try { sessionStorage.setItem("demo", "1"); } catch {}
  store.save(); go("accueil"); render();
}
function exitDemo() {
  try { localStorage.removeItem("cahier-demo"); sessionStorage.removeItem("demo"); } catch {}
  KEY = "cahier"; S = Object.assign(DEFAULTS(), store.load()); migrate(); ME = null;
  location.hash = "accueil"; lock();
}
