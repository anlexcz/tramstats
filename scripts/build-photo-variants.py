#!/usr/bin/env python3
"""Build optimized WebP files for the TramStats 2020 photo collection.

Run: pip install Pillow
     python scripts/build-photo-variants.py /path/to/exported-drive-folder
Creates files and assets/photo-variants-generated.json; does not edit the Sheets DB.
"""
import argparse
import json
import re
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets/photos/2020"
SNAPSHOT = ROOT / "assets/photo-snapshot.js"
NAMES = ROOT / "assets/photo-original-names.json"
RESULT = ROOT / "assets/photo-variants-generated.json"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source", type=Path)
    ap.add_argument("--max-width", type=int, default=1600)
    ap.add_argument("--quality", type=int, default=80)
    args = ap.parse_args()
    if not args.source.is_dir():
        ap.error("Source directory does not exist")
    text = SNAPSHOT.read_text(encoding="utf-8")
    match = re.search(r"window\.TramStatsPhotoSnapshot\s*=\s*(\{.*\})\s*;", text, re.S)
    if not match:
        raise SystemExit("Photo snapshot not found")
    data = json.loads(match.group(1))
    names = json.loads(NAMES.read_text(encoding="utf-8"))
    existing = {r["photo_id"] for r in data.get("photo_variants", []) if r.get("variant") == "web"}
    source = {}
    for file in args.source.rglob("*"):
        if file.is_file():
            source.setdefault(file.name.lower(), []).append(file)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    rows, missing, ambiguous = [], [], []
    for photo in data["photos"]:
        pid = photo["id"]
        if pid in existing:
            continue
        name = names.get(pid)
        matches = source.get(name.lower(), []) if name else []
        if not matches:
            missing.append({"photo_id": pid, "filename": name})
            continue
        if len(matches) != 1:
            ambiguous.append({"photo_id": pid, "filename": name, "matches": len(matches)})
            continue
        file = matches[0]
        target = OUTPUT / (file.stem + ".webp")
        if target.exists():
            # Do not silently overwrite a different image with the same filename stem.
            ambiguous.append({"photo_id": pid, "filename": name, "reason": "target exists"})
            continue
        with Image.open(file) as im:
            im = ImageOps.exif_transpose(im)
            im.thumbnail((args.max_width, args.max_width * 2), Image.Resampling.LANCZOS)
            if im.mode not in ("RGB", "RGBA"):
                im = im.convert("RGB")
            im.save(target, "WEBP", quality=args.quality, method=6)
            width, height = im.size
        rows.append({"photo_id": pid, "variant": "web",
                     "file": target.relative_to(ROOT).as_posix(),
                     "width": width, "height": height,
                     "size_bytes": target.stat().st_size})
    RESULT.write_text(json.dumps({"variants": rows, "missing": missing, "ambiguous": ambiguous},
                                 ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(rows)} WebP files; missing {len(missing)}; ambiguous {len(ambiguous)}")


if __name__ == "__main__":
    main()
