#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ICONS="$ROOT/icons"
PADDED="$ICONS/icon-padded.svg"
MASKABLE="$ICONS/icon-maskable.svg"
FAVICON_SVG="$ICONS/favicon.svg"

# PWA icons — transparent canvas, 25% padding (logo at 50%)
rsvg-convert -w 192 -h 192 "$PADDED" -o "$ICONS/icon-192.png"
rsvg-convert -w 512 -h 512 "$PADDED" -o "$ICONS/icon-512.png"

# Maskable — extra inset (30% padding, logo at 40%) for Samsung / squircle launchers
rsvg-convert -w 512 -h 512 "$MASKABLE" -o "$ICONS/icon-maskable-512.png"

# Favicon PNGs + ICO — transparent, rounded border, 25% padding
rsvg-convert -w 16 -h 16 "$FAVICON_SVG" -o "$ICONS/favicon-16x16.png"
rsvg-convert -w 32 -h 32 "$FAVICON_SVG" -o "$ICONS/favicon-32x32.png"
convert "$ICONS/favicon-16x16.png" "$ICONS/favicon-32x32.png" "$ICONS/favicon.ico"
cp "$ICONS/favicon.ico" "$ROOT/favicon.ico"

echo "Generated icons in $ICONS"
