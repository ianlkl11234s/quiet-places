import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const wrap = document.querySelector<HTMLElement>('.canvas-wrap')!;
const status = el<HTMLParagraphElement>('status');
const exportButton = el<HTMLButtonElement>('export');
const shadowInput = el<HTMLInputElement>('shadows');
const fillInput = el<HTMLInputElement>('sky-fill');

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const threeToneMapping = THREE as typeof THREE & { AgXToneMapping?: THREE.ToneMapping };
renderer.toneMapping = threeToneMapping.AgXToneMapping ?? THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 2 ** .8;
wrap.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color().setRGB(.48, .675, .975);
const center = new THREE.Vector3(0, 3, 0);
const blenderSunDirection = new THREE.Vector3(-1, -0.85, -0.45).normalize();
const sun = new THREE.DirectionalLight(new THREE.Color().setRGB(1, 0.75, 0.45), 20);
// DirectionalLight rays travel from its position toward target; place it opposite Blender's ray direction.
sun.position.copy(center).addScaledVector(blenderSunDirection, -20);
sun.target.position.copy(center);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -.0001;
sun.shadow.normalBias = .003;
sun.shadow.camera.left = -4;
sun.shadow.camera.right = 7;
sun.shadow.camera.top = 9;
sun.shadow.camera.bottom = 0;
sun.shadow.camera.near = 0.1;
sun.shadow.camera.far = 40;
scene.add(sun, sun.target);

function fitSunShadowToStudyBounds() {
  // Orthographic shadow extents live in the light's coordinate space, not world space.
  const worldBounds = new THREE.Box3(new THREE.Vector3(-4, 0, -5), new THREE.Vector3(7, 9, 6));
  const corners = [
    new THREE.Vector3(worldBounds.min.x, worldBounds.min.y, worldBounds.min.z),
    new THREE.Vector3(worldBounds.min.x, worldBounds.min.y, worldBounds.max.z),
    new THREE.Vector3(worldBounds.min.x, worldBounds.max.y, worldBounds.min.z),
    new THREE.Vector3(worldBounds.min.x, worldBounds.max.y, worldBounds.max.z),
    new THREE.Vector3(worldBounds.max.x, worldBounds.min.y, worldBounds.min.z),
    new THREE.Vector3(worldBounds.max.x, worldBounds.min.y, worldBounds.max.z),
    new THREE.Vector3(worldBounds.max.x, worldBounds.max.y, worldBounds.min.z),
    new THREE.Vector3(worldBounds.max.x, worldBounds.max.y, worldBounds.max.z),
  ];
  sun.updateMatrixWorld(true);
  sun.target.updateMatrixWorld(true);
  sun.shadow.updateMatrices(sun);
  const lightCamera = sun.shadow.camera;
  const lightBounds = new THREE.Box3().makeEmpty();
  corners.forEach((corner) => lightBounds.expandByPoint(corner.applyMatrix4(lightCamera.matrixWorldInverse)));
  const margin = 0.6;
  lightCamera.left = lightBounds.min.x - margin;
  lightCamera.right = lightBounds.max.x + margin;
  lightCamera.bottom = lightBounds.min.y - margin;
  lightCamera.top = lightBounds.max.y + margin;
  // Light-space objects in front of a Three camera have negative Z.
  lightCamera.near = Math.max(0.1, -lightBounds.max.z - margin);
  lightCamera.far = Math.max(lightCamera.near + 0.1, -lightBounds.min.z + margin);
  lightCamera.updateProjectionMatrix();
}
fitSunShadowToStudyBounds();

const skyFill = new THREE.HemisphereLight(0xd5e7ff, 0x2a2119, 0.15);
skyFill.visible = false;
scene.add(skyFill);

let camera: THREE.Camera | undefined;
let controls: OrbitControls | undefined;
let homePosition: THREE.Vector3 | undefined;
let homeQuaternion: THREE.Quaternion | undefined;
let homeTarget: THREE.Vector3 | undefined;
let modelRoot: THREE.Object3D | undefined;
let detachedHero: THREE.Camera | undefined;

function setStatus(message: string, error = false) {
  status.textContent = message;
  status.dataset.error = String(error);
}

function render() {
  if (camera) renderer.render(scene, camera);
}

function resize() {
  if (!camera || !('aspect' in camera)) return;
  const width = wrap.clientWidth;
  const height = wrap.clientHeight;
  renderer.setSize(width, height, false);
  const perspective = camera as THREE.PerspectiveCamera;
  perspective.aspect = width / height;
  perspective.updateProjectionMatrix();
  render();
}

function resetView() {
  if (!camera || !controls || !homePosition || !homeQuaternion || !homeTarget) return;
  camera.position.copy(homePosition);
  camera.quaternion.copy(homeQuaternion);
  controls.target.copy(homeTarget);
  controls.update();
  render();
}

function configureCamera(hero: THREE.Camera) {
  hero.updateMatrixWorld(true);
  // Detach only after its world matrix is current, preserving exported parent transforms.
  scene.attach(hero);
  hero.updateMatrixWorld(true);
  detachedHero = hero;
  camera = hero;
  const perspective = hero as THREE.PerspectiveCamera;
  homePosition = hero.position.clone();
  homeQuaternion = hero.quaternion.clone();
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(hero.quaternion).normalize();
  homeTarget = hero.position.clone().addScaledVector(forward, 8.2);
  controls?.dispose();
  controls = new OrbitControls(perspective, renderer.domElement);
  controls.target.copy(homeTarget);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = false;
  controls.update();
  controls.minAzimuthAngle = controls.getAzimuthalAngle() - THREE.MathUtils.degToRad(15);
  controls.maxAzimuthAngle = controls.getAzimuthalAngle() + THREE.MathUtils.degToRad(15);
  const polar = controls.getPolarAngle();
  controls.minPolarAngle = polar;
  controls.maxPolarAngle = polar;
  controls.addEventListener('change', render);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '拖曳在左右各 15 度內比較模型，Home 重設視角');
  resize();
}

async function loadModel() {
  exportButton.disabled = true;
  setStatus('正在載入 /models/leaflight-study.glb…');
  try {
    const gltf = await new GLTFLoader().loadAsync('/models/leaflight-study.glb');
    modelRoot = gltf.scene;
    scene.add(modelRoot);
    modelRoot.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    const hero = modelRoot.getObjectByName('Camera_Hero') as THREE.Camera | undefined;
    if (!hero?.isCamera) throw new Error('GLB 找不到匯出的 Camera_Hero。');
    configureCamera(hero);
    exportButton.disabled = false;
    setStatus('已載入。拖曳左右比較，Home 可回到 Blender 匯出視角。');
  } catch (error) {
    // A malformed GLB can fail after its root was added (for example, without Camera_Hero).
    if (modelRoot) {
      disposeModel(modelRoot);
      modelRoot = undefined;
    }
    detachedHero?.removeFromParent();
    detachedHero = undefined;
    const detail = error instanceof Error ? error.message : '未知錯誤';
    setStatus(`無法載入 GLB：${detail} `, true);
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = '重試載入';
    retry.addEventListener('click', () => { retry.remove(); void loadModel(); }, { once: true });
    status.append(retry);
  }
}

function disposeMaterial(material: THREE.Material) {
  Object.values(material).forEach((value) => {
    if (value instanceof THREE.Texture) value.dispose();
  });
  material.dispose();
}

function disposeModel(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach(disposeMaterial);
  });
  root.removeFromParent();
}

shadowInput.addEventListener('change', () => {
  renderer.shadowMap.enabled = shadowInput.checked;
  sun.castShadow = shadowInput.checked;
  modelRoot?.traverse(object => {
    if (object instanceof THREE.Mesh) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => { material.needsUpdate = true; });
    }
  });
  render();
});
fillInput.addEventListener('change', () => { skyFill.visible = fillInput.checked; render(); });
exportButton.addEventListener('click', () => {
  render();
  renderer.domElement.toBlob((blob) => {
    if (!blob) { setStatus('PNG 輸出失敗，請重試。', true); return; }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'leaflight-blender-review.png';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, 'image/png');
});
window.addEventListener('resize', resize);
document.addEventListener('keydown', (event) => { if (event.key === 'Home') { event.preventDefault(); resetView(); } });
window.addEventListener('pagehide', () => {
  controls?.dispose();
  if (modelRoot) disposeModel(modelRoot);
  detachedHero?.removeFromParent();
  renderer.dispose();
}, { once: true });

void loadModel();
