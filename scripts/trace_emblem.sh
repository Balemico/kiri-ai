#!/usr/bin/env bash
# Trace the box-art emblem (art-src/box-cover.jpg: white samurai/ensō shapes on a red field) into
# public/images/logo/kiri-ai-emblem.svg as its NEGATIVE: the cover's white shapes become crimson ink,
# its red becomes the page's washi paper — a brushed red sun with the samurai cut out of it.
# The cover is low-res, so it is upscaled before tracing and shipped as a vector (crisp at any DPR).
# Needs ffmpeg + potrace. If the crop/scale change, re-measure the viewBox (bounding box of the
# traced pixels in emblem.pgm, + a small pad).
set -euo pipefail

SRC="art-src/box-cover.jpg"
OUT="public/images/logo/kiri-ai-emblem.svg"
INK="#a01b1b" # matches the red of the title stroke (kiri-ai-logo.png)
TMP="$(mktemp -d)"

# Emblem only (no title strip / publisher logos): 380×470 from (90,0); green plane = whiteness.
ffmpeg -hide_banner -loglevel error -y -i "$SRC" \
	-vf "crop=380:470:90:0,format=gbrp,extractplanes=g,scale=iw*6:ih*6:flags=lanczos,negate" "$TMP/emblem.pgm"
potrace "$TMP/emblem.pgm" -s -k 0.45 -t 8 -a 1.1 -O 0.4 --flat -C "$INK" -o "$OUT"
# Tight viewBox around the shapes, no fixed pt size, no metadata.
sed -i '' -e 's| width="2280.000000pt" height="2820.000000pt" viewBox="0 0 2280.000000 2820.000000"| viewBox="66 131 2054 2479"|' \
	-e '/<metadata>/,/<\/metadata>/d' "$OUT"
rm -rf "$TMP"
echo "wrote $OUT"
