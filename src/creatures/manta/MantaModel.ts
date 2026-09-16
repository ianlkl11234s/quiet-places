import * as THREE from 'three';
import {seededRandom} from '../../shared/math/seededRandom.ts';

export interface MantaPose {
  /** Radians, supplied by the scene's locomotion controller. */
  phase: number;
  /** Normalized wing excursion multiplier. */
  amplitude: number;
  /** [-.3, .3]; positive makes local +X (right) wing larger. */
  asymmetry: number;
  /** [0, 1]; suppresses the stroke while retaining a small tip dihedral. */
  glide: number;
}

export interface MantaModel {
  root: THREE.Group;
  update(pose: MantaPose): void;
  dispose(): void;
}

type Surface = {mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>; base: Float32Array; s: Float32Array; r: Float32Array; upper: Float32Array};
type Detail = {object: THREE.Object3D; s: number; r: number; dorsal: boolean; offset: THREE.Vector3};

const clamp = THREE.MathUtils.clamp;
const smooth = THREE.MathUtils.smoothstep;

// SOURCE_MEASURED / DERIVED_FROM_MEASURED_RATIO: numerical anchors from the
// supplied geometry brief. Curve controls remain ANATOMICAL_PROXY.
const MANTA = {discLength: .43, maxThickness: .095, headHalfWidth: .115, mouthWidth: .15, tailLength: .45} as const;
const stations = [
  {z: .20, a: .095, t: .050}, {z: .15, a: .115, t: .080}, {z: .08, a: .120, t: .095},
  {z: 0, a: .110, t: .090}, {z: -.10, a: .085, t: .070}, {z: -.18, a: .055, t: .045}, {z: -.22, a: .035, t: .025},
];
function station(z: number) { for (let i = 1; i < stations.length; i++) if (z >= stations[i].z) { const a = stations[i - 1], b = stations[i], t = clamp((z - b.z) / (a.z - b.z), 0, 1), cubic = t * t * (3 - 2 * t); return {a: THREE.MathUtils.lerp(b.a, a.a, cubic), thickness: THREE.MathUtils.lerp(b.t, a.t, cubic)}; } return {a: .035, thickness: .025}; }
function front(x: number) { return .21 - .09 * Math.pow(Math.min(1, Math.abs(x) / .115), 5); }
function rear(x: number) { return -.22 + .05 * Math.pow(Math.min(1, Math.abs(x) / .11), 2); }
function wingEdges(q: number) { return {front: .12 * (1 - q) - .02 * q + .010 * Math.sin(Math.PI * q), rear: -.17 * (1 - q) - .02 * q + .040 * Math.sin(Math.PI * q)}; }
function planform(c: number, r: number) {
  const sign = r < 0 ? -1 : 1, u = Math.abs(r);
  if (u <= .23) { const x = sign * MANTA.headHalfWidth * u / .23, f = front(x), b = rear(x); return {x, z: THREE.MathUtils.lerp(f, b, c), q: 0}; }
  const q = (u - .23) / .77, x = sign * (.115 + .385 * q), edge = wingEdges(q); return {x, z: THREE.MathUtils.lerp(edge.front, edge.rear, c), q};
}
function pointOnSkin(span: number, c: number, r: number, dorsal: boolean) {
  const p = planform(c, r), bodyStation = station(p.z);
  // ANATOMICAL_PROXY: this shoulder flare blends the station loft into the
  // wing root, avoiding a visible zero-thickness groove across the disc.
  const shoulderA = .115 + .105 * Math.pow(Math.sin(Math.PI * c), .72), bodyA = Math.max(bodyStation.a, shoulderA), body = Math.abs(p.x) >= bodyA ? 0 : bodyStation.thickness * Math.pow(1 - Math.pow(Math.abs(p.x) / bodyA, 2.55), 1 / 2.55);
  const wing = (.003 + .038 * Math.pow(1 - p.q, 1.4)) * Math.pow(Math.max(0, 4 * c * (1 - c)), .55) * Math.pow(Math.max(0, 1 - p.q), .7);
  // max preserves a smooth shoulder volume until the wing hydrofoil takes over.
  const blend = .010 * Math.sin(Math.PI * c) * Math.pow(1 - p.q, .7);
  const fullThickness = Math.max(body, wing) + (blend > 1e-8 ? Math.pow(Math.max(0, blend - Math.abs(body - wing)), 2) / (4 * blend) : 0), camber = .006 * Math.pow(p.q, 1.5) * Math.pow(Math.max(0, 1 - p.q), .7) * Math.sin(Math.PI * c);
  return new THREE.Vector3(p.x * span, (camber + (dorsal ? fullThickness : -fullThickness) * .5) * span, p.z * span);
}

/** Closed planform + station-loft body.  Wings are a thickness-tapered hydrofoil, never a flat kite. */
function mantaDiscGeometry(span: number, longitudinal: number, lateral: number, seed: number) {
  const topCount = longitudinal * lateral;
  const positions = new Float32Array(topCount * 2 * 3);
  const sAttribute = new Float32Array(topCount * 2);
  const rAttribute = new Float32Array(topCount * 2);
  const upperAttribute = new Float32Array(topCount * 2);
  const indices: number[] = [];
  const index = (row: number, column: number) => row * lateral + column;
  for (let row = 0; row < longitudinal; row++) for (let column = 0; column < lateral; column++) {
    const s = row / (longitudinal - 1), r = column / (lateral - 1) * 2 - 1;
    for (let side = 0; side < 2; side++) {
      const i = index(row, column) + side * topCount, offset = i * 3;
      const point = pointOnSkin(span, s, r, side === 0); positions[offset] = point.x; positions[offset + 1] = point.y; positions[offset + 2] = point.z;
      sAttribute[i] = s; rAttribute[i] = r; upperAttribute[i] = side === 0 ? 1 : 0;
    }
  }
  for (let row = 0; row < longitudinal - 1; row++) for (let column = 0; column < lateral - 1; column++) {
    const a = index(row, column), b = index(row + 1, column), c = index(row, column + 1), d = index(row + 1, column + 1);
    // c grows to +X while b advances toward -Z: reverse the former top
    // winding so dorsal normals face +Y and ventral normals face -Y.
    indices.push(a, c, b, c, d, b);
    indices.push(a + topCount, b + topCount, c + topCount, c + topCount, b + topCount, d + topCount);
  }
  const bridge = (a: number, b: number) => indices.push(a, b, a + topCount, b, b + topCount, a + topCount);
  for (let row = 0; row < longitudinal - 1; row++) { bridge(index(row, 0), index(row + 1, 0)); bridge(index(row + 1, lateral - 1), index(row, lateral - 1)); }
  for (let column = 0; column < lateral - 1; column++) { bridge(index(0, column + 1), index(0, column)); bridge(index(longitudinal - 1, column), index(longitudinal - 1, column + 1)); }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('mantaS', new THREE.BufferAttribute(sAttribute, 1)); geometry.setAttribute('mantaR', new THREE.BufferAttribute(rAttribute, 1)); geometry.setAttribute('mantaUpper', new THREE.BufferAttribute(upperAttribute, 1));
  const colors = new Float32Array(topCount * 2 * 3), dorsal = new THREE.Color('#273135'), ventral = new THREE.Color('#d5d6d0'), white = new THREE.Color('#c7ceca'), dark = new THREE.Color('#343d3d'), random = seededRandom(seed ^ 0x51ed270b);
  const spots = Array.from({length: 38}, () => ({x: (random() * 2 - 1) * .17, z: -.042 - random() * .126, rx: .008 + random() * .010, rz: .005 + random() * .006, strength: .45 + random() * .5}));
  const bias = [random() * .012, random() * .012];
  for (let i = 0; i < topCount * 2; i++) {
    const c = sAttribute[i], r = rAttribute[i], p = planform(c, r), isDorsal = upperAttribute[i] === 1, color = (isDorsal ? dorsal : ventral).clone();
    if (isDorsal) {
      // A broad anterior shoulder and a narrow posterior point preserve a dark
      // medial T; softly sampled triangles stay attached to the skin at any pose.
      const ax = Math.abs(p.x), shift = bias[p.x < 0 ? 0 : 1], t = (p.z + .006 - shift) / .13;
      const inner = .078 - .018 * t, outer = .078 + .18 * Math.min(t * 1.8, (1 - t) * 3.5);
      const patch = smooth(ax - inner, 0, .009) * (1 - smooth(ax - outer, -.009, 0)) * smooth(t, 0, .08) * (1 - smooth(t, .93, 1));
      color.lerp(white, patch * .92);
      color.multiplyScalar(.97 + .025 * Math.sin(p.x * 39 + p.z * 23 + seed));
    } else {
      let pigment = 0;
      for (const spot of spots) {
        const distance = Math.hypot((p.x - spot.x) / spot.rx, (p.z - spot.z) / spot.rz);
        pigment = Math.max(pigment, (1 - smooth(distance, .52, 1.14)) * spot.strength);
      }
      const border = smooth(c, .89, 1) * smooth(Math.abs(p.x), .07, .19);
      color.lerp(dark, Math.max(pigment, border * .68));
    }
    colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

function material(color: THREE.ColorRepresentation, roughness = .52) { return new THREE.MeshStandardMaterial({color, roughness, metalness: 0, side: THREE.DoubleSide}); }

function addTube(root: THREE.Object3D, name: string, points: THREE.Vector3[], radius: number, source: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, radius, 6, false), source); mesh.name = name; root.add(mesh); return mesh;
}

function curledRibbon(root: THREE.Object3D, name: string, span: number, sign: number) {
  const rows = 22, columns = 20, positions: number[] = [], colors: number[] = [], indices: number[] = [], layer = rows * columns;
  const outerColor = new THREE.Color('#a8b0ad'), innerColor = new THREE.Color('#343e40'), dorsalColor = new THREE.Color('#303a3d');
  // Store a full layer at a time: indexing interleaved layers used to make
  // saw-toothed edges. Across-width curvature rolls a solid fleshy ribbon.
  for (let side = 0; side < 2; side++) for (let row = 0; row < rows; row++) {
    const t = row / (rows - 1), roll = 2.3 + 2.2 * smooth(t, 0, 1), width = .063 - .012 * t;
    const radius = width / roll, thickness = .006 * (1 - .25 * t);
    const cx = .077 + .020 * Math.sin(t * Math.PI * .5), cy = -.008 - .010 * t * t, cz = .165 + .11 * t;
    for (let column = 0; column < columns; column++) {
      const u = column / (columns - 1), angle = -.9 + roll * u, radial = radius + (side ? thickness * .5 : -thickness * .5);
      positions.push(sign * (cx + radial * Math.cos(angle)) * span, (cy + radial * Math.sin(angle)) * span, cz * span);
      const color = side ? outerColor.clone().lerp(dorsalColor, smooth(Math.sin(angle), .12, .9) * .85) : innerColor;
      colors.push(color.r, color.g, color.b);
    }
  }
  const vertex = (side: number, row: number, column: number) => side * layer + row * columns + column;
  const quad = (a: number, b: number, c: number, d: number, reverse: boolean) => reverse ? indices.push(a,c,b,c,d,b) : indices.push(a,b,c,c,b,d);
  for (let side = 0; side < 2; side++) for (let row = 0; row < rows - 1; row++) for (let col = 0; col < columns - 1; col++) quad(vertex(side,row,col),vertex(side,row+1,col),vertex(side,row,col+1),vertex(side,row+1,col+1),(side === 1) !== (sign < 0));
  for (let row = 0; row < rows - 1; row++) for (const col of [0,columns-1]) quad(vertex(0,row,col),vertex(0,row+1,col),vertex(1,row,col),vertex(1,row+1,col),(col===0)!==(sign<0));
  for (let col = 0; col < columns - 1; col++) for (const row of [0,rows-1]) quad(vertex(0,row,col),vertex(1,row,col),vertex(0,row,col+1),vertex(1,row,col+1),(row===0)!==(sign<0));
  const geometry = new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)).setAttribute('color',new THREE.Float32BufferAttribute(colors,3)).setIndex(indices);
  geometry.computeVertexNormals(); const skin=material('#ffffff',.56); skin.vertexColors=true;
  const mesh=new THREE.Mesh(geometry,skin);mesh.name=name;root.add(mesh);return mesh;
}

function pointOnBody(span: number, s: number, r: number, dorsal: boolean) {
  return pointOnSkin(span, s, r, dorsal);
}

function createDetailGroup(span: number, seed: number, includeFine: boolean) {
  const group = new THREE.Group(), details: Detail[] = [];
  const dark = material('#151b1c', .54);
  const detail = (object: THREE.Object3D, s: number, r: number, dorsal: boolean, offset = new THREE.Vector3()) => { details.push({object, s, r, dorsal, offset}); group.add(object); };
  // Raised, curled cephalic lobes stay semi-rolled in cruise instead of forming feeding funnels.
  for (const sign of [-1, 1]) {
    const lobe = new THREE.Group(); lobe.name = sign < 0 ? 'manta-cephalic-lobe-left' : 'manta-cephalic-lobe-right';
    // Geometry is attachment-local. update() owns the body-space attachment
    // point, so no child can accidentally receive the body transform twice.
    curledRibbon(lobe, `${lobe.name}-ribbon`, span, sign);
    // Ribbon vertices are authored in the head's local coordinates, so do not
    // apply a second body attachment transform (which visibly floated lobes).
    group.add(lobe);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(span * .0055, 10, 8), dark); eye.name = sign < 0 ? 'manta-eye-left' : 'manta-eye-right';
    // Eyes sit at the side of the broad head, slightly below the dorsal crown.
    eye.position.set(sign * span * .105, span * .021, span * .135); group.add(eye);
    const spiracle = new THREE.Mesh(new THREE.CircleGeometry(span * .004, 8), dark); spiracle.name = sign < 0 ? 'manta-spiracle-left' : 'manta-spiracle-right'; spiracle.rotation.x = -Math.PI / 2; const spiracleBase = pointOnSkin(span, .25, sign * .21, true); spiracle.position.copy(spiracleBase).add(new THREE.Vector3(sign * span * .008, span * .002, -span * .014)); group.add(spiracle);
  }
  // Mouth, lobes, eyes and the small posterior fins stay on every LOD so the
  // animal remains readable at range; only gills and markings are near-only.
  // Follow the actual blunt front contour instead of suspending a flat oval
  // ahead of its curved sides. The dark aperture is a shallow anatomy proxy.
  const apertureVertices:number[]=[],apertureIndices:number[]=[];
  for(let i=0;i<=64;i++){const x=-.075+.15*i/64,y=.009*Math.sqrt(Math.max(0,1-Math.pow(x/.075,2)));for(const side of [-1,1])apertureVertices.push(x*span,side*y*span,(front(x)-.21+.0015)*span);if(i<64){const k=i*2;apertureIndices.push(k,k+2,k+1,k+1,k+2,k+3);}}
  const mouthGeometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(apertureVertices,3)).setIndex(apertureIndices);mouthGeometry.computeVertexNormals();
  const mouth=new THREE.Mesh(mouthGeometry,dark);mouth.name='manta-terminal-mouth';mouth.position.set(0,-span*.006,span*.21);group.add(mouth);
  const lipPoints=Array.from({length:65},(_,i)=>{const angle=i/64*Math.PI*2,x=.075*Math.cos(angle);return new THREE.Vector3(x*span,(-.006+.009*Math.sin(angle))*span,(front(x)+.002)*span);});
  const lip=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lipPoints,false,'centripetal'),64,span*.0014,8,false),material('#606d6c',.58));lip.name='manta-terminal-mouth-lip';group.add(lip);
  const finShape=new THREE.Shape();finShape.moveTo(-span*.018,0);finShape.quadraticCurveTo(-span*.003,span*.015,span*.010,span*.033);finShape.quadraticCurveTo(span*.019,span*.020,span*.028,0);finShape.closePath();
  const finGeometry=new THREE.ExtrudeGeometry(finShape,{depth:span*.003,bevelEnabled:true,bevelSize:span*.0007,bevelThickness:span*.0007,bevelSegments:2,steps:1,curveSegments:8});finGeometry.translate(0,0,-span*.0015);finGeometry.rotateY(Math.PI/2);
  const dorsalFin=new THREE.Mesh(finGeometry,material('#293337'));dorsalFin.name='manta-dorsal-fin';detail(dorsalFin,.91,0,true,new THREE.Vector3(0,-span*.002,0));
  for(const sign of [-1,1]){const shape=new THREE.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(sign*span*.035,span*.005,sign*span*.043,span*.031);shape.quadraticCurveTo(sign*span*.024,span*.026,0,span*.030);shape.closePath();const geometry=new THREE.ExtrudeGeometry(shape,{depth:span*.002,bevelEnabled:false,curveSegments:6});geometry.rotateX(-Math.PI/2);const pelvic=new THREE.Mesh(geometry,material('#424b4b'));pelvic.name=`manta-pelvic-fin-${sign<0?'left':'right'}`;detail(pelvic,.93,sign*.05,false,new THREE.Vector3(0,span*.003,0));}
  if (includeFine) {
    // Five paired ventral gill slits, intentionally separate geometry for readable near-field anatomy.
    for (let pair = 0; pair < 5; pair++) for (const sign of [-1, 1]) {
      const z = [.055, .025, -.005, -.038, -.073][pair], length = [.057, .060, .058, .052, .043][pair], s = clamp((.21 - z) / .43, .16, .68), x0 = sign * .028, x1 = sign * (.028 + length), xMid = (x0 + x1) * .5;
      const rAt = (x: number) => clamp(Math.abs(x) / .115 * .23, 0, .23) * Math.sign(x || sign);
      const points = [x0, xMid, x1].map((x, i) => pointOnSkin(span, s, rAt(x), false).add(new THREE.Vector3(0, -span * .002, i === 1 ? span * .006 : 0)));
      const slit = new THREE.Group(); slit.name = `manta-gill-slit-${pair + 1}-${sign < 0 ? 'left' : 'right'}`; addTube(slit, `${slit.name}-curve`, points, span * .0027, dark); group.add(slit);
    }
  }
  return {group, details};
}

function createTail(span: number, seed: number) {
  const root = new THREE.Group(), random = seededRandom(seed ^ 0x9e3779b9), points: THREE.Vector3[] = [];
  // This first vertex shares the body's exact s=1 tail-root location.
  const start = pointOnBody(span, 1, 0, true);
  for (let i = 0; i < 8; i++) { const t = i / 7; points.push(start.clone().add(new THREE.Vector3((random() - .5) * span * .012 * t, -span * .020 * t, -MANTA.tailLength * span * t))); }
  root.userData.tailRoot = start.clone();
  const knob = new THREE.Mesh(new THREE.SphereGeometry(span * .014, 8, 6), material('#20292b', .56)); knob.name = 'manta-tail-base-knob'; knob.scale.set(.5,.25,1.2); knob.position.copy(start).add(new THREE.Vector3(0,-span*.002,span*.010)); root.add(knob);
  const mesh = addTube(root, 'manta-long-thin-tail', points, span * .012, material('#20292b', .56));
  // TubeGeometry has regular rings, so taper their offsets around each ring
  // centre. This preserves the exact attachment while making a whip-like tip.
  const position = mesh.geometry.getAttribute('position') as THREE.BufferAttribute, ringSize = 7, segments = (mesh.geometry as THREE.TubeGeometry).parameters.tubularSegments;
  for (let ring = 0; ring <= segments; ring++) { const first = ring * ringSize, centre = new THREE.Vector3(); for (let i = 0; i < ringSize - 1; i++) centre.add(new THREE.Vector3(position.getX(first + i), position.getY(first + i), position.getZ(first + i))); centre.multiplyScalar(1 / (ringSize - 1)); const t = ring / segments, scale = Math.min(1, Math.pow(1 - t, 1.45) + .1); for (let i = 0; i < ringSize; i++) { const v = new THREE.Vector3(position.getX(first + i), position.getY(first + i), position.getZ(first + i)).sub(centre).multiplyScalar(scale).add(centre); position.setXYZ(first + i, v.x, v.y, v.z); } }
  position.needsUpdate = true; mesh.geometry.computeVertexNormals();
  return {root, mesh, points, start, random};
}

/** Original procedural Mobula birostris anatomy proxy. Local +Z is swimming forward and +Y is dorsal. */
export function createMantaModel(span: number, seed: number): MantaModel {
  const safeSpan = clamp(Number.isFinite(span) ? span : 5.4, 1.2, 12);
  const root = new THREE.Group(); root.name = 'mobula-birostris-procedural'; root.userData = {species: 'Mobula birostris', span: safeSpan, forward: '+Z', dorsal: '+Y', seed: seed >>> 0, geometry: {discLength: MANTA.discLength * safeSpan, maxThickness: MANTA.maxThickness * safeSpan, mouthWidth: MANTA.mouthWidth * safeSpan, tailLength: MANTA.tailLength * safeSpan, units: 'm'}};
  const lod = new THREE.LOD(); lod.name = 'manta-lod'; root.add(lod);
  // Vertex colours distinguish one continuous watertight skin without splitting
  // its perimeter into separate dorsal and ventral draw meshes.
  const skin = material('#ffffff', .52); skin.vertexColors = true;
  const surfaces: Surface[] = [];
  const addLevel = (longitudinal: number, lateral: number, distance: number, fine: boolean) => {
    const level = new THREE.Group(); level.name = `manta-lod-level-${distance}`;
    const geometry = mantaDiscGeometry(safeSpan, longitudinal, lateral, seed), mesh = new THREE.Mesh(geometry, skin); mesh.name = `manta-body-lod-${distance}`;
    const triangles = geometry.index!.count / 3; geometry.clearGroups(); geometry.addGroup(0, geometry.index!.count, 0);
    const base = (geometry.getAttribute('position') as THREE.BufferAttribute).array.slice() as Float32Array;
    surfaces.push({mesh, base, s: (geometry.getAttribute('mantaS') as THREE.BufferAttribute).array as Float32Array, r: (geometry.getAttribute('mantaR') as THREE.BufferAttribute).array as Float32Array, upper: (geometry.getAttribute('mantaUpper') as THREE.BufferAttribute).array as Float32Array});
    level.add(mesh);
    const anatomy = createDetailGroup(safeSpan, seed, fine); anatomy.group.name = fine ? 'manta-near-anatomy' : `manta-major-anatomy-${distance}`; level.add(anatomy.group); nearDetails.push(...anatomy.details);
    lod.addLevel(level, distance);
    return triangles;
  };
  const nearDetails: Detail[] = [];
  // Odd lateral counts retain an explicit x=0 centreline for the station loft.
  addLevel(48, 81, 0, true); addLevel(28, 41, 18, false); addLevel(16, 25, 40, false);
  const tail = createTail(safeSpan, seed); root.add(tail.root);
  let disposed = false;
  const deformY = (s: number, r: number, phase: number, amplitude: number, asymmetry: number, glide: number) => {
    const side = r >= 0 ? 1 : -1, wing = clamp((Math.abs(r) - .23) / .77, 0, 1), wingScale = 1 + side * asymmetry;
    // Chord stations meet at one tip; their lag must converge as well,
    // otherwise the same geometric tip tears into a vertical fan during stroke.
    const chord = THREE.MathUtils.lerp(s, .5, smooth(wing, .86, 1));
    const travel = Math.sin(phase - (.42 * Math.PI) * chord + side * .12);
    const stroke = safeSpan * .115 * amplitude * (1 - glide) * Math.pow(wing, 1.55) * (.72 + .28 * chord) * wingScale * travel;
    const dihedral = safeSpan * .055 * glide * Math.pow(wing, 1.8);
    return stroke + dihedral;
  };
  const update = (input: MantaPose) => {
    if (disposed) return;
    const phase = Number.isFinite(input.phase) ? input.phase : 0, amplitude = clamp(Number.isFinite(input.amplitude) ? input.amplitude : 1, 0, 2), asymmetry = clamp(Number.isFinite(input.asymmetry) ? input.asymmetry : 0, -.3, .3), glide = clamp(Number.isFinite(input.glide) ? input.glide : 0, 0, 1);
    for (const surface of surfaces) {
      const position = surface.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < position.count; i++) {
        const s = surface.s[i], r = surface.r[i];
        // Keep wing span invariant so route collision envelopes stay valid;
        // turning asymmetry changes excursion, not the physical silhouette.
        position.setXYZ(i, surface.base[i * 3], surface.base[i * 3 + 1] + deformY(s, r, phase, amplitude, asymmetry, glide), surface.base[i * 3 + 2]);
      }
      position.needsUpdate = true; surface.mesh.geometry.computeVertexNormals(); surface.mesh.geometry.computeBoundingSphere();
    }
    for (const detail of nearDetails) {
      const point = pointOnBody(safeSpan, detail.s, detail.r, detail.dorsal); point.y += deformY(detail.s, detail.r, phase, amplitude, asymmetry, glide) + (detail.dorsal ? safeSpan * .003 : -safeSpan * .003); detail.object.position.copy(point).add(detail.offset);
    }
    // The thin tail is intentionally restrained in cruise. Its static curved
    // tube avoids turning the animal into a stingray-like tail-driven swimmer.
  };
  update({phase: 0, amplitude: 1, asymmetry: 0, glide: 0});
  return {root, update, dispose() { if (disposed) return; disposed = true; const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(); root.traverse(object => { if (!(object instanceof THREE.Mesh)) return; geometries.add(object.geometry); for (const item of Array.isArray(object.material) ? object.material : [object.material]) materials.add(item); }); geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); root.removeFromParent(); root.clear(); }};
}
