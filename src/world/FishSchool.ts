import * as THREE from 'three';

export type FishSchoolState = {
  intensity: number;
  warmth: number;
  angle: number;
  activity: number;
};

export type FishSchool = {
  update: (dt: number, elapsed: number, state: FishSchoolState) => void;
  dispose: () => void;
};

type Fish = {
  root: THREE.Group;
  tail: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  phase: number;
  speed: number;
};

const COUNT = 9;
const MIN = new THREE.Vector3(-2.8, 2.4, -3);
const MAX = new THREE.Vector3(2.8, 5.7, 1.5);
const FORWARD = new THREE.Vector3(1, 0, 0);

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function triangle(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z,
  ], 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createFish(index: number, random: () => number): Fish {
  const root = new THREE.Group();
  const length = 0.25 + random() * 0.25;
  const height = length * (0.22 + random() * 0.05);
  const gold = index >= COUNT - 2;
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: gold ? 0xa88e58 : (index % 3 === 0 ? 0xd8d2c4 : 0xbfc3c1),
    roughness: 0.62,
    metalness: gold ? 0.16 : 0.28,
  });
  const finMaterial = new THREE.MeshStandardMaterial({
    color: gold ? 0xb89a61 : 0xd8ded8,
    roughness: 0.48,
    metalness: 0.12,
    transparent: true,
    opacity: 0.46,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // A gently elongated ellipsoid gives a soft tapered head and tail without assets.
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), bodyMaterial);
  body.scale.set(length, height, height * 0.72);
  root.add(body);

  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x262826, roughness: 0.72 });
  const eyeGeometry = new THREE.SphereGeometry(length * 0.045, 8, 6);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eye.position.set(length * 0.35, height * 0.16, side * height * 0.62);
    root.add(eye);
  }

  const dorsal = new THREE.Mesh(
    triangle(new THREE.Vector3(-length * 0.12, height * 0.42, 0), new THREE.Vector3(-length * 0.34, height * 0.98, 0), new THREE.Vector3(length * 0.2, height * 0.4, 0)),
    finMaterial,
  );
  root.add(dorsal);

  const pectoral = new THREE.Mesh(
    triangle(new THREE.Vector3(length * 0.1, -height * 0.04, height * 0.55), new THREE.Vector3(-length * 0.06, -height * 0.72, height * 1.05), new THREE.Vector3(-length * 0.17, -height * 0.08, height * 0.35)),
    finMaterial,
  );
  root.add(pectoral);

  const tail = new THREE.Group();
  tail.position.x = -length * 0.52;
  const tailTop = new THREE.Mesh(
    triangle(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-length * 0.48, height * 1.15, 0), new THREE.Vector3(-length * 0.28, height * 0.08, 0)),
    finMaterial,
  );
  const tailBottom = new THREE.Mesh(
    triangle(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-length * 0.48, -height * 1.15, 0), new THREE.Vector3(-length * 0.28, -height * 0.08, 0)),
    finMaterial,
  );
  tail.add(tailTop, tailBottom);
  root.add(tail);

  const position = new THREE.Vector3(
    THREE.MathUtils.lerp(MIN.x, MAX.x, random()),
    THREE.MathUtils.lerp(MIN.y, MAX.y, random()),
    THREE.MathUtils.lerp(MIN.z, MAX.z, random()),
  );
  const velocity = new THREE.Vector3(random() - 0.5, (random() - 0.5) * 0.28, random() - 0.5).normalize();
  root.position.copy(position);
  root.quaternion.setFromUnitVectors(FORWARD, velocity);
  return { root, tail, position, velocity, phase: random() * Math.PI * 2, speed: 0.22 + random() * 0.12 };
}

export function createFishSchool(scene: THREE.Scene): FishSchool {
  const group = new THREE.Group();
  group.name = 'FishSchool';
  scene.add(group);
  const random = seededRandom(0x51f15);
  const fish = Array.from({ length: COUNT }, (_, index) => createFish(index, random));
  fish.forEach(({ root }) => group.add(root));

  const desired = new THREE.Vector3();
  const center = new THREE.Vector3();
  const separation = new THREE.Vector3();
  const wander = new THREE.Vector3();
  const lightTarget = new THREE.Vector3();
  const nextVelocity = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const separationVector = new THREE.Vector3();
  const lightDirection = new THREE.Vector3();
  const targetQuaternion = new THREE.Quaternion();

  return {
    update(dt, elapsed, state) {
      const step = THREE.MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
      if (step === 0) return;
      const activity = THREE.MathUtils.clamp(state.activity || 0, 0, 1);
      const intensity = THREE.MathUtils.clamp(state.intensity || 0, 0, 1);
      const angle = Number.isFinite(state.angle) ? state.angle : 0;
      // The fish drift slightly toward the illuminated part of the room, while room lights remain their only illumination.
      const warmth = THREE.MathUtils.clamp(state.warmth || 0, 0, 1);
      lightTarget.set((-.45 + Math.sin(angle)*.14) * 2.6, 4.4 + (warmth - 0.5) * 0.2, -.2 + (-.30 + Math.sin(angle*.7)*.10) * 2.6);

      for (let i = 0; i < fish.length; i += 1) {
        const current = fish[i];
        center.set(0, 0, 0);
        separation.set(0, 0, 0);
        let neighbours = 0;
        for (let j = 0; j < fish.length; j += 1) {
          if (i === j) continue;
          const other = fish[j];
          const distanceSq = current.position.distanceToSquared(other.position);
          if (distanceSq < 2.4) {
            center.add(other.position);
            neighbours += 1;
            if (distanceSq < 0.65 && distanceSq > 0.0001) {
              separationVector.copy(current.position).sub(other.position);
              separation.addScaledVector(separationVector, 1 / distanceSq);
            }
          }
        }
        desired.copy(current.velocity).multiplyScalar(0.45);
        if (neighbours) {
          center.multiplyScalar(1 / neighbours).sub(current.position).multiplyScalar(0.10);
          desired.add(center).addScaledVector(separation, 0.15);
        }
        wander.set(
          Math.sin(elapsed * 0.47 + current.phase),
          Math.sin(elapsed * 0.31 + current.phase * 1.7) * 0.32,
          Math.cos(elapsed * 0.39 + current.phase * 0.7),
        ).multiplyScalar(0.13 + activity * 0.09);
        lightDirection.copy(lightTarget).sub(current.position);
        desired.add(wander).addScaledVector(lightDirection, 0.035 + intensity * 0.035);
        for (const axis of ['x', 'y', 'z'] as const) {
          const margin = 0.42;
          if (current.position[axis] < MIN[axis] + margin) desired[axis] += (MIN[axis] + margin - current.position[axis]) * 0.65;
          if (current.position[axis] > MAX[axis] - margin) desired[axis] -= (current.position[axis] - (MAX[axis] - margin)) * 0.65;
        }
        if (desired.lengthSq() < 0.0001) desired.copy(current.velocity);
        desired.normalize();
        nextVelocity.copy(current.velocity).lerp(desired, 1 - Math.exp(-step * (1.8 + activity * 2.2))).normalize();
        current.velocity.copy(nextVelocity);
        current.position.addScaledVector(current.velocity, current.speed * (0.65 + activity * 0.85) * step);
        current.position.clamp(MIN, MAX);
        current.root.position.copy(current.position);
        direction.copy(current.velocity);
        targetQuaternion.setFromUnitVectors(FORWARD, direction);
        current.root.quaternion.slerp(targetQuaternion, 1 - Math.exp(-step * 5));
        current.tail.rotation.y = Math.sin(elapsed * (4.2 + activity * 3.8) + current.phase) * (0.22 + activity * 0.18);
      }
    },
    dispose() {
      group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else if (material) material.dispose();
      });
      scene.remove(group);
    },
  };
}
