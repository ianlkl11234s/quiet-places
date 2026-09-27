import * as THREE from 'three';

/**
 * Shared fish surface layer (Q1-4 candidate). Chained onto an existing
 * MeshStandardMaterial / MeshPhysicalMaterial with onBeforeCompile; it never
 * replaces a previous hook and extends the program cache key.
 *
 * No-glow rule (MASTER): every term only reshapes light the surface already
 * received (shadowed direct + indirect diffuse), so a fish in shadow or under
 * moonlight gets no extra radiance. Nothing is emissive. All values are art
 * calibration, not measured optics.
 *
 * Frame: object-space normal, dorsal = +Y (true for koi, long-fin koi, medaka
 * GLBs and the instanced Kuroshio fish; skinned normals are used after skinning).
 */
export interface FishBodySurface {
  role: 'body';
  /** Countershading 0..~.2: albedo x (1 - c*dorsalness); mean-neutral over the body. */
  countershade: number;
  /** View-dependent scale sheen, 0..~.4: fraction of received diffuse added at grazing angles. */
  sheen: number;
  /** Linear RGB tint of the sheen (hue shift of silvery guanine/iridophores). */
  sheenTint: THREE.ColorRepresentation;
}

export interface FishFinSurface {
  role: 'fin';
  /** Alpha multiplier when the membrane is seen face-on (grazing view keeps 1). */
  faceAlpha: number;
  /** Shadow-aware light through the thin membrane from behind, fraction of diffuse albedo. */
  translucency: number;
  /** Multiplier on the fin's specular lobes (thin membranes: fewer bloom glints). */
  specular: number;
  /** Multiplier on front-lit diffuse: part of the light passes through a thin membrane. */
  diffuse: number;
}

export type FishSurface = FishBodySurface | FishFinSurface;

const installed = new WeakSet<THREE.Material>();
const f = (value: number) => (Number.isFinite(value) ? value : 0).toFixed(4);
const RE_DIRECT = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';

function bodyChunks(surface: FishBodySurface) {
  const tint = new THREE.Color(surface.sheenTint);
  return {
    color: `
  // fish-surface: countershading (dorsal darker, belly lighter), albedo only.
  diffuseColor.rgb = min( diffuseColor.rgb * ( 1.0 - ${f(surface.countershade)} * clamp( vFishDorsal, -1.0, 1.0 ) ), vec3( 1.0 ) );`,
    post: `
  // fish-surface: grazing-angle scale sheen, proportional to light actually received.
  {
    float fishNV = saturate( dot( normal, geometryViewDir ) );
    float fishFres = pow( 1.0 - fishNV, 3.0 );
    vec3 fishLit = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
    float fishSoft = 1.0 / ( 1.0 + dot( fishLit, vec3( .2126, .7152, .0722 ) ) );
    reflectedLight.directSpecular += fishLit * fishFres * fishSoft * ${f(surface.sheen)} * vec3( ${f(tint.r)}, ${f(tint.g)}, ${f(tint.b)} );
  }`,
  };
}

function finChunks(surface: FishFinSurface) {
  return {
    color: '',
    post: `
  // fish-surface fin: specular trimmed, shadow-aware back-light through the membrane,
  // face-on membranes more transparent than at grazing view.
  reflectedLight.directDiffuse *= ${f(surface.diffuse)};
  reflectedLight.directSpecular *= ${f(surface.specular)};
  reflectedLight.indirectSpecular *= ${f(surface.specular)};
  reflectedLight.directDiffuse += fishBackLight * BRDF_Lambert( diffuseColor.rgb ) * ${f(surface.translucency)};
  diffuseColor.a *= mix( ${f(surface.faceAlpha)}, 1.0, pow( 1.0 - saturate( abs( dot( normal, geometryViewDir ) ) ), 2.0 ) );`,
  };
}

export function fishSurfaceKey(surface: FishSurface): string {
  return surface.role === 'body'
    ? `fish-surface-v1:body:${f(surface.countershade)}:${f(surface.sheen)}:${new THREE.Color(surface.sheenTint).getHexString()}`
    : `fish-surface-v1:fin:${f(surface.faceAlpha)}:${f(surface.translucency)}:${f(surface.specular)}:${f(surface.diffuse)}`;
}

/**
 * Adds the layer to `material` (Standard/Physical only; others are ignored and
 * return false). Idempotent per material instance (clones are not installed). Chains any existing onBeforeCompile
 * and cache key, so it may be installed before or after scene-local fills.
 */
export function installFishSurface(material: THREE.Material, surface: FishSurface): boolean {
  if (!(material instanceof THREE.MeshStandardMaterial)) return false;
  if (installed.has(material)) return true;
  installed.add(material);
  const key = fishSurfaceKey(surface);
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey;
  const chunks = surface.role === 'body' ? bodyChunks(surface) : finChunks(surface);
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vFishDorsal;')
      .replace('#include <skinnormal_vertex>', '#include <skinnormal_vertex>\nvFishDorsal = normalize( objectNormal ).y;');
    let fragment = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFishDorsal;')
      .replace('#include <color_fragment>', `#include <color_fragment>${chunks.color}`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>${chunks.post}`);
    if (surface.role === 'fin') {
      fragment = fragment.replace('#include <lights_fragment_begin>',
        `vec3 fishBackLight = vec3( 0.0 );\n${THREE.ShaderChunk.lights_fragment_begin.split(RE_DIRECT).join(`${RE_DIRECT}\n\t\tfishBackLight += directLight.color * saturate( dot( -geometryNormal, directLight.direction ) );`)}`);
    }
    shader.fragmentShader = fragment;
  };
  material.customProgramCacheKey = () => `${previousKey.call(material)}|${key}`;
  material.needsUpdate = true;
  return true;
}

/** Fin membranes: no screen-space transmission pass (it produced bright fin rims); alpha only. */
export function prepareFinMembrane(material: THREE.Material): void {
  material.transparent = true;
  material.depthWrite = false;
  if (material instanceof THREE.MeshPhysicalMaterial) material.transmission = 0;
  material.needsUpdate = true;
}

/** Per-consumer presets (art calibration; each can be reverted by not installing it). */
export const FISH_FIN_MEMBRANE: FishFinSurface = {role: 'fin', faceAlpha: .75, translucency: .25, specular: .4, diffuse: .75};
