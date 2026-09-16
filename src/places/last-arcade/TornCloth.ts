import * as THREE from 'three';

export type TornCloth = {
  root: THREE.Group;
  /** Alias retained for scene adapters that install their ambient treatment on groups. */
  group: THREE.Group;
  update(elapsed: number, activity: number): void;
  dispose(): void;
};

type ClothPanel = {
  geometry: THREE.BufferGeometry;
  rest: Float32Array;
  columns: number;
  rows: number;
  phase: number;
};

const TOP_Y = 2.5;
const WALL_CLEARANCE_X = .29;
const ROWS = 12;
const MATERIAL = new THREE.Color('#b5aa93');

function createPanel(startZ: number, endZ: number, phase: number): ClothPanel {
  const columns = 14;
  const positions = new Float32Array((columns + 1) * (ROWS + 1) * 3);
  const indices: number[] = [];
  for (let column = 0; column <= columns; column++) {
    const u = column / columns;
    // The lower edge is authored per strand. It avoids a cut-paper rectangle
    // while retaining a continuous, pinned shopfront attachment.
    const length = .92 + .16 * (.5 + .5 * Math.sin(column * 2.41 + phase));
    for (let row = 0; row <= ROWS; row++) {
      const v = row / ROWS;
      const at = (row * (columns + 1) + column) * 3;
      positions[at] = WALL_CLEARANCE_X + .045 + .006 * Math.sin(column * 1.9 + phase) * v;
      positions[at + 1] = TOP_Y - length * v;
      positions[at + 2] = THREE.MathUtils.lerp(startZ, endZ, u) + .009 * Math.sin(v * Math.PI * 2 + column * .87) * v;
    }
  }
  for (let row = 0; row < ROWS; row++) for (let column = 0; column < columns; column++) {
    // A few open cells near the hem read as worn splits. The top half remains
    // intact so the panel has a plausible hanging load path.
    const torn = row > ROWS * .55 && ((column === 3 && row > 8) || (column === 10 && row > 7));
    if (torn) continue;
    const a = row * (columns + 1) + column;
    indices.push(a, a + 1, a + columns + 1, a + 1, a + columns + 2, a + columns + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return {geometry, rest: positions.slice(), columns, rows: ROWS, phase};
}

/**
 * Two weathered shopfront cloth remnants. They are deliberately CPU-deformed:
 * the visible mesh and Three's normal shadow pass sample the same vertices.
 * This is an art-directed breeze, not a cloth simulation.
 */
export function installTornCloth(root: THREE.Object3D): TornCloth {
  const group = new THREE.Group();
  group.name = 'arcade-torn-cloth';
  const material = new THREE.MeshStandardMaterial({
    name: 'arcade-torn-cloth-weathered-canvas', color: MATERIAL, roughness: .96,
    metalness: 0, envMapIntensity: .38, side: THREE.DoubleSide,
  });
  const panels = [createPanel(-6.4, -6.82, .35), createPanel(-6.98, -7.4, 2.08)];
  for (const [index, panel] of panels.entries()) {
    const mesh = new THREE.Mesh(panel.geometry, material);
    mesh.name = `arcade-torn-cloth-panel-${index + 1}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  root.add(group);
  let released = false;
  return {
    root: group,
    group,
    update(elapsed, activity) {
      if (released) return;
      const time = Number.isFinite(elapsed) ? elapsed : 0;
      const wind = THREE.MathUtils.clamp(Number.isFinite(activity) ? activity : 0, 0, 1);
      for (const panel of panels) {
        const position = panel.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let row = 0; row <= panel.rows; row++) for (let column = 0; column <= panel.columns; column++) {
          const vertex = row * (panel.columns + 1) + column;
          const at = vertex * 3;
          const v = row / panel.rows;
          // v² keeps the nailed upper seam exact. A calm, staggered wave keeps
          // the two remnants from moving in lockstep and stays outside x=.27.
          const phase = panel.phase + column * .46 + v * 3.1;
          const sway = Math.sin(time * .72 + phase) * (.010 + .014 * (.5 + .5 * Math.sin(time * .17 + phase))) * wind * v * v;
          const flutter = Math.cos(time * 1.13 + phase * 1.7) * .011 * wind * v * v;
          position.setXYZ(vertex, panel.rest[at] + sway, panel.rest[at + 1] + flutter * .38, panel.rest[at + 2] + flutter);
        }
        position.needsUpdate = true;
        panel.geometry.computeVertexNormals();
      }
    },
    dispose() {
      if (released) return;
      released = true;
      group.removeFromParent();
      panels.forEach(panel => panel.geometry.dispose());
      material.dispose();
    },
  };
}
