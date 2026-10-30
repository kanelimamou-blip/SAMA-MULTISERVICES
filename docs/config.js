"use strict";
const APP_VERSION = "2026.10.30";
// Réglages de l'appli (à modifier ici)
const CFG = {
  name: "Sama Multi Service",
  // numéro WhatsApp de l'assistance (format 221XXXXXXXXX)
  whatsapp: "221782721920",
  // Opérateurs proposés (l'agent coche ceux qu'il utilise). Noms écrits en texte seulement, sans logo.
  operators: [
    { id: "wave", name: "Wave" },
    { id: "om", name: "Orange Money" },
    { id: "free", name: "Free Money" },
    { id: "wizall", name: "Wizall" },
  ],
};

// Projet Firebase (comptes des clients et espace admin). Configuration publique, pas secrète :
// la sécurité vient des règles Firestore (firestore.rules). Tant qu'elle est vide, l'appli marche sans compte.
const FIREBASE_CONFIG = null;
// Identifiant Firebase du propriétaire : seul ce compte ouvre l'espace admin (le même dans firestore.rules)
const ADMIN_UID = "";
