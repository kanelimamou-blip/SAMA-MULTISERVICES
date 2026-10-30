"""Codes d'abonnement de Téere Xaalis.

python outils/codes.py 50   -> ajoute 50 codes (chacun = 31 jours pour un kiosque).
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


def main(n):
    s = salt()
    codes = ["".join(secrets.choice(ALPHABET) for _ in range(5)) + "-" + "".join(secrets.choice(ALPHABET) for _ in range(6)) for _ in range(n)]
    text = CODES_JS.read_text()
    old = re.findall(r'"([0-9a-f]{64})"', text)
    hashes = old + [hashlib.sha256((s + c).encode()).hexdigest() for c in codes]
    body = ",\n".join(f'  "{h}"' for h in hashes)
    CODES_JS.write_text(text.split("CFG.codes")[0] + f"CFG.codes = [\n{body},\n];\n")
    PRIVATE.mkdir(parents=True, exist_ok=True)
    with (PRIVATE / "codes-abonnement.txt").open("a") as f:
        f.writelines(c + "\n" for c in codes)
    print(f"{n} codes ajoutés ({len(hashes)} au total). Liste : {PRIVATE / 'codes-abonnement.txt'}")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 20)
