import * as THREE from 'three';
import {oceanWaveGLSL} from '../../shared/water/Optics.ts';

export interface ArcadeSea {
  update(elapsed: number): void;
  dispose(): void;
}

function waterMaterial(source: THREE.MeshStandardMaterial, time: THREE.IUniform<number>): THREE.MeshPhysicalMaterial {
  const color = source.color.clone(); // Linear water tint is authored in the Blender source.
  const material = new THREE.MeshPhysicalMaterial({
    name: source.name,
    color,
    map: source.map,
    normalMap: source.normalMap,
    normalScale: source.normalScale.clone(),
    aoMap: source.aoMap,
    aoMapIntensity: source.aoMapIntensity,
    alphaMap: source.alphaMap,
    alphaTest: source.alphaTest,
    transparent: source.transparent,
    opacity: source.opacity,
    side: source.side,
    depthWrite: source.depthWrite,
    depthTest: source.depthTest,
    vertexColors: source.vertexColors,
    fog: source.fog,
    metalness: 0,
    roughness: .22,
    ior: 1.333,
    envMap: source.envMap,
    envMapIntensity: .9,
  });
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.(shader, renderer);
    shader.uniforms.uArcadeSeaTime = time;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vArcadeSeaWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvArcadeSeaWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
uniform float uArcadeSeaTime;
varying vec3 vArcadeSeaWorld;
${oceanWaveGLSL}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
// The shared field supplies an exterior water slope in world metres. Convert it
// through viewMatrix before blending with Three's view-space shading normal.
vec2 arcadeSeaSlope=oceanSlope(vArcadeSeaWorld.xz,uArcadeSeaTime);
vec3 arcadeSeaWorldNormal=normalize(vec3(-arcadeSeaSlope.x,1.,-arcadeSeaSlope.y));
vec3 arcadeSeaViewNormal=normalize(mat3(viewMatrix)*arcadeSeaWorldNormal);
normal=normalize(mix(normal,arcadeSeaViewNormal,.42));`);
  };
  material.customProgramCacheKey = () => 'last-arcade-sea-physical-wave-v1';
  material.needsUpdate = true;
  return material;
}

/**
 * Replaces only GLB materials named `arcade-sea`; the exported sea geometry,
 * horizon and water level remain owned by the model. No caustic or new clock is
 * introduced: elapsed is supplied by the host scene.
 */
export function installArcadeSea(root: THREE.Object3D): ArcadeSea {
  const time = {value: 0};
  const restores: Array<() => void> = [];
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const original = object.material;
    const originals = Array.isArray(original) ? original : [original];
    if (!originals.some(material => material.name === 'arcade-sea')) return;
    const replacements = originals.map(material => material.name === 'arcade-sea' && material instanceof THREE.MeshStandardMaterial
      ? waterMaterial(material, time)
      : material);
    object.material = Array.isArray(original) ? replacements : replacements[0];
    restores.push(() => {
      object.material = original;
      replacements.forEach((material, index) => { if (material !== originals[index]) material.dispose(); });
    });
  });
  return {
    update(elapsed: number) { time.value = Number.isFinite(elapsed) ? elapsed : 0; },
    dispose() { restores.splice(0).forEach(restore => restore()); },
  };
}
