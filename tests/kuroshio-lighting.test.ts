import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {animatedStandard, createChromisVisuals} from '../src/creatures/chromis/index.ts';
import {createFusilierVisuals} from '../src/creatures/fusilier/index.ts';

function instanceMeshes(root: THREE.Group): THREE.InstancedMesh[] {
  return root.children.filter((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh);
}

test('Kuroshio schools receive the arcade directional shadow map without becoming shadow casters', () => {
  const chromis = createChromisVisuals(2, new Float32Array([.2, .7]), new Float32Array([.04, .05]));
  const fusilier = createFusilierVisuals(2, new Float32Array([.2, .7]), new Float32Array([.2, .24]));
  for (const mesh of [...instanceMeshes(chromis.root), ...instanceMeshes(fusilier.root)]) {
    assert.equal(mesh.receiveShadow, true, `${mesh.name} samples the surrounding shadow map`);
    assert.equal(mesh.castShadow, false, `${mesh.name} stays out of the school's shadow-render pass`);
    assert.ok(mesh.material instanceof THREE.MeshStandardMaterial, `${mesh.name} retains standard light and shadow support`);
  }
  chromis.dispose();
  fusilier.dispose();
});

test('tail deformation runs before Three.js projects shadow coordinates', () => {
  const material = animatedStandard('#6bc4c1', '#79cdc4');
  const shader = {
    uniforms: {},
    vertexShader: '#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>\n#include <project_vertex>\n#include <shadowmap_vertex>',
    fragmentShader: '',
  } as unknown as THREE.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  const source = shader.vertexShader;
  const deformation = source.indexOf('transformed.x+=aTailAmplitude');
  const projection = source.indexOf('#include <project_vertex>');
  const shadows = source.indexOf('#include <shadowmap_vertex>');
  assert.ok(deformation >= 0, 'tail deformation is injected into the standard vertex path');
  assert.ok(deformation < projection && projection < shadows, 'projected and shadow-map coordinates use the deformed transformed position');
  material.dispose();
});
