import * as THREE from 'three';
import {rainDrops, rainOrigin, rainSample, type RainBlock} from './RainField.ts';
import type {PlantLeaf} from './PlantGeometry.ts';

export interface RainContact {
  leafIndex: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  speed: number;
  mass: number;
  lever: number;
}

interface LeafCollider {
  leaf: PlantLeaf;
  bounds: THREE.Box3;
  inverse: THREE.Matrix4;
  normalMatrix: THREE.Matrix3;
}

const EPSILON = 1e-7;

function dropMass(index: number) {
  const drop = rainDrops[index];
  // The rendered streak width supplies a stable, small water-drop radius.
  const variation = (Math.sin(drop.seed * 17.17) * .5 + .5) * .1;
  const radius = THREE.MathUtils.clamp(drop.width * (.55 + variation), .0003, .00065);
  return 1000 * (4 / 3) * Math.PI * radius ** 3;
}

function createColliders(leaves: readonly PlantLeaf[]): LeafCollider[] {
  return leaves.map(leaf => {
    const geometry = leaf.mesh.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    return {
      leaf,
      bounds: geometry.boundingBox!.clone().applyMatrix4(leaf.mesh.matrixWorld),
      inverse: leaf.mesh.matrixWorld.clone().invert(),
      normalMatrix: new THREE.Matrix3().getNormalMatrix(leaf.mesh.matrixWorld),
    };
  });
}

function firstContact(start: THREE.Vector3, end: THREE.Vector3, colliders: readonly LeafCollider[]) {
  const sweepBounds = new THREE.Box3().setFromPoints([start, end]);
  let nearest: {leafIndex: number; point: THREE.Vector3; normal: THREE.Vector3; localPoint: THREE.Vector3} | undefined;
  let nearestDistance = Infinity;

  colliders.forEach(({leaf, bounds, inverse, normalMatrix}, leafIndex) => {
    if (!bounds.intersectsBox(sweepBounds)) return;
    const positions = leaf.mesh.geometry.getAttribute('position');
    if (!positions) return;
    const startLocal = start.clone().applyMatrix4(inverse);
    const endLocal = end.clone().applyMatrix4(inverse);
    const direction = endLocal.clone().sub(startLocal);
    const localLength = direction.length();
    if (localLength < EPSILON) return;
    const ray = new THREE.Ray(startLocal, direction.multiplyScalar(1 / localLength));
    const index = leaf.mesh.geometry.getIndex();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), hit = new THREE.Vector3();
    const inspect = (ia: number, ib: number, ic: number) => {
      a.fromBufferAttribute(positions, ia); b.fromBufferAttribute(positions, ib); c.fromBufferAttribute(positions, ic);
      const localHit = ray.intersectTriangle(a, b, c, false, hit);
      if (!localHit || startLocal.distanceTo(localHit) > localLength + EPSILON) return;
      const point = localHit.clone().applyMatrix4(leaf.mesh.matrixWorld);
      const distance = start.distanceToSquared(point);
      if (distance >= nearestDistance) return;
      const normal = c.clone().sub(b).cross(a.clone().sub(b)).normalize().applyMatrix3(normalMatrix).normalize();
      nearestDistance = distance;
      nearest = {leafIndex, point, normal, localPoint: localHit.clone()};
    };
    if (index) {
      for (let triangle = 0; triangle < index.count; triangle += 3) inspect(index.getX(triangle), index.getX(triangle + 1), index.getX(triangle + 2));
    } else {
      for (let triangle = 0; triangle < positions.count; triangle += 3) inspect(triangle, triangle + 1, triangle + 2);
    }
  });
  return nearest;
}

export function createRainInteraction(leaves: PlantLeaf[]) {
  const blocks = new Map<number, RainBlock>();

  const collide = (index: number, cycle: number, start: THREE.Vector3, end: THREE.Vector3, colliders: readonly LeafCollider[], contacts: RainContact[]) => {
    if (blocks.get(index)?.cycle === cycle) return;
    const hit = firstContact(start, end, colliders);
    if (!hit) return;
    const leaf = leaves[hit.leafIndex];
    blocks.set(index, {cycle, y: hit.point.y});
    contacts.push({
      leafIndex: hit.leafIndex,
      point: hit.point,
      normal: hit.normal,
      speed: rainDrops[index].speed,
      mass: dropMass(index),
      lever: THREE.MathUtils.clamp(hit.localPoint.y / leaf.tip.y, .1, 1),
    });
  };

  return {
    blocks,
    update(time: number, dt: number, strength: number) {
      if (dt <= 0 || strength <= 0) return [] as RainContact[];
      const colliders = createColliders(leaves);
      const contacts: RainContact[] = [];
      const active = Math.floor(rainDrops.length * THREE.MathUtils.clamp(strength, 0, 1));
      for (let index = 0; index < active; index++) {
        const previous = rainSample(index, time - dt);
        const current = rainSample(index, time);
        const drop = rainDrops[index];
        if (previous.cycle === current.cycle) {
          collide(index, current.cycle, new THREE.Vector3(previous.x, previous.y, previous.z), new THREE.Vector3(current.x, current.y, current.z), colliders, contacts);
          continue;
        }
        let cycle = previous.cycle;
        let start = new THREE.Vector3(previous.x, previous.y, previous.z);
        const bottom = (lap: number) => {
          const origin = rainOrigin(drop.seed, lap);
          return new THREE.Vector3(origin.x + .036, 0, origin.z + .0126);
        };
        const top = (lap: number) => {
          const origin = rainOrigin(drop.seed, lap);
          return new THREE.Vector3(origin.x, 3, origin.z);
        };
        while (cycle < current.cycle) {
          collide(index, cycle, start, bottom(cycle), colliders, contacts);
          cycle++;
          start = top(cycle);
        }
        // A new lap begins at y=3 with its own origin, never as a diagonal
        // segment between two unrelated seeded origins.
        collide(index, current.cycle, start, new THREE.Vector3(current.x, current.y, current.z), colliders, contacts);
      }
      return contacts;
    },
    reset() { blocks.clear(); },
  };
}
