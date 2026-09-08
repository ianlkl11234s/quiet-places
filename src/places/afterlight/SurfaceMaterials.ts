import * as THREE from 'three';

/**
 * World-space wetness for the courtyard's concrete.  The field deliberately
 * stays below a continuous water layer: the room starts damp after rain, with
 * only a few roughness-reducing films near the right-hand wall.
 */
export const afterlightSurfaceWetnessGLSL = /* glsl */ `
uniform float uAfterlightSurfaceRain;
varying vec3 vAfterlightSurfaceWorld;
varying vec3 vAfterlightSurfaceNormal;

float afterlightHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float afterlightNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(afterlightHash(i), afterlightHash(i + vec2(1., 0.)), f.x),
    mix(afterlightHash(i + vec2(0., 1.)), afterlightHash(i + vec2(1., 1.)), f.x), f.y);
}

float afterlightSurfaceWetness(vec3 p, vec3 n) {
  float floorFace = smoothstep(.68, .94, n.y);
  float wallFace = smoothstep(.72, .94, abs(n.x));
  // 0.5–2 m patches keep the base concrete subtly uneven without a new high
  // contrast texture; 5–30 cm variation is reserved for wetness only.
  vec2 surfacePlane = mix(p.xz, p.zy, wallFace);
  float macro = afterlightNoise(surfacePlane * .72) * .6 + afterlightNoise(surfacePlane * 1.7 + 19.);
  float meso = afterlightNoise(surfacePlane * 5.5 + 7.) * .55 + afterlightNoise(surfacePlane * 14. + 31.) * .45;
  float damp = .36 + .14 * macro + .28 * clamp(uAfterlightSurfaceRain, 0., 1.);

  // The right wall is x=1.71 m.  Its contact band spills a little onto the
  // floor, while an irregular 8–25 cm wall-foot boundary prevents a ruler-straight tide mark.
  float rightWall = wallFace * smoothstep(1.40, 1.69, p.x);
  float wallHeight = .08 + .17 * afterlightNoise(vec2(p.z * 5.2, p.z * 1.3 + 8.));
  float wallFoot = rightWall * (1. - smoothstep(.08, wallHeight, max(p.y, 0.)));
  float streak = rightWall * (1. - smoothstep(.035, .28, max(p.y, 0.)))
    * (.35 + .65 * afterlightNoise(vec2(p.z * 8.5, floor(p.y * 7.))));
  float contact = floorFace * (1. - smoothstep(.025, .46, abs(p.x - 1.71)));
  float films = floorFace * smoothstep(.57, .82, meso) * (.11 + .12 * macro);
  // One restrained local film gives the near plant/wall area a readable wet spot.
  vec2 spotDelta = p.xz - vec2(1.30, -.38);
  float wetSpot = floorFace * exp(-dot(spotDelta, spotDelta) / .105) * .20;
  return clamp(damp + films + contact * .24 + wallFoot * .34 + streak * .12 + wetSpot, 0., .88);
}

float afterlightMacroColor(vec3 p, vec3 n) {
  float wallFace = smoothstep(.72, .94, abs(n.x));
  vec2 surfacePlane = mix(p.xz, p.zy, wallFace);
  return (afterlightNoise(surfacePlane * .72 + 43.) - .5) * .018;
}
`;

export type AfterlightSurfaceMaterials = {
  /** `elapsed` is sampled directly, so repeated paused frames are bit-stable. */
  update(elapsed: number, rain: number): void;
  dispose(): void;
};

/**
 * Adds wetness after the scene's reflection-probe hook. It does not replace
 * authored maps: the shader only darkens albedo a few percent, reduces map
 * contrast in wet micro-detail, and keeps floor roughness at or above .30.
 */
export function installSurfaceMaterials(materials: Iterable<THREE.MeshStandardMaterial>): AfterlightSurfaceMaterials {
  const rain = {value: .46};
  let previousElapsed: number | undefined;
  const restores: Array<() => void> = [];
  const installed = new Set<THREE.MeshStandardMaterial>();

  for (const material of materials) {
    if (installed.has(material)) continue;
    installed.add(material);
    const previousCompile = material.onBeforeCompile;
    const previousCacheKey = material.customProgramCacheKey;
    const previousCacheKeyValue = previousCacheKey.call(material);
    material.onBeforeCompile = (shader, renderer) => {
      previousCompile.call(material, shader, renderer);
      shader.uniforms.uAfterlightSurfaceRain = rain;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vAfterlightSurfaceWorld;\nvarying vec3 vAfterlightSurfaceNormal;')
        .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\nvAfterlightSurfaceNormal = inverseTransformDirection(transformedNormal, viewMatrix);')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvAfterlightSurfaceWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${afterlightSurfaceWetnessGLSL}`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
// Existing concrete normal maps remain the source detail. Wet film softens,
// rather than adds, 1–10 mm normal contrast so the close floor stays quiet.
normal = normalize(mix(normal, normalize((viewMatrix * vec4(vAfterlightSurfaceNormal, 0.)).xyz), afterlightWet * .24));`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
float afterlightFloor = smoothstep(.68, .94, normalize(vAfterlightSurfaceNormal).y);
roughnessFactor *= 1. - afterlightWet * (.16 + .12 * afterlightFloor);
roughnessFactor = max(roughnessFactor, mix(.0, .30, afterlightFloor));`)
        .replace('#include <map_fragment>', `#include <map_fragment>
float afterlightWet = afterlightSurfaceWetness(vAfterlightSurfaceWorld, normalize(vAfterlightSurfaceNormal));
// Moisture shifts the existing base hue down only slightly; it never paints
// directional sunlight or a black stain into the material.
diffuseColor.rgb *= 1. + afterlightMacroColor(vAfterlightSurfaceWorld, normalize(vAfterlightSurfaceNormal));
diffuseColor.rgb *= 1. - afterlightWet * .055;`);
    };
    material.customProgramCacheKey = () => `${previousCacheKeyValue}|afterlight-surface-wetness-v1`;
    material.needsUpdate = true;
    restores.push(() => {
      material.onBeforeCompile = previousCompile;
      material.customProgramCacheKey = previousCacheKey;
      material.needsUpdate = true;
    });
  }

  return {
    update(nextElapsed, nextRain) {
      const elapsed = Math.max(0, nextElapsed);
      const target = THREE.MathUtils.clamp(nextRain, 0, 1);
      if (previousElapsed !== undefined) {
        const delta = Math.max(0, elapsed - previousElapsed);
        // Rain wets over a short interval; a stopped shower takes 90 s to
        // approach dry, so identical paused elapsed values never drift.
        const response = target > rain.value ? 16 : 90;
        rain.value += (target - rain.value) * (1 - Math.exp(-delta / response));
      }
      previousElapsed = elapsed;
    },
    dispose() {
      restores.splice(0).forEach(restore => restore());
    },
  };
}
