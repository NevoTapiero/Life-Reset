"""Index every LDraw part (file name + title) so parts can be searched quickly.

Usage: python make_catalog.py [path-to-ldraw]   ->  ../catalog/ldraw_catalog.tsv (git-ignored, ~1.5 MB)
Search example:  grep -i "Minifig Helmet" ../catalog/ldraw_catalog.tsv
"""
import os
import sys
from pathlib import Path

ldraw = Path(sys.argv[1] if len(sys.argv) > 1 else os.environ.get("SL_LDRAW_DIR", Path.home() / "ldraw"))
out = Path(__file__).resolve().parent.parent / "catalog" / "ldraw_catalog.tsv"
n = 0
with open(out, "w", encoding="utf-8") as f:
    for name in sorted(os.listdir(ldraw / "parts")):
        if name.endswith(".dat"):
            with open(ldraw / "parts" / name, encoding="utf-8", errors="ignore") as h:
                f.write(f"{name}\t{h.readline().strip()[2:]}\n")
            n += 1
print(n, "parts indexed ->", out)
