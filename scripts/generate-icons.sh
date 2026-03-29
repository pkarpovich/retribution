#!/bin/bash
set -e

SRC="${1:?Usage: ./scripts/generate-icons.sh <source-image>}"
OUT="public"

if [ ! -f "$SRC" ]; then
  echo "Error: $SRC not found"
  exit 1
fi

echo "Generating PWA icons from: $SRC"

sips -z 512 512 "$SRC" --out "$OUT/android-chrome-512x512.png" -s format png
sips -z 192 192 "$SRC" --out "$OUT/android-chrome-192x192.png" -s format png

sips -z 180 180 "$SRC" --out "$OUT/apple-touch-icon.png" -s format png
sips -z 167 167 "$SRC" --out "$OUT/apple-touch-icon-167x167.png" -s format png
sips -z 152 152 "$SRC" --out "$OUT/apple-touch-icon-152x152.png" -s format png
sips -z 120 120 "$SRC" --out "$OUT/apple-touch-icon-120x120.png" -s format png

sips -z 32 32 "$SRC" --out "$OUT/favicon-32x32.png" -s format png
sips -z 16 16 "$SRC" --out "$OUT/favicon-16x16.png" -s format png

if command -v magick &>/dev/null; then
  magick "$OUT/favicon-16x16.png" "$OUT/favicon-32x32.png" \
    \( "$SRC" -resize 48x48 \) "$OUT/favicon.ico"
  echo "Generated multi-size favicon.ico"
else
  cp "$OUT/favicon-32x32.png" "$OUT/favicon.ico"
  echo "ImageMagick not found — copied 32x32 as favicon.ico"
fi

echo ""
echo "Done! Generated icons:"
ls -lh "$OUT"/*.png "$OUT"/favicon.ico
