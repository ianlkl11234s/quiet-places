import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
renderer.setSize(1440, 560);
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.25;
document.querySelector('#stage')!.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#252b30');
scene.add(new THREE.HemisphereLight('#edf3ff', '#8d8579', 1.5));
const key = new THREE.DirectionalLight('#fff4e5', 3);
key.position.set(-1, 2, -1); scene.add(key);
const fill = new THREE.DirectionalLight('#c5dcff', 1.2);
fill.position.set(1, .4, 1); scene.add(fill);
const {scene: model, animations} = await new GLTFLoader().loadAsync('/models/koi.glb');
scene.add(model);
const mixer = new THREE.AnimationMixer(model);
const clip = animations.find(a => a.name === 'KOI_ACT_SLOW_CRUISE');
if (!clip) throw new Error('Missing hero action');
mixer.clipAction(clip).play();
const cameras = [[0, 1, 0], [1, .04, 0], [.65, .4, -.8]].map((position, i) => {
  const camera = new THREE.OrthographicCamera(-.29, .29, .34, -.34, .01, 10);
  camera.position.fromArray(position);
  if (i === 0) camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0); return camera;
});
const draw = (time: number) => {
  mixer.setTime(time);
  renderer.setScissorTest(true);
  cameras.forEach((camera, i) => {
    renderer.setViewport(i * 480, 0, 480, 560);
    renderer.setScissor(i * 480, 0, 480, 560);
    renderer.render(scene, camera);
  });
  document.querySelector('#clock')!.textContent = `${time.toFixed(2)} s / 36 s`;
};
let manual = false;
let start: number | undefined;
function tick(now: number) {
  if (start === undefined) start = now;
  if (!manual) draw(Math.min(36, (now - start) / 1000));
  requestAnimationFrame(tick);
}
(document.querySelector('#gray') as HTMLInputElement).onchange = event => {
  renderer.domElement.style.filter = (event.target as HTMLInputElement).checked ? 'grayscale(1)' : '';
};
Object.assign(window, {koiReview: {
  setTime(time: number) {manual = true; draw(time);},
  replay() {manual = false; start = undefined;},
  inspect() {return {clips: animations.map(a => ({name: a.name, duration: a.duration})), geometries: renderer.info.memory.geometries, programs: renderer.info.programs?.length, triangles: renderer.info.render.triangles};},
}});
document.querySelector('#result')!.textContent = 'Native asset: 0.55 m · GLB skeleton · KOI_ACT_SLOW_CRUISE · 30 fps baked / realtime display';
requestAnimationFrame(tick);
