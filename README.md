# Sama Multi Service

Le cahier de caisse des agents de mobile money au Sénégal (kiosques Wave, Orange Money, Free Money, Wizall). L'agent note ses dépôts et retraits ; l'appli recalcule son liquide et son solde électronique par opérateur, fait les totaux du jour et la clôture de caisse du soir. Elle s'installe sur l'écran d'accueil et marche sans connexion.

**L'appli ne fait aucun transfert.** Elle n'est reliée à aucun opérateur et ne demande jamais de code secret d'opérateur. Elle a son propre nom et son propre logo.

## Ce que fait l'appli

Voir `IDEES.md` : l'état de chacune des 100 idées. En bref : cahier de caisse (dépôts, retraits, soldes, clôture avec écart expliqué), commissions et bénéfice, float (alertes, prévision, recharges, prêts), services et stock, rapports (WhatsApp, mois, export, micro-crédit), employés, sécurité, clients, formation, mode démonstration.

Pas de paiement dans l'appli : le propriétaire encaisse lui-même et active ou suspend les comptes depuis son espace admin.

## Fichiers

- `docs/` : l'appli (HTML/JS sans dépendance, polices du téléphone, environ 150 Ko), publiée sur GitHub Pages à chaque modification de `main`.
  `core.js` (données et calculs), `compte.js` (comptes Firebase, activité, journal des erreurs), `caisse.js` (caisse, journal, clôture), `gestion.js` (gains, float, services, rapports), `plus.js` (équipe, sécurité, clients, formation, réglages, démo), `admin.js` (connexion, compte suspendu, espace propriétaire), `app.js` (navigation et démarrage).
- `docs/config.js` : nom, numéro WhatsApp d'assistance, opérateurs, configuration Firebase et identifiant du propriétaire (`ADMIN_UID`).
- `docs/i18n.js` : textes. Pour le wolof, remplir `WO` avec « phrase française » : « traduction ».
- `firestore.rules` : règles Firestore (remplacer `ADMIN_UID` par l'identifiant du propriétaire avant de les coller dans la console).
- `tests/` : tests des règles et parcours complet dans un navigateur, avec les émulateurs Firebase.

## Mise en ligne

1. Dépôt GitHub : `kanelimamou-blip/SAMA-MULTISERVICES`.
2. Dans le dépôt : Settings › Pages › Source : « GitHub Actions ». Le fichier `.github/workflows/pages.yml` publie `docs/` à chaque modification.
3. L'appli est alors en ligne sur `https://kanelimamou-blip.github.io/SAMA-MULTISERVICES/`.

## Comptes et espace propriétaire

Quand `FIREBASE_CONFIG` est rempli, chaque client crée un compte (e-mail ou Google) à la première ouverture ; ensuite l'appli marche aussi sans connexion. Le cahier reste sur le téléphone : seuls le nom, l'e-mail, le nom du kiosque, les dates d'inscription et d'activité, et les erreurs vont dans Firestore.

Le compte dont l'identifiant est `ADMIN_UID` ouvre directement l'espace propriétaire : liste des comptes (inscription, dernière activité, actif ou suspendu), chiffres d'utilisation (jour, 7 jours, 30 jours), journal des erreurs (plantages et actions refusées : quel compte, quelle page, quand), et bouton pour suspendre ou réactiver un compte. Les règles Firestore refusent ces lectures à tout autre compte.

## Tests

```
npm i firebase-tools @firebase/rules-unit-testing firebase playwright
npx firebase emulators:exec --project demo-sms-regles --only firestore,auth "node tests/regles.test.cjs"
FIREBASE_SDK_DIR=node_modules/firebase npx firebase emulators:exec --project demo-sms-parcours --only firestore,auth "node tests/parcours.test.cjs"
```
