import * as THREE from 'three';
import type {SceneState} from '../../player/contracts.ts';

// Weak image-based fill for the ocean room (candidate, see docs/scenes/oceanlight.md).
// The radiance map only contains what a point in the room can see: the window
// band of sky/sea toward -Z and a faint floor bounce from below. It contains no
// sun disc and no direct light, so it does not double the photon-map transport.
// Walls/ceiling are black in the map: dark corners stay dark instead of an
// omnidirectional ambient lift.

const WIDTH = 64, HEIGHT = 32;
/** Upper bound of scene.environmentIntensity at full daylight. */
export const OCEAN_AMBIENT_CAP = 1;

const skyNoon = new THREE.Color(.23, .39, .49), skyBeige = new THREE.Color(.77, .61, .43);
const skyDawn = new THREE.Color(.80, .56, .42), skyDusk = new THREE.Color(.92, .47, .20);
const sea = new THREE.Color(.05, .12, .13);

const smooth = (a: number, b: number, x: number) => {const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t);};

/** Morning-only weight of the dawn palette, as in Surface.ts skyColor(). */
export const oceanDawnWeight = (warmth: number, angle: number) => smooth(.5, .7, THREE.MathUtils.clamp(warmth, 0, 1)) * (1 - smooth(0, .3, angle));

/** Mirrors the horizon colour of Surface.ts skyColor() without intensity scaling. */
export function oceanAmbientHorizon(warmth: number, dawn = oceanDawnWeight(warmth, -1), target = new THREE.Color()) {
  const warm = THREE.MathUtils.clamp(warmth, 0, 1);
  target.copy(skyNoon).lerp(skyBeige, Math.min(warm, .5));
  target.lerp(skyDawn, dawn);
  return target.lerp(skyDusk, smooth(.75, .95, warm));
}

/** Time-of-day gate: zero at the moon keyframe, full from mid-morning on. */
export function oceanAmbientIntensity(intensity: number, waterFactor = 1) {
  const i = THREE.MathUtils.clamp(intensity, 0, 1);
  return OCEAN_AMBIENT_CAP * i * smooth(.10, .45, i) * waterFactor;
}

/** Fill an equirect radiance map; direction mapping matches three's equirectUv. */
export function fillOceanAmbient(pixels: Float32Array, warmth: number, dawn = oceanDawnWeight(warmth, -1)) {
  const horizon = oceanAmbientHorizon(warmth, dawn), floorTint = new THREE.Color(.52, .47, .40).lerp(horizon, .35);
  const color = new THREE.Color();
  for (let y = 0; y < HEIGHT; y++) {
    const lat = ((y + .5) / HEIGHT - .5) * Math.PI;
    for (let x = 0; x < WIDTH; x++) {
      const phi = ((x + .5) / WIDTH - .5) * Math.PI * 2;
      const dx = Math.cos(phi) * Math.cos(lat), dz = Math.sin(phi) * Math.cos(lat);
      // Window: azimuth around -Z (about ±34° seen from mid-room), elevation −12°..+8°.
      const azimuth = Math.abs(Math.atan2(dx, -dz));
      const window = (1 - smooth(.45, .75, azimuth)) * smooth(-.30, -.16, lat) * (1 - smooth(.10, .24, lat));
      color.setRGB(0, 0, 0);
      if (window > 0) color.copy(sea).lerp(horizon, smooth(-.18, .02, lat)).multiplyScalar(window);
      // Faint diffuse return from the lit floor below; no upward sky dome.
      const below = smooth(-.15, -.9, lat) * .07;
      color.r += floorTint.r * below; color.g += floorTint.g * below; color.b += floorTint.b * below;
      const i = (y * WIDTH + x) * 4;
      pixels[i] = color.r; pixels[i + 1] = color.g; pixels[i + 2] = color.b; pixels[i + 3] = 1;
    }
  }
}

export function createOceanAmbient(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  const pixels = new Float32Array(WIDTH * HEIGHT * 4);
  const source = new THREE.DataTexture(pixels, WIDTH, HEIGHT, THREE.RGBAFormat, THREE.FloatType);
  source.mapping = THREE.EquirectangularReflectionMapping; source.colorSpace = THREE.LinearSRGBColorSpace;
  source.minFilter = source.magFilter = THREE.LinearFilter; source.name = 'oceanlight-window-radiance';
  const pmrem = new THREE.PMREMGenerator(renderer);
  const prior = {environment: scene.environment, intensity: scene.environmentIntensity};
  let target: THREE.WebGLRenderTarget | undefined, step = '', disposed = false;
  return {
    update(state: SceneState, waterFactor = 1) {
      // 20 warmth × 10 dawn-weight steps: regenerate the 64×32 PMREM only when the colour moves.
      const warm = Math.round(THREE.MathUtils.clamp(state.warmth, 0, 1) * 20) / 20;
      const dawn = Math.round(oceanDawnWeight(state.warmth, state.angle) * 10) / 10;
      const next = `${warm}|${dawn}`;
      if (next !== step) {
        step = next; fillOceanAmbient(pixels, warm, dawn); source.needsUpdate = true;
        const previous = target; target = pmrem.fromEquirectangular(source);
        scene.environment = target.texture; previous?.dispose();
      }
      scene.environmentIntensity = oceanAmbientIntensity(state.intensity, waterFactor);
    },
    dispose() {
      if (disposed) return; disposed = true;
      if (target && scene.environment === target.texture) scene.environment = prior.environment;
      scene.environmentIntensity = prior.intensity;
      target?.dispose(); pmrem.dispose(); source.dispose();
    },
  };
}
