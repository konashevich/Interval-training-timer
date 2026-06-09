#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ICONS="$ROOT/icons"
PADDED="$ICONS/icon-padded.svg"
FAVICON_SVG="$ICONS/favicon.svg"

# PWA icons — square white canvas, 15% padding (baked into icon-padded.svg)
rsvg-convert -w 192 -h 192 "$PADDED" -o "$ICONS/icon-192.png"
rsvg-convert -w 512 -h 512 "$PADDED" -o "$ICONS/icon-512.png"
rsvg-convert -w 512 -h 512 "$PADDED" -o "$ICONS/icon-maskable-512.png"

# Favicon PNGs + ICO — rounded white tile, border, 15% padding (baked into favicon.svg)
rsvg-convert -w 16 -h 16 "$FAVICON_SVG" -o "$ICONS/favicon-16x16.png"
rsvg-convert -w 32 -h 32 "$FAVICON_SVG" -o "$ICONS/favicon-32x32.png"
convert "$ICONS/favicon-16x16.png" "$ICONS/favicon-32x32.png" "$ICONS/favicon.ico"
cp "$ICONS/favicon.ico" "$ROOT/favicon.ico"

echo "Generated icons in $ICONS"
