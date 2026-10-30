"use strict";
// Textes de l'appli. La clé est la phrase en français ; pour traduire en wolof, il suffit de remplir WO
// avec « phrase française » : « traduction ». Une phrase sans traduction reste en français.
// Les {n}, {op}… sont remplacés par les valeurs au moment de l'affichage.
const WO = {
  // "Dépôt": "Dépôt",
  // "Retrait": "Génné xaalis",
};

const LANGS = { fr: "Français", wo: "Wolof" };
let LANG = "fr";
try { LANG = localStorage.getItem("cahier-lang") || "fr"; } catch {}

function t(fr, vars) {
  let s = (LANG === "wo" && WO[fr]) || fr;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return s;
}
function setLang(l) { LANG = l; try { localStorage.setItem("cahier-lang", l); } catch {} document.documentElement.lang = l; }
// Le choix de langue n'apparaît que quand la traduction wolof est assez remplie
const woReady = () => Object.keys(WO).length >= 40;
