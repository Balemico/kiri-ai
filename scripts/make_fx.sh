#!/usr/bin/env bash
# Derive the short duel FX from the whoosh master (audio-src/fx/whoosh.wav, NOT shipped) into
# public/audio/. The master has its energy in the mids (~2 kHz), so it survives phone speakers —
# sub-heavy whooshes vanish there. Re-run after changing the master: `bash scripts/make_fx.sh`.
#
#  fx/rise.mp3        — a paper cut-out raised to its feet: the whoosh REVERSED (a swell instead of a
#                       burst), its faint tail trimmed so the peak lands as the figure comes upright
#                       (~0.85 s ≈ PAPER_CUTOUT.standDur × liftShare); softened (low-pass) — paper, not a blade.
#  cards/card_cover_N.mp3 — a placed card turns face-down: REAL paper, not the air whoosh. Cut from the
#                       raw card take public/audio/cards/cards.2.mp3, where each gesture is a soft paper
#                       SWISH (gradual 60–95 ms attack, energy ~6 kHz, no transient) followed by the TAP of
#                       the card landing. Each variant keeps swish + tap, the swish lifted (+5 dB) and the
#                       tap tucked under it (−3 dB) so the paper sweep leads, then peak-normalised to −3 dBTP.
set -euo pipefail

SRC="audio-src/fx/whoosh.wav"
OUT="public/audio"
mkdir -p "$OUT/fx" "$OUT/cards"

ffmpeg -hide_banner -loglevel error -y -i "$SRC" -map_metadata -1 -af "\
atrim=0:1.4,areverse,atrim=start=0.25,asetpts=PTS-STARTPTS,\
highpass=f=250,lowpass=f=6000,afade=t=in:d=0.15,afade=t=out:st=0.98:d=0.17,\
loudnorm=I=-20:TP=-2:LRA=7" -ac 1 -ar 44100 -c:a libmp3lame -b:a 128k "$OUT/fx/rise.mp3"

# start (s in cards.2), length (s), tap onset (s into the clip)
CARDS="public/audio/cards/cards.2.mp3"
COVERS=("12.29 0.37 0.21" "14.99 0.35 0.23" "20.98 0.34 0.23" "22.98 0.31 0.20" "24.47 0.33 0.22")
rm -f "$OUT"/cards/card_cover*.mp3
i=0
for spec in "${COVERS[@]}"; do
	read -r start len tap <<<"$spec"
	i=$((i + 1))
	shape="atrim=start=$start:duration=$len,asetpts=PTS-STARTPTS,highpass=f=300,\
volume=5dB:enable='lt(t,$tap)',volume=-3dB:enable='gte(t,$tap)',\
afade=t=in:d=0.012,afade=t=out:st=$(printf "%.3f" "$(echo "$len - 0.06" | bc)"):d=0.06"
	peak=$(ffmpeg -hide_banner -nostats -i "$CARDS" -af "$shape,volumedetect" -f null - 2>&1 | sed -n 's/.*max_volume: \(-*[0-9.]*\) dB/\1/p')
	gain=$(echo "-3 - ($peak)" | bc)
	ffmpeg -hide_banner -loglevel error -y -i "$CARDS" -map_metadata -1 -af "$shape,volume=${gain}dB" \
		-ac 1 -ar 44100 -c:a libmp3lame -b:a 128k "$OUT/cards/card_cover_$i.mp3"
done

for f in "$OUT/fx/rise.mp3" "$OUT"/cards/card_cover_*.mp3; do
	echo "$f: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f") s"
done
