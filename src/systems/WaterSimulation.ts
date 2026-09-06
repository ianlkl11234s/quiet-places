import * as THREE from 'three';

export interface WaterSimulation {
  readonly texture: THREE.Texture;
  readonly texelSize: THREE.Vector2;
  update(dt: number): void;
  disturb(u: number, v: number): void;
  reset(): void;
  inspect(): { finite: boolean; maxHeight: number; maxVelocity: number; stateNorm: number; steps: number };
  dispose(): void;
}

const GRID_SIZE = 128;
const DOMAIN_METERS = 3.6;
const FIXED_DT = 1 / 120;
const MAX_FRAME_DT = 0.05;
const MAX_STEPS = 6;

const fullscreenVertex = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// RG stores height (metres) and vertical velocity (metres/second).  The speed
// and timestep give c * dt / dx = 0.163. Including the dispersive term,
// dt² * (8*c²/dx² + 64*beta/dx⁴) is about .220, below the linear stability bound 4.
// This remains a simplified dispersive heightfield, not 3-D fluid dynamics.
const initialFragment = /* glsl */ `
  uniform vec2 uResolution;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float valueNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
  }
  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec2 p = uv * 9.0;
    // Low-frequency, non-periodic seed; expected millimetre-scale variation.
    float organic = valueNoise(p + vec2(4.2, 1.7)) * .55 + valueNoise(p * 1.83 + vec2(9.1, 3.4)) * .45;
    float h = (organic - .5) * .007;
    float rim = smoothstep(0.0, .055, min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y)));
    gl_FragColor = vec4(h * rim, 0.0, 0.0, 1.0);
  }
`;

const stepFragment = /* glsl */ `
  uniform sampler2D uState;
  uniform vec2 uTexel;
  uniform float uDt;
  uniform float uTime;
  uniform vec2 uPulse;
  uniform float uPulseActive;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
  }
  float heightAt(vec2 uv) { vec2 mirrored=1.-abs(1.-abs(uv));return texture2D(uState, clamp(mirrored, uTexel * .5, 1.0 - uTexel * .5)).r; }
  void main() {
    vec2 uv = gl_FragCoord.xy * uTexel;
    vec2 state = texture2D(uState, uv).rg;
    // Mirrored ghost samples implement Neumann boundaries for both stencils.
    float h = state.r;
    vec2 x=vec2(uTexel.x,0.), y=vec2(0.,uTexel.y);
    float axial=heightAt(uv+x)+heightAt(uv-x)+heightAt(uv+y)+heightAt(uv-y);
    float diagonal=heightAt(uv+x+y)+heightAt(uv+x-y)+heightAt(uv-x+y)+heightAt(uv-x-y);
    float distant=heightAt(uv+2.*x)+heightAt(uv-2.*x)+heightAt(uv+2.*y)+heightAt(uv-2.*y);
    const float dx2=.000791015625;
    float lap=(axial-4.*h)/dx2;
    float biharm=(20.*h-8.*axial+2.*diagonal+distant)/(dx2*dx2);
    float c=.55;
    float edge = 1.0 - smoothstep(.055, .20, min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y)));
    // Sparse, smoothly changing wind pressure keeps an otherwise quiet pool alive.
    // Balanced pressure modes avoid adding a persistent net water-level force.
    float wind=.004*(cos(uv.x*6.283185)*cos(uv.y*12.56637)*sin(uTime*.8)
      +.55*cos(uv.x*18.84956)*cos(uv.y*6.283185)*sin(uTime*1.13+.6));
    // A local depression with an equal displaced ring. Its plane integral is
    // zero: unlike a positive velocity impulse, it does not inflate the pool.
    float q=dot(uv-uPulse,uv-uPulse)/(2.*.018*.018);
    float pulse=.003*(q-1.)*exp(-q)*uPulseActive;
    float velocity = state.g + uDt * (c*c*lap - .000001*biharm - (.9+edge*2.4)*state.g + wind);
    float nextHeight = h + uDt * velocity + pulse;
    gl_FragColor = vec4(nextHeight, velocity, 0.0, 1.0);
  }
`;

export function createWaterSimulation(renderer: THREE.WebGLRenderer): WaterSimulation {
  if (!renderer.capabilities.isWebGL2) throw new Error('Water simulation requires WebGL 2 for floating-point render targets.');
  const gl = renderer.getContext();
  if (!gl.getExtension('EXT_color_buffer_float')) {
    throw new Error('Water simulation requires EXT_color_buffer_float; this browser cannot render the floating-point wave field.');
  }

  const targetOptions: THREE.RenderTargetOptions = {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    // Bilinear lookup makes the rendered surface continuous. The PDE itself
    // uses explicit texel fetch offsets, so its numerical stencil stays exact.
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  };
  const targets = [new THREE.WebGLRenderTarget(GRID_SIZE, GRID_SIZE, targetOptions), new THREE.WebGLRenderTarget(GRID_SIZE, GRID_SIZE, targetOptions)];
  targets.forEach((target) => { target.texture.generateMipmaps = false; target.texture.colorSpace = THREE.NoColorSpace; });
  let read = targets[0], write = targets[1];
  const texelSize = new THREE.Vector2(1 / GRID_SIZE, 1 / GRID_SIZE);
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const geometry = new THREE.PlaneGeometry(2, 2);
  const initMaterial = new THREE.ShaderMaterial({vertexShader: fullscreenVertex, fragmentShader: initialFragment, uniforms: {uResolution: {value: new THREE.Vector2(GRID_SIZE, GRID_SIZE)}}, depthTest: false, depthWrite: false});
  const stepMaterial = new THREE.ShaderMaterial({vertexShader: fullscreenVertex, fragmentShader: stepFragment, uniforms: {
    uState: {value: read.texture}, uTexel: {value: texelSize}, uDt: {value: FIXED_DT}, uTime: {value: 0}, uPulse: {value: new THREE.Vector2(.5, .5)}, uPulseActive: {value: 0},
  }, depthTest: false, depthWrite: false});
  const quad = new THREE.Mesh(geometry, initMaterial);
  scene.add(quad);
  let accumulator = 0;
  let elapsed = 0;
  let totalSteps = 0;
  let pulsePending = false;
  const pulse = stepMaterial.uniforms.uPulse.value as THREE.Vector2;

  function withRendererState(render: () => void) {
    const previousTarget = renderer.getRenderTarget();
    const viewport = renderer.getViewport(new THREE.Vector4());
    const scissor = renderer.getScissor(new THREE.Vector4());
    const scissorTest = renderer.getScissorTest();
    const autoClear = renderer.autoClear;
    try { render(); } finally {
      renderer.setRenderTarget(previousTarget);
      renderer.setViewport(viewport);
      renderer.setScissor(scissor);
      renderer.setScissorTest(scissorTest);
      renderer.autoClear = autoClear;
    }
  }

  function initialise() {
    withRendererState(() => {
      quad.material = initMaterial;
      renderer.autoClear = true;
      for (const target of targets) {
        renderer.setRenderTarget(target);
        renderer.setViewport(0, 0, GRID_SIZE, GRID_SIZE);
        renderer.setScissorTest(false);
        renderer.clear();
        renderer.render(scene, camera);
      }
    });
    read = targets[0]; write = targets[1]; accumulator = 0; elapsed = 0; totalSteps = 0; pulsePending = false;
  }

  try{initialise();}catch(error){geometry.dispose();initMaterial.dispose();stepMaterial.dispose();targets.forEach(target=>target.dispose());throw error;}

  return {
    get texture() { return read.texture; },
    texelSize,
    update(frameDt: number) {
      if(!Number.isFinite(frameDt)||frameDt<=0)return;
      accumulator += Math.min(frameDt, MAX_FRAME_DT);
      let steps = 0;
      withRendererState(() => {
        quad.material = stepMaterial;
        renderer.autoClear = true;
        renderer.setViewport(0, 0, GRID_SIZE, GRID_SIZE);
        renderer.setScissorTest(false);
        while (accumulator >= FIXED_DT && steps < MAX_STEPS) {
          stepMaterial.uniforms.uState.value = read.texture;
          stepMaterial.uniforms.uTime.value = elapsed;
          stepMaterial.uniforms.uPulseActive.value = pulsePending ? 1 : 0;
          renderer.setRenderTarget(write);
          renderer.clear();
          renderer.render(scene, camera);
          const oldRead = read; read = write; write = oldRead;
          elapsed += FIXED_DT; accumulator -= FIXED_DT; steps += 1; totalSteps += 1; pulsePending = false;
        }
      });
      // Do not catch up indefinitely after throttling: remaining time is discarded
      // only after the bounded fixed-step budget has been consumed.
      if (steps === MAX_STEPS) accumulator = 0;
    },
    disturb(u: number, v: number) {
      if(!Number.isFinite(u)||!Number.isFinite(v))return;
      pulse.set(THREE.MathUtils.clamp(u, .065, .935), THREE.MathUtils.clamp(v, .065, .935));
      pulsePending = true;
    },
    reset() { initialise(); },
    inspect() {
      // This is intentionally opt-in: normal animation never synchronises GPU
      // state back to the CPU. Half float readback depends on the extension
      // checked at construction; surface a clear failure instead of inventing
      // a diagnostic result when a driver refuses it.
      const pixels = new Uint16Array(GRID_SIZE * GRID_SIZE * 4);
      try {
        const previousError=gl.getError();
        if(previousError!==gl.NO_ERROR)throw new Error(`Pre-existing GL error 0x${previousError.toString(16)} prevents reliable diagnostics.`);
        renderer.readRenderTargetPixels(read, 0, 0, GRID_SIZE, GRID_SIZE, pixels);
        const error = gl.getError();
        if (error !== gl.NO_ERROR) throw new Error(`WebGL half-float readback failed (GL error 0x${error.toString(16)}).`);
      } catch (cause) {
        throw new Error('Water simulation diagnostics require supported half-float render-target readback.', {cause});
      }
      let finite = true, maxHeight = 0, maxVelocity = 0, stateNorm = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const height = THREE.DataUtils.fromHalfFloat(pixels[i]);
        const velocity = THREE.DataUtils.fromHalfFloat(pixels[i + 1]);
        if (!Number.isFinite(height) || !Number.isFinite(velocity)) finite = false;
        maxHeight = Math.max(maxHeight, Math.abs(height));
        maxVelocity = Math.max(maxVelocity, Math.abs(velocity));
        // Diagnostic norm only: mixed units, not physical fluid energy.
        stateNorm += height * height + velocity * velocity;
      }
      return {finite, maxHeight, maxVelocity, stateNorm, steps: totalSteps};
    },
    dispose() { geometry.dispose(); initMaterial.dispose(); stepMaterial.dispose(); targets.forEach((target) => target.dispose()); },
  };
}
