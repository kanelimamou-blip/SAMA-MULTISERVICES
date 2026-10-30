# Sama Multi Service

Le cahier de caisse des agents de mobile money au Sénégal (kiosques Wave, Orange Money, Free Money, Wizall). L'agent note ses dépôts et retraits ; l'appli recalcule son liquide et son solde électronique par opérateur, fait les totaux du jour et la clôture de caisse du soir. Elle s'installe sur l'écran d'accueil et marche sans connexion.

**L'appli ne fait aucun transfert.** Elle n'est reliée à aucun opérateur et ne demande jamais de code secret d'opérateur. Elle a son propre nom et son propre logo.

## Ce que fait l'appli

Voir `IDEES.md` : l'état de chacune des 100 idées. En bref : cahier de caisse (dépôts, retraits, soldes, clôture avec écart expliqué), commissions et bénéfice, float (alertes, prévision, recharges, prêts), services et stock, rapports (WhatsApp, mois, export, micro-crédit), employés, sécurité, clients, formation, mode démonstration. Essai gratuit de 10 jours, puis 20 opérations gratuites par jour ou abonnement (mois ou année) payé par Wave ou Orange Money.

## Fichiers

- `docs/` : l'appli (HTML/JS sans dépendance, polices du téléphone, environ 150 Ko), publiée sur GitHub Pages à chaque modification de `main`.
  `core.js` (données et calculs), `caisse.js` (caisse, journal, clôture), `gestion.js` (gains, float, services, rapports), `plus.js` (équipe, sécurité, clients, formation, abonnement, réglages, démo), `app.js` (navigation).
- `docs/config.js` : prix, durée de l'essai, numéros Wave / Orange Money / WhatsApp, opérateurs.
- `docs/i18n.js` : textes. Pour le wolof, remplir `WO` avec « phrase française » : « traduction ».
- `outils/codes.py` : `python outils/codes.py 50` ajoute 50 codes d'un mois, `python outils/codes.py 10 --annee` 10 codes d'un an. Les codes en clair sont écrits hors du dépôt ; seuls les hachages vont dans `docs/codes.js`.

## Mise en ligne

1. Créer le dépôt GitHub `sama-multi-service` (public), y pousser ce dossier.
2. Dans le dépôt : Settings › Pages › Source : « GitHub Actions ». Le fichier `.github/workflows/pages.yml` publie `docs/` à chaque modification.
3. L'appli est alors en ligne sur `https://kanelimamou-blip.github.io/sama-multi-service/`.

## Sauvegarde en ligne (étape suivante)

Créer un projet Firebase gratuit « Sama Multi Service » (comme pour Révision), activer Authentication et Firestore, puis coller la configuration dans `docs/sync.js`. Cela ouvrira : sauvegarde automatique, plusieurs kiosques pour un patron, déconnexion à distance, carte des kiosques, forum.
