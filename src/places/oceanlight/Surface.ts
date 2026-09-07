import type {SceneState} from '../../player/contracts.ts';
import * as THREE from 'three';

// Visual reference: achrefelouafi/OceanThreejs (MIT), da18e925.
// Independent analytic approximation; source and boundaries: docs/scenes/oceanlight.md.

export type OceanSurfaceState = SceneState;

import {oceanSunDirection} from './Sun.ts';
import {oceanWaveGLSL} from '../../shared/water/Optics.ts';

const oceanSkyGLSL = /* glsl */`
  vec3 skyColor(vec3 d) {
    float up = clamp(d.y, 0.0, 1.0);
    float warm = clamp(uWarmth, 0.0, 1.0);
    vec3 horizon = mix(vec3(.23, .39, .49), vec3(.77, .61, .43), warm);
    vec3 zenith = mix(vec3(.035, .12, .24), vec3(.30, .30, .38), warm);
    vec3 col = mix(horizon, zenith, pow(up, .45));
    vec3 sun = uSunDirection;
    col += vec3(1.0, .76, .46) * pow(max(dot(d, sun), 0.0), 360.0) * (.35 + uIntensity*.5);
    return col * (.035 + uIntensity*.965);
  }
`;

const oceanVertex = /* glsl */`
  uniform float uTime;
  uniform float uLevel;
  varying vec3 vWorld;
  ${oceanWaveGLSL}
  void main() {
    vec3 p = position;
    p.y = uLevel + oceanHeight(p.xz, uTime);
    vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;

const oceanFragment = /* glsl */`
  uniform float uTime;
  uniform float uWarmth;
  uniform float uIntensity;
  uniform float uAngle; uniform vec3 uSunDirection;
  uniform float uActivity;
  varying vec3 vWorld;
  ${oceanWaveGLSL}

  float D_GGX(float NoH, float a) { float a2=a*a; float d=NoH*NoH*(a2-1.0)+1.0; return a2 / max(3.14159*d*d, .0001); }
  float G1(float NoX, float k) { return NoX / mix(NoX, 1.0, k); }
  ${oceanSkyGLSL}
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorld);
    vec2 micro = vec2(
      sin(dot(vWorld.xz, vec2(4.7, 3.1)) - uTime*1.8) + sin(dot(vWorld.xz, vec2(-7.2, 5.6)) + uTime*2.1),
      sin(dot(vWorld.xz, vec2(3.9, -6.4)) + uTime*1.6) + sin(dot(vWorld.xz, vec2(8.1, 2.5)) - uTime*2.3)
    ) * (.010 + uActivity*.018);
    vec2 baseSlope=oceanSlope(vWorld.xz,uTime);
    float detailFade=1.-smoothstep(30.,200.,length(cameraPosition-vWorld));
    vec3 normal = normalize(vec3(-baseSlope.x,1.,-baseSlope.y)+vec3(micro.x,0.,micro.y)*detailFade);
    if(!gl_FrontFacing)normal=-normal;
    vec3 reflected = reflect(-viewDir, normal);
    float NoV = max(dot(normal, viewDir), 0.0);
    float fresnel = .025 + .975 * pow(1.0 - NoV, 5.0);
    vec3 deep = mix(vec3(.025, .080, .086), vec3(.055, .15, .15), uWarmth*.28);
    vec3 reflectedSky = skyColor(reflected);
    vec3 sun = uSunDirection;
    vec3 halfDir = normalize(viewDir + sun);
    float NoL = max(dot(normal, sun), 0.0);
    float roughness = mix(.18, .095, clamp(uActivity, 0.0, 1.0));
    float alpha = roughness * roughness;
    float spec = D_GGX(max(dot(normal, halfDir), 0.0), alpha) * G1(NoV, alpha*.5) * G1(NoL, alpha*.5);
    vec2 slope = oceanSlope(vWorld.xz, uTime);
    float crest = smoothstep(.024, .052, length(slope));
    float foamNoise = .5+.25*sin(dot(vWorld.xz,vec2(2.1,1.7))+uTime*.28)+.25*sin(dot(vWorld.xz,vec2(-3.8,2.4))-uTime*.19);
    float foam = crest * smoothstep(.72, .96, foamNoise) * (.08 + uActivity*.20);
    deep*=.04+uIntensity*.96;
    vec3 color = mix(deep, reflectedSky, fresnel) + vec3(1.0, .78, .48) * spec * NoL * (.025 + uIntensity*.08);
    color = mix(color, vec3(.70, .84, .82)*(.06+uIntensity*.94), foam);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const skyVertex = /* glsl */`
  varying vec3 vWorld;
  void main(){ vWorld=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0); }
`;

const skyFragment = /* glsl */`
  uniform float uWarmth; uniform float uIntensity; uniform float uAngle; uniform vec3 uSunDirection;
  varying vec3 vWorld;
  ${oceanSkyGLSL}
  void main(){
    gl_FragColor=vec4(skyColor(normalize(vWorld-cameraPosition)),1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function oceanGeometry(): THREE.BufferGeometry {
  // Dense at the sill and progressively sparse at the horizon: 115,200 triangles.
  const columns = 160, rows = 360, front = -5.14, depth = 620, width = 760;
  const positions = new Float32Array((columns + 1) * (rows + 1) * 3);
  let p = 0;
  for (let z = 0; z <= rows; z++) {
    const distance = depth * Math.pow(z / rows, 1.82);
    for (let x = 0; x <= columns; x++) {
      const center=x / columns * 2 - 1;
      positions[p++] = Math.sign(center)*Math.pow(Math.abs(center),2.3)*width*.5;
      positions[p++] = 0;
      positions[p++] = front - distance;
    }
  }
  const indices = new Uint32Array(columns * rows * 6); let i = 0;
  for (let z = 0; z < rows; z++) for (let x = 0; x < columns; x++) {
    const a=z*(columns+1)+x, b=a+1, c=a+columns+1, d=c+1;
    indices[i++]=a; indices[i++]=b; indices[i++]=c; indices[i++]=b; indices[i++]=d; indices[i++]=c;
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return geometry;
}

export function createOceanSurface(group: THREE.Group) {
  const root = new THREE.Group(); root.name = 'ocean-surface-exterior'; group.add(root);
  const uniforms = {uSunDirection:{value:oceanSunDirection(0)},uTime:{value:0},uLevel:{value:1.75},uWarmth:{value:.2},uIntensity:{value:.7},uAngle:{value:0},uActivity:{value:.2}};
  const material = new THREE.ShaderMaterial({uniforms, vertexShader:oceanVertex, fragmentShader:oceanFragment, side:THREE.DoubleSide});
  const sea = new THREE.Mesh(oceanGeometry(), material); sea.name = 'ocean-surface'; root.add(sea);
  const skyMaterial = new THREE.ShaderMaterial({uniforms:{uSunDirection:uniforms.uSunDirection,uWarmth:uniforms.uWarmth,uIntensity:uniforms.uIntensity,uAngle:uniforms.uAngle},vertexShader:skyVertex,fragmentShader:skyFragment,side:THREE.DoubleSide,depthWrite:false});
  // A deep backdrop has no foreground sphere surface, so room depth still occludes it.
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1200, 650), skyMaterial); sky.name='ocean-sky-backdrop'; sky.position.set(0, 150, -450); root.add(sky);
  let disposed = false;
  return {
    update(elapsed: number, state: OceanSurfaceState, level: number) {
      uniforms.uSunDirection.value.copy(oceanSunDirection(state.angle));
      uniforms.uTime.value=elapsed; uniforms.uLevel.value=level; uniforms.uIntensity.value=Math.max(.08,state.intensity); uniforms.uWarmth.value=state.warmth; uniforms.uAngle.value=state.angle; uniforms.uActivity.value=state.lowQuality ? state.activity*.45 : state.activity;
    },
    dispose() { if (disposed) return; disposed=true; group.remove(root); sea.geometry.dispose(); material.dispose(); sky.geometry.dispose(); skyMaterial.dispose(); },
  };
}
