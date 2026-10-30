"use strict";
// Sauvegarde en ligne (Firebase gratuit), sur le modèle de l'appli Révision.
// Tant que FIREBASE_CONFIG est vide, le cahier reste seulement sur le téléphone (il marche hors connexion).
// Étape suivante : créer un projet Firebase « Téere Xaalis », coller sa configuration ici,
// puis envoyer le cahier au plus une fois par minute et quand l'agent quitte l'appli.
const FIREBASE_CONFIG = null;

const Sync = (() => {
  const enabled = !!FIREBASE_CONFIG;
  function start() {}
  function save() {}
  return { enabled, start, save };
})();
