import * as THREE from 'three';
import {seededRandom} from '../../shared/math/seededRandom.ts';

export interface PlantJoint {
  object: THREE.Object3D;
  parentIndex: number;
  kind: 'stem' | 'branch' | 'petiole' | 'leaf' | 'weed';
  rest: THREE.Quaternion;
}

export interface PlantLeaf {
  jointIndex: number;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  /** The mesh-local end point used by the wind and physics bridge. */
  tip: THREE.Vector3;
  area: number;
  seed: number;
  baseRoughness: number;
}

export interface PlantGeometry {
  root: THREE.Group;
  joints: PlantJoint[];
  leaves: PlantLeaf[];
  dispose(): void;
}

const UP = new THREE.Vector3(0, 1, 0);
const MAIN_ROOT = new THREE.Vector3(1.698, -.024, -.38);
const WEED_Z = [-.82, -.56, -.31, .24, 1.55] as const;

function localSegment(
  parent: THREE.Object3D, length: number, baseRadius: number, tipRadius: number,
  material: THREE.MeshStandardMaterial, geometries: Set<THREE.BufferGeometry>,
) {
  const geometry = new THREE.CylinderGeometry(tipRadius, baseRadius, length, 7, 1, false);
  geometries.add(geometry);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = length * .5;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
}

function createLeafGeometry(length: number, width: number, bowl: number, droop: number, asymmetry: number, twist: number, defect: number | null) {
  const along = 12;
  const across = 6;
  const positions: number[] = [];
  const indices: number[] = [];
  const point = (u: number, v: number) => {
    const widthCurve = Math.sin(Math.PI * u) ** .72;
    let edge = v * width * widthCurve * (1 + Math.sign(v) * asymmetry)*(1+.008*Math.sin(u*49+asymmetry*30));
    if (defect !== null && u > .42 && u < .64 && Math.sign(v) === Math.sign(defect)) {
      edge *= .76;
    }
    const y = length * u;
    const twistAngle = twist * u;
    const z = .00035*Math.exp(-v*v*120)*Math.sin(Math.PI*u) -droop * u * u + bowl * widthCurve * (1 - Math.abs(v) ** 1.6) - Math.abs(v) * .0015 + edge * Math.sin(twistAngle);
    positions.push(edge * Math.cos(twistAngle), y, z);
  };
  for (let row = 0; row <= along; row++) {
    for (let column = 0; column <= across; column++) point(row / along, column / across * 2 - 1);
  }
  for (let row = 0; row < along; row++) for (let column = 0; column < across; column++) {
    const a = row * (across + 1) + column;
    indices.push(a, a + 1, a + across + 1, a + 1, a + across + 2, a + across + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return {geometry, tip: new THREE.Vector3(0, length, -droop)};
}

function orientToward(object: THREE.Object3D, direction: THREE.Vector3) {
  object.quaternion.setFromUnitVectors(UP, direction.normalize());
  return object.quaternion.clone();
}

/**
 * A deliberately sparse, original broad-leaf pioneer plant.  It is a hierarchy,
 * rather than a baked bush: every reported joint is attached to its parent and
 * keeps its undisturbed local rotation for a future physics message bridge.
 */
export function createPlantGeometry(): PlantGeometry {
  const root = new THREE.Group();
  root.name = 'afterlight-pioneer-plants';
  root.position.copy(MAIN_ROOT);
  const joints: PlantJoint[] = [];
  const leaves: PlantLeaf[] = [];
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const random = seededRandom(0x41f7c9a1);
  const stemMaterial = new THREE.MeshStandardMaterial({color: 0x52603b, roughness: .88});
  const branchMaterial = new THREE.MeshStandardMaterial({color: 0x627043, roughness: .84});
  materials.add(stemMaterial); materials.add(branchMaterial);

  const addJoint = (object: THREE.Object3D, parent: THREE.Object3D, parentIndex: number, kind: PlantJoint['kind']) => {
    parent.add(object);
    const joint = {object, parentIndex, kind, rest: object.quaternion.clone()};
    joints.push(joint);
    return joints.length - 1;
  };
  const addLeaf = (parent: THREE.Object3D, parentIndex: number, direction: THREE.Vector3, length: number, width: number, phase: number, defect: number | null) => {
    parent.updateWorldMatrix(true, false);
    // Keep all foliage on the open, light-facing side of the wall.  Directions
    // arrive in the parent frame; turn them into world space, constrain their
    // wall-normal component, then return to the same parent frame.
    const parentWorld = parent.getWorldQuaternion(new THREE.Quaternion());
    const parentWorldPosition = parent.getWorldPosition(new THREE.Vector3());
    const petioleWorldDirection = direction.clone().applyQuaternion(parentWorld);
    petioleWorldDirection.x = -Math.max(.92, Math.abs(petioleWorldDirection.x));
    petioleWorldDirection.normalize();
    const petiole = new THREE.Group();
    petiole.name = 'plant-petiole';
    petiole.position.y = .003;
    // Long petioles are a botanical connection, not a clipped leaf: nodes near
    // the wall use enough of that real segment to keep the blade clear of it.
    const small=length<.04;
    const petioleLength = small?.006+random()*.007:.018+random()*.027;
    width=length/(2*(2+random()*1.2));
    const petioleDirection = petioleWorldDirection.applyQuaternion(parentWorld.clone().invert());
    orientToward(petiole, petioleDirection);
    const petioleIndex = addJoint(petiole, parent, parentIndex, 'petiole');
    localSegment(petiole, petioleLength, small?.00035:.00085, small?.00018:.0004, branchMaterial, geometries);

    const leafJoint = new THREE.Group();
    leafJoint.name = 'plant-leaf-joint';
    leafJoint.position.y = petioleLength;
    petiole.updateWorldMatrix(true,false);
    const axis=petioleDirection.clone().applyQuaternion(parentWorld).normalize();
    axis.y=THREE.MathUtils.clamp(axis.y,-.12,.24);axis.normalize();
    const across=new THREE.Vector3().crossVectors(axis,UP).normalize();
    const face=new THREE.Vector3().crossVectors(across,axis).normalize();
    const worldLeaf=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across,axis,face));
    leafJoint.quaternion.copy(petiole.getWorldQuaternion(new THREE.Quaternion()).invert()).multiply(worldLeaf);
    leafJoint.rotateY(-.24-random()*.62);
    const leafIndex = addJoint(leafJoint, petiole, petioleIndex, 'leaf');
    const height = parentWorldPosition.y;
    const color = height > 1.05 ? 0x9cab52 : height > .28 ? 0x516d35 : 0x3d4b2e;
    const roughness = (height > 1.05 ? .50 : height > .28 ? .57 : .63)*( .95+random()*.10);
    const material = new THREE.MeshStandardMaterial({color, roughness, side: THREE.DoubleSide});
    materials.add(material);
    const shaped = createLeafGeometry(length, width, width * THREE.MathUtils.lerp(.11, .2, random()), length * THREE.MathUtils.lerp(.035, .12, random()), .01 + random() * .04, THREE.MathUtils.degToRad((random()-.5) * 24), defect);
    geometries.add(shaped.geometry);
    const mesh = new THREE.Mesh(shaped.geometry, material);
    mesh.name = 'plant-leaf';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    leafJoint.add(mesh);
    leaves.push({jointIndex: leafIndex, mesh, tip: shaped.tip, area: length * width * 1.24, seed: Math.floor(random() * 0x7fffffff), baseRoughness: roughness});
  };

  const mainBase = new THREE.Group();
  mainBase.name = 'main-plant-root';
  const mainBaseIndex = addJoint(mainBase, root, -1, 'stem');
  let current = mainBase;
  let currentIndex = mainBaseIndex;
  const mainSegments = 18;
  const branchAt = new Set([5, 9, 13]);
  for (let index = 0; index < mainSegments; index++) {
    const length = .05 + random() * .045;
    const radius = THREE.MathUtils.lerp(.0048, .0007, index / mainSegments);
    localSegment(current, length, radius, radius * .8, stemMaterial, geometries);
    const next = new THREE.Group();
    next.name = 'main-stem-internode';
    next.position.y = length;
    const alternation = (index % 2 ? 1 : -1) * THREE.MathUtils.degToRad(130 + random() * 30);
    next.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), .045 + random() * .028));
    next.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, alternation));
    const nextIndex = addJoint(next, current, currentIndex, 'stem');
    const isRegularLeaf = index > 2 && (index % 2 === 0 || index === 3 || index === 5 || index === 7 || index === 9 || index === 11 || index === 13 || index === 15);
    if (isRegularLeaf) {
      const angle = alternation + Math.PI * .5;
      addLeaf(
        current, currentIndex,
        new THREE.Vector3(Math.cos(angle), .28 + random() * .12, Math.sin(angle)),
        .06 + random() * .09, .025 + random() * .025,
        angle,
        leaves.length === 6 || leaves.length === 20 ? (random() < .5 ? -1 : 1) : null,
      );
    }
    if (branchAt.has(index)) {
      const branch = new THREE.Group();
      branch.name = 'plant-secondary-branch';
      const angle = alternation + (random() < .5 ? Math.PI * .42 : -Math.PI * .42);
      current.updateWorldMatrix(true, false);
      const branchWorld = new THREE.Vector3(-.94, .16, index === 5 ? -.28 : index === 9 ? -.20 : -.38).normalize();
      orientToward(branch, branchWorld.applyQuaternion(current.getWorldQuaternion(new THREE.Quaternion()).invert()));
      const branchIndex = addJoint(branch, current, currentIndex, 'branch');
      const branchLength = .30 + random() * .045;
      localSegment(branch, branchLength, radius * .58, radius * .28, branchMaterial, geometries);
      const branchTip = new THREE.Group(); branchTip.position.y = branchLength;
      const branchTipIndex = addJoint(branchTip, branch, branchIndex, 'branch');
      addLeaf(branch, branchIndex, new THREE.Vector3(Math.cos(angle + .52), .36, Math.sin(angle + .52)), .09 + random() * .055, .03 + random() * .018, angle + .52, null);
      addLeaf(branchTip, branchTipIndex, new THREE.Vector3(Math.cos(angle - .48), .32, Math.sin(angle - .48)), .08 + random() * .06, .028 + random() * .018, angle - .48, null);
    }
    current = next;
    currentIndex = nextIndex;
  }
  addLeaf(current, currentIndex, new THREE.Vector3(-.64, .65, .12), .09, .035, 2.9, null);

  WEED_Z.forEach((z, index) => {
    const weed = new THREE.Group();
    weed.name = 'wall-weed-root';
    weed.position.set(1.688 - MAIN_ROOT.x, 0, z - MAIN_ROOT.z);
    const weedIndex = addJoint(weed, root, -1, 'weed');
    const height = .07 + index * .01 + random() * .012;
    localSegment(weed, height, .0006, .00035, branchMaterial, geometries);
    const tip = new THREE.Group(); tip.position.y = height;
    const tipIndex = addJoint(tip, weed, weedIndex, 'weed');
    const angle = index * 1.36;
    for (let leaf = 0; leaf < 2; leaf++) addLeaf(tip, tipIndex, new THREE.Vector3(Math.cos(angle + leaf * Math.PI) * .55, .45, Math.sin(angle + leaf * Math.PI) * .55), .012 + random() * .023, .006 + random() * .007, angle + leaf * Math.PI, null);
  });

  let disposed = false;
  return {
    root, joints, leaves,
    dispose() {
      if (disposed) return;
      disposed = true;
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      root.removeFromParent();
    },
  };
}
