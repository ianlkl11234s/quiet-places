import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FISH_FIN_MEMBRANE, fishSurfaceKey, installFishSurface, prepareFinMembrane} from '../src/shared/biology/fish-surface/index.ts';

function compile(material: THREE.Material) {
  const shader = {uniforms: {}, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader} as unknown as THREE.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader;
}
const body = {role: 'body', countershade: .1, sheen: .25, sheenTint: new THREE.Color(.9, .95, 1)} as const;

test('fish surface chains existing hooks and cache keys, and is idempotent per material', () => {
  const material = new THREE.MeshPhysicalMaterial();
  let previousCalls = 0;
  material.onBeforeCompile = shader => { previousCalls++; shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n// scene fill'); };
  material.customProgramCacheKey = () => 'scene-fill-v2';
  assert.equal(installFishSurface(material, body), true);
  assert.equal(installFishSurface(material, FISH_FIN_MEMBRANE), true, 'second install is a no-op');
  const shader = compile(material);
  assert.equal(previousCalls, 1, 'previous hook ran exactly once');
  assert.ok(shader.fragmentShader.includes('// scene fill'), 'scene fill preserved');
  assert.equal(material.customProgramCacheKey(), `scene-fill-v2|${fishSurfaceKey(body)}`);
  assert.ok(shader.vertexShader.includes('vFishDorsal = normalize( objectNormal ).y;'));
  const sheen = shader.fragmentShader.indexOf('grazing-angle scale sheen'), fill = shader.fragmentShader.indexOf('// scene fill');
  assert.ok(sheen > fill, 'sheen reads reflected light after scene-local fills');
  assert.ok(shader.fragmentShader.includes('diffuseColor.rgb = min( diffuseColor.rgb * ( 1.0 - 0.1000'), 'countershading on albedo');
  assert.equal(installFishSurface(new THREE.MeshBasicMaterial(), body), false, 'unlit materials are ignored');
});

test('no-glow contract: layer only scales received light, never emissive; fins are shadow-aware', () => {
  const bodyShader = compile((() => { const m = new THREE.MeshStandardMaterial(); installFishSurface(m, body); return m; })());
  const bodyAdded = bodyShader.fragmentShader.slice(bodyShader.fragmentShader.indexOf('fish-surface: grazing'));
  assert.ok(/fishLit \* fishFres/.test(bodyAdded), 'sheen is a fraction of shadowed direct + indirect diffuse');
  assert.ok(!/emissive|totalEmissiveRadiance \+=/.test(bodyAdded.slice(0, bodyAdded.indexOf('}'))), 'no emissive term');
  const fin = new THREE.MeshPhysicalMaterial({transmission: .06, transparent: true});
  prepareFinMembrane(fin); installFishSurface(fin, FISH_FIN_MEMBRANE);
  assert.equal(fin.transmission, 0); assert.equal(fin.depthWrite, false);
  const finShader = compile(fin).fragmentShader;
  const occurrences = finShader.split('fishBackLight += directLight.color').length - 1;
  assert.equal(occurrences, 3, 'back light accumulates after every RE_Direct (point, spot, directional), whose colour already carries the shadow term');
  assert.ok(finShader.indexOf('getShadow( directionalShadowMap') < finShader.lastIndexOf('fishBackLight += directLight.color'));
  assert.ok(finShader.includes('reflectedLight.directSpecular *= 0.4000'));
});
