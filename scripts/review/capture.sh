#!/bin/bash
# Usage: capture.sh PORT SESSION OUTDIR scene [scene...]
# Captures dawn/noon/sunset/moon at 1600x900 in an isolated headed browser
# session and writes <scene>-<moment>.png plus <scene>-grid.jpg into OUTDIR.
PORT=$1; SES=$2; OUT=$3; shift 3
mkdir -p "$OUT"
AB="agent-browser --session $SES"
first=1
for p in "$@"; do
  if [ $first = 1 ]; then agent-browser --headed --session $SES open "http://127.0.0.1:$PORT/?place=$p" >/dev/null 2>&1; first=0
  else $AB open "http://127.0.0.1:$PORT/?place=$p" >/dev/null 2>&1; fi
  $AB set viewport 1600 900 >/dev/null 2>&1
  sleep 18
  for m in dawn noon sunset moon; do
    id=$m; [ $m = moon ] && id=moonlight
    $AB eval "document.querySelector('[data-moment=$id]').click()" >/dev/null 2>&1
    sleep 12
    $AB eval "document.querySelectorAll('body > *').forEach(e=>{if(!e.contains(document.querySelector('canvas'))&&!e.classList.contains('grain'))e.style.visibility='hidden'})" >/dev/null 2>&1
    $AB screenshot "$OUT/$p-$m.png" >/dev/null 2>&1
  done
  python3 - "$OUT" "$p" <<'EOF'
import sys
from PIL import Image
out,p=sys.argv[1],sys.argv[2]
ims=[Image.open(f'{out}/{p}-{m}.png').convert('RGB').resize((800,450)) for m in ['dawn','noon','sunset','moon']]
g=Image.new('RGB',(1600,900))
for i,im in enumerate(ims): g.paste(im,((i%2)*800,(i//2)*450))
g.save(f'{out}/{p}-grid.jpg',quality=82)
EOF
  echo "captured $p"
done
$AB close >/dev/null 2>&1
