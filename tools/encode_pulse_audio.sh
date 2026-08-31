#!/usr/bin/env bash
set -euo pipefail

encode_directory() {
  local directory="$1"

  for src in "$directory"/*.wav; do
    local base="${src%.wav}"

    ffmpeg -y -loglevel error \
      -i "$src" \
      -ar 44100 \
      -ac 2 \
      -c:a libvorbis \
      -q:a 5 \
      "${base}.ogg"

    ffmpeg -y -loglevel error \
      -i "$src" \
      -ar 44100 \
      -ac 2 \
      -c:a aac \
      -b:a 160k \
      -movflags +faststart \
      "${base}.m4a"
  done
}

encode_directory "assets/stems/pulse"
encode_directory "assets/stingers/pulse"
encode_directory "assets/transitions/pulse"

echo "Encoded Pulse M4A/OGG variants"
