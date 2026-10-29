#!/usr/bin/env bash
# Encode the background-music masters (audio-src/background/*.mp3) into the shipped web formats
# (public/audio/music/): Opus/WebM (primary, ~96 kb/s) + AAC/M4A (fallback for older Safari).
#
# Every track is loudness-normalised with a two-pass EBU R128 loudnorm to the same target, so the
# random picks never jump in level and the music sits under the combat SFX. Metadata/cover art is
# stripped. Re-run after adding/replacing a master: `bash scripts/encode_music.sh`.
set -euo pipefail

SRC="audio-src/background"
OUT="public/audio/music"
TARGET_I=-18   # integrated loudness (LUFS)
TARGET_TP=-1.5 # true peak (dBTP)
TARGET_LRA=11

mkdir -p "$OUT"

for src in "$SRC"/*.mp3; do
	name="$(basename "$src" .mp3)"
	# Pass 1: measure.
	stats="$(ffmpeg -hide_banner -nostats -i "$src" \
		-af "loudnorm=I=$TARGET_I:TP=$TARGET_TP:LRA=$TARGET_LRA:print_format=json" -f null - 2>&1 |
		sed -n '/^{/,/^}/p')"
	get() { echo "$stats" | grep "\"$1\"" | sed -E 's/.*: "([^"]+)".*/\1/'; }
	filter="loudnorm=I=$TARGET_I:TP=$TARGET_TP:LRA=$TARGET_LRA:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true,aresample=48000"

	# Pass 2: normalise + encode both formats.
	ffmpeg -hide_banner -loglevel error -y -i "$src" -map 0:a -map_metadata -1 -af "$filter" \
		-c:a libopus -b:a 96k -vbr on -application audio "$OUT/$name.webm"
	ffmpeg -hide_banner -loglevel error -y -i "$src" -map 0:a -map_metadata -1 -af "$filter" -ar 44100 \
		-c:a aac -b:a 128k -movflags +faststart "$OUT/$name.m4a"
	echo "$name: $(get input_i) LUFS → $TARGET_I"
done
