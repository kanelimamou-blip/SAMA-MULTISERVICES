"""Codes d'abonnement de Sama Multi Service.

python outils/codes.py 50          -> ajoute 50 codes d'un mois (31 jours pour un kiosque).
python outils/codes.py 10 --annee  -> ajoute 10 codes d'un an.
Les codes en clair vont dans /mnt/project-files/cahier-agent/prive/codes-abonnement.txt (hors du dépôt) ;
seuls leurs hachages sont ajoutés à docs/codes.js.
"""
import hashlib
import re
import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "docs" / "config.js"
CODES_JS = ROOT / "docs" / "codes.js"
PRIVATE = Path("/mnt/project-files/cahier-agent/prive")
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # sans 0/O ni 1/I


def salt():
    return re.search(r'salt:\s*"([^"]+)"', CONFIG.read_text()).group(1)


def main(n, year=False):
    key = "CFG.codes_year" if year else "CFG.codes"
    s = salt()
    codes = ["".join(secrets.choice(ALPHABET) for _ in range(5)) + "-" + "".join(secrets.choice(ALPHABET) for _ in range(6)) for _ in range(n)]
    text = CODES_JS.read_text()
    lists = {k: re.findall(r'"([0-9a-f]{64})"', m) for k, m in re.findall(r'(CFG\.codes(?:_year)?) = \[(.*?)\];', text, re.S)}
    lists[key] = lists.get(key, []) + [hashlib.sha256((s + c).encode()).hexdigest() for c in codes]
    hashes = lists[key]
    head = text.split("CFG.codes")[0]
    out = "".join(f"{k} = [\n" + "".join(f'  "{h}",\n' for h in lists.get(k, [])) + "];\n" for k in ("CFG.codes", "CFG.codes_year"))
    CODES_JS.write_text(head + out)
    PRIVATE.mkdir(parents=True, exist_ok=True)
    with (PRIVATE / ("codes-annee.txt" if year else "codes-mois.txt")).open("a") as f:
        f.writelines(c + "\n" for c in codes)
    print(f"{n} codes ajoutés ({len(hashes)} au total). Liste : {PRIVATE / ('codes-annee.txt' if year else 'codes-mois.txt')}")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    main(int(args[0]) if args else 20, "--annee" in sys.argv)
