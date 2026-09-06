import * as THREE from 'three';

export type FloorKoiState = {
  intensity: number;
  warmth: number;
  angle: number;
  activity: number;
};

export type FloorKoi = {
  update: (dt: number, elapsed: number, state: FloorKoiState) => void;
  dispose: () => void;
};

type Koi = {
  root: THREE.Group;
  tail: THREE.Group;
  shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  position: THREE.Vector3;
  direction: THREE.Vector3;
  baseHeight: number;
  phase: number;
  speed: number;
  turn: number;
};

const COUNT = 7;
const MIN_X = -3.8;
const MAX_X = 3.8;
const MIN_Z = -3;
const MAX_Z = 3;
const FORWARD = new THREE.Vector3(1, 0, 0);

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function triangle(points: readonly number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Seven low, broad koi that make the floor read as a quiet shallow-water room.
 * Passing dt=0 freezes motion while allowing lighting changes.
 */
export function createFloorKoi(scene: THREE.Scene): FloorKoi {
  const group = new THREE.Group();
  group.name = 'FloorKoi';
  scene.add(group);

  const bodyGeometry = new THREE.SphereGeometry(.5, 20, 12);
  const eyeGeometry = new THREE.SphereGeometry(.014, 8, 6);
  const barbelGeometry = new THREE.CylinderGeometry(.009, .012, .16, 6);
  const finGeometry = triangle([0, 0, 0, -.16, .025, .12, -.09, -.005, .025]);
  const tailGeometry = triangle([0, 0, 0, -.20, .008, .14, -.12, .004, 0]);
  const shadowGeometry = new THREE.PlaneGeometry(1, 1);
  const finMaterial = new THREE.MeshStandardMaterial({
    color: 0xe5d7be, roughness: .42, transparent: true, opacity: .68, side: THREE.DoubleSide,
    depthWrite: false, emissive: 0x1c130b, emissiveIntensity: .055,
  });
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: .45 });
  const shadowMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true,
    uniforms: { uOpacity: { value: .2 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 vUv; uniform float uOpacity; void main(){float r=length(vUv-.5)*2.; float a=(1.-smoothstep(.12,1.,r))*uOpacity; gl_FragColor=vec4(.015,.022,.020,a);}',
  });
  const resources: THREE.BufferGeometry[] = [bodyGeometry, eyeGeometry, barbelGeometry, finGeometry, tailGeometry, shadowGeometry];
  const materials: THREE.Material[] = [finMaterial, eyeMaterial, shadowMaterial];
  const bodyMaterials: THREE.MeshStandardMaterial[] = [];
  const random = seededRandom(0xf1007);
  const koi: Koi[] = [];

  const createBodyMaterial = (seed: number) => {
    const material = new THREE.MeshStandardMaterial({
      color: 0xf0e7d6, roughness: .58, metalness: .03, emissive: 0x21170f, emissiveIntensity: .075,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uKoiSeed = { value: seed };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vKoiLocal;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvKoiLocal = position;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vKoiLocal; uniform float uKoiSeed;
float koiBlob(vec2 p, vec2 center, vec2 radius) {
  vec2 q = (p - center) / radius;
  return 1.0 - smoothstep(.56, 1.0, dot(q, q));
}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
vec2 koiP = vKoiLocal.xz;
float orange = max(koiBlob(koiP, vec2(.17 + fract(uKoiSeed * 3.1) * .12, (fract(uKoiSeed * 7.7) - .5) * .22), vec2(.18, .19)), koiBlob(koiP, vec2(-.22, (fract(uKoiSeed * 11.3) - .5) * .20), vec2(.15, .15)));
float black = max(koiBlob(koiP, vec2(-.02 + (fract(uKoiSeed * 17.1) - .5) * .18, (fract(uKoiSeed * 5.3) - .5) * .26), vec2(.095, .105)), koiBlob(koiP, vec2(-.36, .08), vec2(.065, .075)));
vec3 koiColor = mix(vec3(1.0, .94, .84), vec3(.86, .28, .07), orange);
koiColor = mix(koiColor, vec3(.035, .042, .043), black * (1.0 - orange * .36));
diffuseColor.rgb *= koiColor;`);
    };
    materials.push(material);
    bodyMaterials.push(material);
    return material;
  };

  for (let index = 0; index < COUNT; index += 1) {
    const root = new THREE.Group();
    const length = .88 + random() * .22;
    const width = length * (.36 + random() * .05);
    const height = length * .19;
    const body = new THREE.Mesh(bodyGeometry, createBodyMaterial(random()));
    body.scale.set(length, height, width);
    body.castShadow = true;
    body.receiveShadow = true;
    root.add(body);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      eye.position.set(length * .32, height * .12, side * width * .32);
      root.add(eye);
      const barbel = new THREE.Mesh(barbelGeometry, finMaterial);
      barbel.position.set(length * .43, -height * .05, side * width * .12);
      barbel.rotation.z = side * .86;
      barbel.rotation.x = side * .16;
      root.add(barbel);
      const pectoral = new THREE.Mesh(finGeometry, finMaterial);
      pectoral.position.set(length * .02, -height * .38, side * width * .42);
      pectoral.scale.setScalar(.68);
      pectoral.rotation.x = side * Math.PI / 2;
      pectoral.rotation.z = side * .18;
      root.add(pectoral);
    }
    const dorsal = new THREE.Mesh(finGeometry, finMaterial);
    dorsal.position.set(-length * .04, height * .46, 0);
    dorsal.scale.setScalar(.7);
    dorsal.rotation.z = Math.PI / 2;
    root.add(dorsal);
    const tail = new THREE.Group();
    tail.position.x = -length * .50;
    const tailA = new THREE.Mesh(tailGeometry, finMaterial);
    const tailB = new THREE.Mesh(tailGeometry, finMaterial);
    tailA.rotation.x = Math.PI / 2;
    tailB.rotation.x = -Math.PI / 2;
    tail.add(tailA, tailB);
    root.add(tail);

    // Opacity is per fish: a higher fish leaves a lighter contact shadow.
    const fishShadowMaterial = shadowMaterial.clone();
    materials.push(fishShadowMaterial);
    const shadow = new THREE.Mesh(shadowGeometry, fishShadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.renderOrder = 2;
    shadow.scale.set(length * 2.05, width * 1.85, 1);
    group.add(shadow, root);
    const position = new THREE.Vector3(THREE.MathUtils.lerp(MIN_X, MAX_X, random()), .24 + random() * .16, THREE.MathUtils.lerp(MIN_Z, MAX_Z, random()));
    const direction = new THREE.Vector3(random() - .5, 0, random() - .5).normalize();
    root.position.copy(position);
    root.quaternion.setFromUnitVectors(FORWARD, direction);
    shadow.position.set(position.x, .096, position.z);
    koi.push({ root, tail, shadow, position, direction, baseHeight: position.y, phase: random() * Math.PI * 2, speed: .13 + random() * .08, turn: random() * Math.PI * 2 });
  }

  const desired = new THREE.Vector3();
  const targetQuaternion = new THREE.Quaternion();
  const glow = new THREE.Color();
  let disposed = false;
  return {
    update(dt, elapsed, state) {
      const step = THREE.MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, .05);
      if (disposed) return;
      const activity = THREE.MathUtils.clamp(state.activity || 0, 0, 1);
      const intensity = THREE.MathUtils.clamp(state.intensity || 0, 0, 1.5);
      const warmth = THREE.MathUtils.clamp(state.warmth || 0, 0, 1);
      const angle = Number.isFinite(state.angle) ? state.angle : 0;
      // Lighting still follows the selected time while paused; only movement is frozen.
      glow.setRGB(THREE.MathUtils.lerp(.06, .18, warmth), THREE.MathUtils.lerp(.05, .10, warmth), .035);
      bodyMaterials.forEach((material) => {
        material.emissive.copy(glow);
        material.emissiveIntensity = .045 + intensity * .045;
      });
      if (step === 0) return;
      const motion = .42 + activity * .72;
      for (const fish of koi) {
        const bend = Math.sin(elapsed * (.31 + activity * .16) + fish.phase) * .82 + Math.sin(elapsed * .17 + fish.turn) * .36;
        desired.set(Math.cos(bend + angle * .18), 0, Math.sin(bend + angle * .18)).normalize();
        fish.direction.lerp(desired, 1 - Math.exp(-step * (.55 + activity * 1.5))).normalize();
        fish.position.addScaledVector(fish.direction, fish.speed * motion * step);
        // Reflect the heading at the room bounds rather than teleporting across its empty centre.
        if (fish.position.x < MIN_X || fish.position.x > MAX_X) { fish.position.x = THREE.MathUtils.clamp(fish.position.x, MIN_X, MAX_X); fish.direction.x *= -1; }
        if (fish.position.z < MIN_Z || fish.position.z > MAX_Z) { fish.position.z = THREE.MathUtils.clamp(fish.position.z, MIN_Z, MAX_Z); fish.direction.z *= -1; }
        fish.position.y = THREE.MathUtils.clamp(fish.baseHeight + Math.sin(elapsed * .68 + fish.phase) * .008, .16, .45);
        fish.root.position.copy(fish.position);
        targetQuaternion.setFromUnitVectors(FORWARD, fish.direction);
        fish.root.quaternion.slerp(targetQuaternion, 1 - Math.exp(-step * 3.2));
        fish.tail.rotation.y = Math.sin(elapsed * (3.3 + activity * 2.8) + fish.phase) * (.17 + activity * .14);
        fish.shadow.position.set(fish.position.x, .096, fish.position.z);
        fish.shadow.material.uniforms.uOpacity.value = .14 + (1 - fish.position.y / .45) * .17;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(group);
      resources.forEach((resource) => resource.dispose());
      materials.forEach((material) => material.dispose());
    },
  };
}
