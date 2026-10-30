"use strict";
// Réglages de vente et de l'essai (à modifier ici)
const CFG = {
  name: "Téere Xaalis",
  price_fcfa: 1500,          // par mois et par kiosque
  sub_days: 31,              // durée d'un code d'abonnement mensuel
  // À CONFIRMER PAR EST : prix à l'année et prix réduit à partir de 3 kiosques
  price_year: 15000,
  price_multi: 1200,
  multi_from: 3,
  trial_days: 10,            // essai gratuit, tout débloqué
  free_ops_per_day: 20,      // après l'essai, sans abonnement
  wave_number: "78 272 19 20",
  om_number: "78 272 19 20",
  whatsapp: "221782721920",
  // Opérateurs proposés (l'agent coche ceux qu'il utilise). Noms écrits en texte seulement, sans logo.
  operators: [
    { id: "wave", name: "Wave" },
    { id: "om", name: "Orange Money" },
    { id: "free", name: "Free Money" },
    { id: "wizall", name: "Wizall" },
  ],
  // Codes d'abonnement : seuls les hachages sont publiés (voir outils/codes.py)
  salt: "tx-2026-a",
  codes: [],       // codes d'un mois
  codes_year: [],  // codes d'un an
};
