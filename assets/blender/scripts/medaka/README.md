# Medaka asset

`build_all.py` creates an original medaka master, its 11-bone rig, a one-second 2 Hz in-place swim clip, `MEDAKA_SHOAL_CTRL`, and a hidden `Medaka_Debug` collection. Native Blender forward is +Y; exported Three forward is -Z.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python assets/blender/scripts/medaka/build_all.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python assets/blender/scripts/medaka/build_all.py -- --bake-motion
```

For a complete editable shoal, always regenerate in this order; the master-only command above intentionally overwrites the blend without 120-second actions:

```sh
python3 -m assets.blender.scripts.medaka.generate_motion
python3 -m assets.blender.scripts.medaka.validation
/Applications/Blender.app/Contents/MacOS/Blender --background --python assets/blender/scripts/medaka/build_all.py -- --bake-motion
```

The `--bake-motion` command reads `public/models/medaka-motion.bin` and bakes 22 linked-mesh armatures for frames 0–3600 at 30 fps. The binary `integratedPhase` already includes each fish phase. Tail bones use local Z adjacent tangent rotations. With `q=0`, `accel=0`, pectorals use `0.20 * sin(integratedPhase)` on opposing local-Z signs; their general amplitude is `0.20 * (1 - .55*q)`.

The saved shoal view hides `Medaka_Source` while retaining it for editing. `Medaka_Debug` contains the exact validation bounds and the three plant ellipsoids, all converted from Three `(x,y,z)` to Blender `(x,-z,y)`. `Camera_Shoal_Overview`, a neutral world, and two distant area review lights make the editable shoal directly renderable.
