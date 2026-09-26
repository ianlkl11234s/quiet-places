# Southern Stingray procedural rig

Rebuild with:

```sh
/opt/homebrew/bin/blender --background --factory-startup --python assets/blender/scripts/stingray.py
```

Native Blender coordinates are +Y anterior and +Z dorsal. `SRAY_ROOT__Three_Z_Forward` applies the explicit export correction for Three.js local +Z forward and +Y up.

`SRAY_RIG` exposes 56 distributed pectoral controls named `L_FIN_U00_V01` through `R_FIN_U06_V04`; each has `side`, `u`, `v`, and `role=fin` custom properties. `tail_01` through `tail_10` are ordered passive tail controls. The eight baked Actions cover hover, slow cruise, cruise, left/right turns, rise, settle and rise-and-settle. Sampling is 30 fps. Slow cruise and both turns are exactly one cycle over 2 seconds (frames 0–60); hover is 4 seconds, cruise 1.4 seconds, rise/settle 3 seconds and rise-and-settle 6 seconds. Rise and settle are non-looping body offsets; root translation/yaw remain neutral for web path control. Muted NLA tracks retain every Action, with slow cruise active for inspection.

Fin weights interpolate the longitudinal/radial grid; their native-metre surface derivatives drive local bone rotations. Tail vertices interpolate adjacent bones. Straight-swim Actions hold the tail neutral; the website supplies delayed route-heading/elevation response, overriding the baked tail tracks. This is a kinematic approximation, not a fluid/soft-body simulation. The generator's `settings` table controls amplitude and duration; `W`, `L`, `TL`, `U`, `V` control dimensions and rig resolution. No live driver UI is required at runtime.

The export explicitly selects all asset meshes and excludes the review studio. `tests/stingrays.test.ts` loads the actual GLB and checks skinning, changing fin tracks and matching loop endpoints.

Q3 B2 (2026-09-27): the disc, pelvic lobes, eye margins and lids use one embedded JPEG atlas (dorsal upper half, ventral lower half) plus a roughness map; no `COLOR_0`. The tail mesh spans the full 1.65 m tail chain (`TAIL_MESH=TL`). Tail and fold use the plain upper material; eyes, spiracles, mouth, gills and spine use `SRAY_Detail`. The rig and clips are frozen (`rig_width`); `tests/stingray-contract.test.ts` guards them. `STINGRAY_GLB_OUT` / `STINGRAY_BLEND_OUT` write a candidate elsewhere; `STINGRAY_REVIEW_DIR` enables the legacy review PNGs. Details: `docs/biology/southern-stingray.md`.
