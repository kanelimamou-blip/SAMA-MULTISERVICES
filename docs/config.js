"use strict";
const APP_VERSION = "2026.10.30";
// Réglages de l'appli (à modifier ici)
const CFG = {
  name: "Sama Multi Service",
  // numéro WhatsApp de l'assistance (format 221XXXXXXXXX)
  whatsapp: "221782721920",
  // numéro affiché aux clients suspendus
  contact: "78 272 19 20",
  // tarif mensuel par défaut d'un kiosque (encaissé hors de l'appli ; modifiable par kiosque dans l'espace admin)
  tarif: 3000,
  // comptes qui ouvrent l'espace admin (#admin) : identifiants Firebase (UID), jamais d'e-mail.
  // Le même identifiant va dans firestore.rules, fonction admin().
  admins: [],
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
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDxtoDEpBh92yEGn80UZUFwLa1KbIjhX6g",
  authDomain: "sama-3b548.firebaseapp.com",
  projectId: "sama-3b548",
  storageBucket: "sama-3b548.firebasestorage.app",
  messagingSenderId: "1088942015631",
  appId: "1:1088942015631:web:7f7e95d12e52ba6d8e9cfa",
};
