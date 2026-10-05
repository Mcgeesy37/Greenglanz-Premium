#!/usr/bin/env bash
# Zerlegt die Higgsfield-Clips in Bildfolgen fuer den Scroll-Film.
# Aufruf: tools/frames.sh <Ordner mit den mp4-Dateien> [Zielordner, Standard: assets/seq]
# Die Clips werden ueber ihre Higgsfield-Job-ID im Dateinamen zugeordnet.
set -euo pipefail
SRC="${1:?Ordner mit den Clips angeben}"; OUT="${2:-assets/seq}"
declare -A MAP=(
  [a37171e8]=01-schwenk [b06f6d5a]=02-wisch [7e0b35ef]=03-foam [81007aca]=04-felge
  [c5983ce1]=05-politur [981b9700]=06-versiegelung [673ff471]=07-innenraum [76af79f2]=08-finale
)
mkdir -p "$OUT"; json=""
for id in $(printf '%s\n' "${!MAP[@]}" | sort); do :; done
for dir in $(printf '%s\n' "${MAP[@]}" | sort); do
  for id in "${!MAP[@]}"; do [ "${MAP[$id]}" = "$dir" ] && key="$id"; done
  f=$(ls "$SRC"/*"$key"*.mp4 2>/dev/null | head -1 || true)
  if [ -z "$f" ]; then echo "fehlt: $dir (Job $key)"; continue; fi
  rm -rf "$OUT/$dir"; mkdir -p "$OUT/$dir"
  ffmpeg -loglevel error -y -i "$f" -vf "fps=12,scale=1280:-2:flags=lanczos" -c:v libwebp -quality 72 -compression_level 5 "$OUT/$dir/f%03d.webp"
  n=$(ls "$OUT/$dir"/f*.webp | wc -l)
  cp "$OUT/$dir/$(printf 'f%03d.webp' "$n")" "$OUT/$dir/poster.webp"
  [ "$dir" = "01-schwenk" ] && cp "$OUT/$dir/f001.webp" "$OUT/$dir/poster.webp"
  json="$json${json:+,}\"$dir\":$n"; echo "ok: $dir ($n Bilder)"
done
printf '{"ext":"webp","scenes":{%s}}\n' "$json" > "$OUT/manifest.json"
du -sh "$OUT"
