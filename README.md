# Téere Xaalis

Le cahier de caisse des agents de mobile money au Sénégal (kiosques Wave, Orange Money, Free Money, Wizall). L'agent note ses dépôts et retraits ; l'appli recalcule son liquide et son solde électronique par opérateur, fait les totaux du jour et la clôture de caisse du soir. Elle s'installe sur l'écran d'accueil et marche sans connexion.

**L'appli ne fait aucun transfert.** Elle n'est reliée à aucun opérateur et ne demande jamais de code secret d'opérateur. Elle a son propre nom et son propre logo.

## Étape 1 (ce prototype)

- Saisie rapide d'une opération : dépôt ou retrait, opérateur, montant, numéro du client (idée 1).
- Totaux du jour par opérateur (2).
- Liquide et soldes électroniques recalculés après chaque opération (3).
- Clôture du soir : écart entre l'appli et ce qui est compté (5).
- Hors connexion : tout est gardé sur le téléphone (7). La sauvegarde en ligne viendra avec le projet Firebase (`docs/sync.js`).
- Verrouillage par code à 4 chiffres (63). Une opération n'est jamais effacée : on l'annule et elle reste barrée.
- Essai gratuit de 10 jours, puis 20 opérations gratuites par jour (30) ou abonnement de 1 500 F par mois.

## Fichiers

- `docs/` : l'appli (HTML/JS sans dépendance), publiée sur GitHub Pages à chaque modification de `main`.
- `docs/config.js` : prix, durée de l'essai, numéros Wave / Orange Money / WhatsApp, opérateurs.
- `docs/i18n.js` : textes. Pour le wolof, remplir `WO` avec « phrase française » : « traduction ».
- `outils/codes.py` : `python outils/codes.py 50` ajoute 50 codes d'abonnement (31 jours chacun). Les codes en clair sont écrits hors du dépôt ; seuls les hachages vont dans `docs/codes.js`.
