#!/usr/bin/env bash
# Scans images/ and writes images/manifest.json listing every image file found.
# Run this after adding or removing files in images/ — no code changes needed.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/images"
OUT="$DIR/manifest.json"

first=true
{
  echo "["
  while IFS= read -r -d '' f; do
    name="$(basename "$f")"
    esc="${name//\\/\\\\}"
    esc="${esc//\"/\\\"}"
    if $first; then
      first=false
    else
      echo ","
    fi
    printf '  "%s"' "$esc"
  done < <(find "$DIR" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' -o -iname '*.gif' \) -print0 | sort -z)
  echo ""
  echo "]"
} > "$OUT"

count=$(find "$DIR" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' -o -iname '*.gif' \) | wc -l)
echo "Wrote $count image(s) to $OUT"

# Also (re)build images/credits.json — attribution for each image.
# Filenames matching the Pexels download pattern (pexels-<user>-<id>.jpg) get
# author/link auto-filled from the name itself. Anything else gets a blank
# stub to fill in by hand. Existing entries are never overwritten, so manual
# edits and previously-filled stubs survive re-runs.
python3 - "$DIR" <<'PY'
import json, os, re, sys

dir_path = sys.argv[1]
manifest_path = os.path.join(dir_path, "manifest.json")
credits_path = os.path.join(dir_path, "credits.json")

with open(manifest_path) as f:
    files = json.load(f)

credits = {}
if os.path.exists(credits_path):
    with open(credits_path) as f:
        credits = json.load(f)

pattern = re.compile(r"^pexels-(?P<user>.+)-(?P<id>\d+)\.\w+$", re.IGNORECASE)
added = 0

for name in files:
    if name in credits:
        continue
    m = pattern.match(name)
    if m:
        user, photo_id = m.group("user"), m.group("id")
        credits[name] = {
            "author": user,
            "authorUrl": f"https://www.pexels.com/@{user}/",
            "photoUrl": f"https://www.pexels.com/photo/{photo_id}/",
            "source": "Pexels",
        }
    else:
        credits[name] = {"author": None, "authorUrl": None, "photoUrl": None, "source": None}
    added += 1

credits = {k: credits[k] for k in sorted(credits)}
with open(credits_path, "w") as f:
    json.dump(credits, f, indent=2, ensure_ascii=False)
    f.write("\n")

stubs = [name for name in files if credits.get(name, {}).get("author") is None]
print(f"Credits: {added} new entry(ies) added to {credits_path}", file=sys.stderr)
if stubs:
    print(f"NOTE: fill in credit info by hand for: {', '.join(stubs)}", file=sys.stderr)
PY
