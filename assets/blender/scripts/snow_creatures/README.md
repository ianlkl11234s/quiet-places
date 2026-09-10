# Snow Window creature cache importer

This folder imports the **runtime-generated** Aurelia and Clione geometry into a separate Blender biological QA studio. It does not recreate the Snow Window room, lighting, choreography, or runtime controller.

## Input contract

`scene.json` must declare `schema: "snow-creatures-bake/v1"`, `units: "m"`, `fps: 12` or `15`, `durationSeconds: 60`, and:

```json
{
  "coordinateSystem": { "source": "three-y-up", "blender": "z-up", "positionMap": "[x,y,z]→[x,-z,y]" },
  "meshes": [{
    "name": "JELLY_A",
    "creature": "JELLY_A",
    "type": "aurelia",
    "positions": { "path": "frames/JELLY_A.f32le", "frameCount": 720, "vertexCount": 0, "components": 3, "space": "local" },
    "indices": [0, 1, 2],
    "material": { "color": [0.8, 0.85, 0.9], "opacity": 0.6, "roughness": 0.5, "transmission": 0.2 },
    "rootPoses": { "path": "frames/JELLY_A.roots.f32le", "layout": "px,py,pz,qx,qy,qz,qw", "space": "world" }
  }]
}
```

Position data is little-endian `float32`, frame-major (`frameCount × vertexCount × 3`); root data is little-endian `float32`, frame-major (`frameCount × 7`), with quaternion components `qx,qy,qz,qw`. Each record has stable topology and bakes runtime scale into its local vertices: importer root scale remains identity. Several material meshes may belong to one creature; the scene must contain exactly three unique `aurelia` and five unique `clione` creature values.

## Bake

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python assets/blender/scripts/snow_creatures/bake_import.py -- \
  --input exports/snowwindow-biology-20260910/bake-input-final/scene.json \
  --output assets/blender/snow-creatures.blend \
  --export-gltf public/models/snow-creatures-preview.glb
```

The `.blend` uses external PC2 files in `assets/blender/snow-creatures_pc2/` for local mesh deformation, plus sampled linear root location/quaternion keyframes. Blender plays at 30 fps and interpolates the 12/15 fps PC2 source samples. It opens with `JELLIES`, `CLIONE`, `RIGS`, `DEBUG`, and `COLLISION` collections and a neutral silhouette camera.

The optional GLB is a **two-second QA preview clip**: it contains actual sampled runtime local deformations as morph targets plus sampled root transforms. It is intentionally limited to two seconds and is not the web runtime asset or the 60-second PC2 cache.

`snow-creatures-validation.json` is emitted alongside the `.blend` after finite-value, stable-topology, 3-jelly/5-Clione, duration, and frame-count validation.
