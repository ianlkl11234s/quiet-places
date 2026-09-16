import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {prepareLastArcade} from '../src/places/last-arcade/index.ts';

type Glb = {scenes:{extras?:{coordinate_contract?:string}}[];nodes:{name?:string;rotation?:number[];extras?:{arcade_role?:string};mesh?:number}[];meshes:{name?:string;primitives:{attributes:Record<string,number>}[]}[];accessors:{type:string;count:number;bufferView?:number;byteOffset?:number;componentType?:number;min?:number[];max?:number[]}[];bufferViews:{byteOffset?:number;byteStride?:number}[];_binary?:Uint8Array};

function readGlbJson(file: string): Glb {
  const bytes = readFileSync(file), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint32(0, true), 0x46546c67, 'GLB magic');
  let json: Glb | undefined;
  for (let at = 12; at < bytes.byteLength;) {
    const length = view.getUint32(at, true), type = view.getUint32(at + 4, true);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(bytes.subarray(at + 8, at + 8 + length))) as Glb;
    if (type === 0x004e4942 && json) { json._binary = bytes.subarray(at + 8, at + 8 + length); return json; }
    at += 8 + length;
  }
  throw new Error('GLB lacks JSON or binary chunk');
}

function scalarRange(glb: Glb, accessor: Glb['accessors'][number]): [number, number] {
  assert.equal(accessor.componentType, 5126); assert.ok(accessor.bufferView !== undefined && glb._binary);
  const view = glb.bufferViews[accessor.bufferView], start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const bytes = new DataView(glb._binary.buffer, glb._binary.byteOffset + start, accessor.count * (view.byteStride ?? 4));
  let min = Infinity, max = -Infinity;
  for (let index = 0; index < accessor.count; index++) { const value = bytes.getFloat32(index * (view.byteStride ?? 4), true); min = Math.min(min, value); max = Math.max(max, value); }
  return [min, max];
}

test('last arcade GLB preserves the configured axes, architecture span and foliage wind inputs', () => {
  const path = 'public/models/last-arcade.glb'; assert.ok(existsSync(path), 'shipping asset exists');
  const glb = readGlbJson(path);
  assert.equal(glb.scenes[0]?.extras?.coordinate_contract, 'X across to road, Y down arcade, Z up; glTF=(X,Z,-Y)');
  const recess = glb.meshes.find(mesh => mesh.name === 'arcade-recess-zone-0')!;
  const recessPosition = glb.accessors[recess.primitives[0].attributes.POSITION];
  assert.ok(recessPosition.min && recessPosition.max);
  assert.ok(recessPosition.max[0] - recessPosition.min[0] > 2.8, 'architecture retains a walkable cross-span');
  assert.ok(recessPosition.max[2] - recessPosition.min[2] > 30, 'architecture retains a long arcade span');
  for (const value of [...recessPosition.min, ...recessPosition.max]) assert.ok(Number.isFinite(value));
  for (const node of glb.nodes.filter(node => node.extras?.arcade_role === 'architecture')) {
    for (const primitive of glb.meshes[node.mesh!].primitives) {
      for (const name of ['_ARCADE_AO', '_ARCADE_SKY']) {
        const accessor = glb.accessors[primitive.attributes[name]];
        assert.ok(accessor, `${node.name} exports ${name}`);
        assert.equal(accessor.type, 'SCALAR');
        assert.equal(accessor.count, glb.accessors[primitive.attributes.POSITION].count);
        const [min, max] = scalarRange(glb, accessor);
        assert.ok(Number.isFinite(min) && min >= 0 && max <= 1, `${node.name} has finite visibility weights`);
      }
    }
  }
  const foliageNodes = glb.nodes.filter(node => node.extras?.arcade_role === 'foliage');
  assert.deepEqual(foliageNodes.map(node => node.name).sort(), ['arcade-plants-foliage', 'arcade-plants-grass']);
  for (const node of foliageNodes) assert.equal(node.rotation, undefined, 'foliage exports in Three-compatible local axes');
  for (const node of foliageNodes) {
    const mesh = glb.meshes[node.mesh!], attributes = mesh.primitives[0].attributes;
    assert.ok(attributes.POSITION !== undefined && attributes.COLOR_0 !== undefined && attributes._ARCADE_WIND !== undefined, `${node.name} has positions, vertex colour and wind weight`);
    const colour = glb.accessors[attributes.COLOR_0];
    const wind = glb.accessors[attributes._ARCADE_WIND];
    assert.equal(colour.type, 'VEC3', `${node.name} keeps colour RGB separate from its wind weight`);
    const sky = glb.accessors[attributes._ARCADE_SKY];
    assert.ok(sky, `${node.name} has building sky visibility`);
    assert.equal(sky.type, 'SCALAR'); assert.equal(sky.count, colour.count);
    const [skyMin,skyMax]=scalarRange(glb,sky);
    assert.ok(Number.isFinite(skyMin)&&skyMin>=0&&skyMax<=1, 'Sky visibility survives export as finite 0..1 values');
    assert.equal(wind.type, 'SCALAR'); const [min, max] = scalarRange(glb, wind);
    assert.ok(min <= .001 && max >= .999, `${node.name} exports pinned root and moving tip weights`);
  }
});

test('last arcade camera config remains an authored fixed vertical-FOV contract', () => {
  const config = JSON.parse(readFileSync('assets/config/last-arcade.json', 'utf8')) as {camera:{position:number[];target:number[];verticalFov:number};sun:{directionToLight:number[];energy:number}};
  assert.ok(config.camera.position[0]>.3 && config.camera.position[0]<2.5, 'standing position stays inside the clear walkway');
  assert.ok(config.camera.position[2]>1.4 && config.camera.position[2]<1.8, 'camera remains at human eye height');
  assert.ok(config.camera.target[1]>config.camera.position[1]+5, 'view faces along the arcade');
  assert.ok(config.camera.verticalFov>25 && config.camera.verticalFov<75, 'perspective avoids a fisheye field');
  assert.ok(config.sun.energy>0 && config.sun.directionToLight[2]>0, 'authored sunlight is above the horizon');
});

test('last arcade factory restores renderer state and releases its prepared model', async () => {
  const root = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(1, 1), seaMaterial = new THREE.MeshStandardMaterial({name: 'arcade-sea'});
  const sea = new THREE.Mesh(geometry, seaMaterial); root.add(sea);
  const old = GLTFLoader.prototype.loadAsync;
  GLTFLoader.prototype.loadAsync = async () => ({scene: root, animations: []}) as never;
  let geometryDisposals = 0, materialDisposals = 0;
  geometry.addEventListener('dispose', () => geometryDisposals++); seaMaterial.addEventListener('dispose', () => materialDisposals++);
  try {
    const factory = await prepareLastArcade(), scene = new THREE.Scene();
    const renderer = {shadowMap: {enabled: false, type: THREE.BasicShadowMap}} as unknown as THREE.WebGLRenderer;
    const place = factory(scene, renderer);
    place.update(0, 12, {intensity: .9, warmth: .48, angle: .25, activity: .8});
    place.dispose(); place.dispose(); factory.dispose?.();
    assert.equal(scene.children.length, 0);
    assert.equal(renderer.shadowMap.enabled, false);
    assert.equal(renderer.shadowMap.type, THREE.BasicShadowMap);
    assert.equal(geometryDisposals, 1); assert.equal(materialDisposals, 1);
  } finally { GLTFLoader.prototype.loadAsync = old; }
});


test('last arcade rejects missing root weights before retaining any prepared resources', async () => {
  const root=new THREE.Group(),geometry=new THREE.PlaneGeometry(),material=new THREE.MeshStandardMaterial();
  const mesh=new THREE.Mesh(geometry,material);mesh.userData.arcade_role='foliage';root.add(mesh);
  let disposed=0;geometry.addEventListener('dispose',()=>disposed++);
  const old=GLTFLoader.prototype.loadAsync;
  GLTFLoader.prototype.loadAsync=async()=>({scene:root,animations:[]}) as never;
  try {await assert.rejects(prepareLastArcade(),/_arcade_wind/);assert.equal(disposed,1);}
  finally {GLTFLoader.prototype.loadAsync=old;}
});
