# Sama Multi Service

Le cahier de caisse des agents de mobile money au Sénégal (kiosques Wave, Orange Money, Free Money, Wizall). L'agent note ses dépôts et retraits ; l'appli recalcule son liquide et son solde électronique par opérateur, fait les totaux du jour et la clôture de caisse du soir. Elle s'installe sur l'écran d'accueil et marche sans connexion.

**L'appli ne fait aucun transfert.** Elle n'est reliée à aucun opérateur et ne demande jamais de code secret d'opérateur. Elle a son propre nom et son propre logo.

## Ce que fait l'appli

Voir `IDEES.md` : l'état de chacune des 100 idées. En bref : cahier de caisse (dépôts, retraits, soldes, clôture avec écart expliqué), commissions et bénéfice, float (alertes, prévision, recharges, prêts), services et stock, rapports (WhatsApp, mois, export, micro-crédit), employés, sécurité, clients, formation, mode démonstration.

Pas de paiement dans l'appli et aucun blocage automatique : le propriétaire encaisse les abonnements lui-même, hors de l'appli, et suspend ou réactive un client depuis l'espace admin.

## Côté kiosque (plan de lancement)

Accueil « Ma journée en 3 étapes » (ouvrir, noter, clôturer) ; seuils d'alerte demandés à la première ouverture ; rapport du soir au propriétaire en un geste WhatsApp (matin, soir et écart par opérateur et pour le liquide) ; consentement des clients et ligne « Répondez STOP » dans chaque message, plus de message à ceux qui ont dit STOP ; page « Les mots de l'appli » ; carte d'installation sur l'écran d'accueil (bouton direct sur Android, gestes pour iPhone).

## Fichiers

- `docs/` : l'appli (HTML/JS sans dépendance, polices du téléphone, environ 150 Ko), publiée sur GitHub Pages à chaque modification de `main`.
  `core.js` (données et calculs), `compte.js` (comptes Firebase, copie en ligne du cahier, suspension, erreurs), `caisse.js` (caisse, journal, clôture), `gestion.js` (gains, float, services, rapports), `plus.js` (équipe, sécurité, clients, formation, réglages, démo), `admin.js` (connexion, compte suspendu, espace admin, « Voir », barre de rôles), `app.js` (navigation et démarrage).
- `docs/config.js` : nom, numéro WhatsApp d'assistance, opérateurs, numéro affiché aux clients suspendus (`contact`), liste `admins` (UID Firebase des comptes admin, jamais d'e-mail), configuration Firebase.
- `docs/vendor/qrcode.js` : générateur de QR code (Kazuhiko Arase, licence MIT).
- `docs/i18n.js` : textes. Pour le wolof, remplir `WO` avec « phrase française » : « traduction ».
- `firestore.rules` : règles Firestore (mettre l'UID de l'admin dans la fonction `admin()` : `request.auth.uid in ['UID']`, puis coller dans la console).
- `tests/` : tests des règles et parcours complet dans un navigateur, avec les émulateurs Firebase.

## Mise en ligne

1. Dépôt GitHub : `kanelimamou-blip/SAMA-MULTISERVICES`.
2. Dans le dépôt : Settings › Pages › Source : « GitHub Actions ». Le fichier `.github/workflows/pages.yml` publie `docs/` à chaque modification.
3. L'appli est alors en ligne sur `https://kanelimamou-blip.github.io/SAMA-MULTISERVICES/`.

## Comptes et espace admin

Quand `FIREBASE_CONFIG` est rempli, chaque client crée un compte (e-mail ou Google) à la première ouverture ; ensuite l'appli marche aussi sans connexion. Un compte = un kiosque : fiche `kiosques/{uid}` (nom, quartier, téléphone, inscription, dernière activité, `blocked`) et copie du cahier dans `kiosques/{uid}/cahier` (un document `base` et un par jour). Sur un nouveau téléphone, le client se connecte et retrouve son cahier. Les codes à 4 chiffres ne partent pas en ligne.

Page `#admin` (lien discret « Espace propriétaire » en bas de l'accueil et de l'écran de connexion ; bouton « Espace admin » en haut, visible par l'admin seul ; ouverture directe quand l'admin se connecte) :
- pas connecté : connexion Google ou e-mail ; connecté mais pas admin : l'UID du compte, avec « Copier » ;
- chiffres : inscrits, actifs cette semaine, inactifs, erreurs des 7 derniers jours ;
- clients : nom, quartier, téléphone, inscription, opérations des 7 derniers jours, état (Actif, Nouveau, Inactif, Suspendu), recherche et filtres ;
- par client : Suspendre/Réactiver, WhatsApp, « Voir » (l'appli comme le client la voit, en patron ou en employé, en lecture seule) ;
- erreurs (`erreurs`) : plantages et écritures refusées, au plus 5 par visite, avec message, écran, client, rôle et téléphone ; l'admin les efface ;
- « Nouveau client » : l'admin prépare le kiosque (nom, quartier, téléphone) et obtient un lien `#invite/CODE` et son QR code (Partager, Copier, WhatsApp). Le propriétaire s'inscrit par ce lien et trouve son kiosque déjà nommé ; l'invitation ne sert qu'une fois (vérifié par les règles) ;
- suivi des encaissements (hors appli) : tarif par kiosque (3 000 F par défaut, `CFG.tarif`), « Payé ce mois », essai gratuit 14 jours, repères « À relancer » dès le 5 (message WhatsApp prêt) et « À suspendre ? » dès le 10 ; la suspension reste un clic de l'admin ;
- mode présentation : données d'exemple et barre du haut pour passer de patron à employé.

Les règles Firestore font la sécurité : seul l'admin lit la liste, les cahiers et les erreurs ; il ne peut modifier que `blocked`. Un kiosque suspendu voit « suspendu, contacte l'équipe au 78 272 19 20 » et les règles refusent toutes ses écritures, même en contournant l'appli ; il ne peut pas se réactiver.

## Tests

```
npm i firebase-tools @firebase/rules-unit-testing firebase playwright
npx firebase emulators:exec --project demo-sms-regles --only firestore,auth "node tests/regles.test.cjs"
FIREBASE_SDK_DIR=node_modules/firebase npx firebase emulators:exec --project demo-sms-parcours --only firestore,auth "node tests/parcours.test.cjs"
```
