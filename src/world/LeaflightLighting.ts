import * as THREE from 'three';

export interface LeaflightLighting {
  sun: THREE.DirectionalLight;
  /** Set this to 0 when baked indirect lighting is present. */
  fill: THREE.HemisphereLight;
  update(time: number, beamStrength: number, daylight?: number, warmth?: number, angle?: number): void;
  dispose(): void;
}

const roomMin = new THREE.Vector3(-4, 0, -4);
const roomMax = new THREE.Vector3(4, 8, 6);
const shadowMin = new THREE.Vector3(-4, 0, -4);
const shadowMax = new THREE.Vector3(8, 9, 6);
const incomingSun = new THREE.Vector3(-1, -.85, -.45).normalize();

const skyVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;

const skyFragment = /* glsl */ `
  uniform float uTime;
  uniform float uDaylight;
  uniform float uWarmth;
  uniform vec3 uSun;
  varying vec3 vWorld;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
  }
  float cloudField(vec2 p) {
    float n = noise(p) * .58;
    n += noise(p * 2.03 + vec2(13.2, 4.7)) * .27;
    n += noise(p * 4.17 + vec2(-2.1, 8.3)) * .15;
    return n;
  }
  void main() {
    vec3 d = normalize(vWorld - cameraPosition);
    float horizon = smoothstep(-.16, .82, d.y);
    float zenith = smoothstep(-.12, .48, d.y);
    vec3 nightLow = vec3(.010, .016, .028);
    vec3 nightHigh = vec3(.018, .036, .068);
    float sunset = smoothstep(.6, 1.0, uWarmth);
    // A cool, low-contrast sky keeps the window view natural without turning it
    // into a flat white panel at the room’s exposure.
    vec3 low = mix(vec3(.40, .49, .56), vec3(.67, .62, .55), sunset);
    vec3 high = mix(vec3(.13, .29, .47), vec3(.38, .34, .35), sunset);
    vec3 daySky = mix(low, high, zenith);
    vec3 color = mix(mix(nightLow, nightHigh, horizon), daySky, uDaylight);

    // Broad near-horizon scattering makes the pale, grey-white band read as
    // atmospheric haze rather than a hard graphic gradient.
    float haze = pow(1.0 - smoothstep(-.10, .58, d.y), 1.45);
    vec3 hazeColor = mix(vec3(.72, .75, .74), vec3(.76, .69, .59), sunset);
    color = mix(color, hazeColor, haze * .035 * uDaylight);

    // Three inexpensive value-noise octaves make only a barely visible, slowly
    // drifting cloud veil; keeping the contrast low preserves the room mood.
    vec2 cloudP = d.xz / max(.28, d.y + .42) * 3.8 + vec2(uTime * .003, -uTime * .0015);
    float cloudBand = smoothstep(-.10, .62, d.y) * (1.0 - smoothstep(.62, .96, d.y) * .55);
    float clouds = smoothstep(.38, .74, cloudField(cloudP)) * cloudBand;
    vec3 cloudColor = mix(vec3(.70, .73, .73), vec3(.74, .69, .60), sunset);
    color = mix(color, cloudColor, clouds * .20 * uDaylight);
    vec3 toSun = normalize(-uSun);
    float softSun = pow(max(dot(d, toSun), 0.0), 32.0);
    color += mix(vec3(.62, .72, .78), vec3(.90, .72, .48), uWarmth) * softSun * (.012 + .045 * uDaylight);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const volumeVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;

// The volume is a room-bounded fallback because this factory deliberately has
// no renderer/depth-texture argument. It therefore cannot be occluded by fish
// bodies or other dynamic opaque meshes; the AABB still prevents rays leaking
// through the room's front wall when the camera remains inside the room.
const volumeFragment = /* glsl */ `
  uniform float uTime;
  uniform float uBeam;
  uniform float uDaylight;
  uniform float uWarmth;
  uniform vec3 uSun;
  uniform sampler2D uShadowMap;
  uniform mat4 uShadowMatrix;
  uniform float uHasShadowMap;
  varying vec3 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(73.17, 191.31))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
  }
  #include <packing>
  vec2 hitBox(vec3 ro, vec3 rd) {
    vec3 lo = vec3(-4., 0., -4.), hi = vec3(4., 8., 6.);
    vec3 a = (lo - ro) / rd, b = (hi - ro) / rd;
    vec3 nearP = min(a, b), farP = max(a, b);
    return vec2(max(max(nearP.x, nearP.y), nearP.z), min(min(farP.x, farP.y), farP.z));
  }
  float inWindow(vec3 p) {
    // Trace the incoming ray back to x=4, then test the actual window rectangle.
    float t = (p.x - 4.0) / uSun.x;
    if (t < 0.0) return 0.0;
    vec3 source = p - uSun * t;
    float y = smoothstep(4.6, 4.78, source.y) * (1.0 - smoothstep(7.32, 7.5, source.y));
    float z = smoothstep(-3.2, -3.02, source.z) * (1.0 - smoothstep(3.02, 3.2, source.z));
    return y * z;
  }
  float treeShadow(vec3 p) {
    if (uHasShadowMap < .5) return 1.0;
    vec4 shadow = uShadowMatrix * vec4(p, 1.0);
    shadow.xyz /= shadow.w;
    if (any(lessThan(shadow.xyz, vec3(0.0))) || any(greaterThan(shadow.xyz, vec3(1.0)))) return 1.0;
    float mapDepth = unpackRGBAToDepth(texture2D(uShadowMap, shadow.xy));
    return shadow.z - .0015 <= mapDepth ? 1.0 : .18;
  }
  void main() {
    vec3 ro = cameraPosition;
    // The shader is only valid from within its proxy, avoiding a fullscreen veil outside the room.
    if (any(lessThan(ro, vec3(-4., 0., -4.))) || any(greaterThan(ro, vec3(4., 8., 6.)))) discard;
    vec3 rd = normalize(vWorld - ro);
    vec2 hit = hitBox(ro, rd);
    float start = max(hit.x, 0.0), end = hit.y;
    if (end <= start) discard;
    // Keep the empty opening optically clear. The approximate room volume has
    // no exterior depth; do not composite it as a veil over sky and branches.
    vec3 exitPoint = ro + rd * end;
    if (exitPoint.x > 3.99 && exitPoint.y > 4.6 && exitPoint.y < 7.5
        && abs(exitPoint.z) < 3.2) discard;
    const int STEPS = 12;
    float stepSize = (end - start) / float(STEPS);
    float sum = 0.0;
    float jitter = hash(gl_FragCoord.xy);
    for (int i = 0; i < STEPS; i++) {
      vec3 p = ro + rd * (start + (float(i) + jitter) * stepSize);
      float opening = inWindow(p);
      // This modulation only perturbs density in the physically admitted ray bundle;
      // it does not invent independent light bars in the room.
      float air = .8;
      sum += opening * air * treeShadow(p);
    }
    float alpha = (1.0 - exp(-sum * stepSize * (.009 * clamp(uBeam, 0.0, 2.5)))) * .55 * uDaylight;
    gl_FragColor = vec4(mix(vec3(.55, .72, 1.0), vec3(1.0, .75, .45), uWarmth), alpha);
  }
`;

function fitShadow(sun: THREE.DirectionalLight) {
  const corners: THREE.Vector3[] = [];
  for (const x of [shadowMin.x, shadowMax.x]) for (const y of [shadowMin.y, shadowMax.y]) for (const z of [shadowMin.z, shadowMax.z]) corners.push(new THREE.Vector3(x, y, z));
  sun.updateMatrixWorld(true);
  sun.target.updateMatrixWorld(true);
  sun.shadow.updateMatrices(sun);
  const lightSpace = new THREE.Box3().makeEmpty();
  for (const corner of corners) lightSpace.expandByPoint(corner.applyMatrix4(sun.shadow.camera.matrixWorldInverse));
  const camera = sun.shadow.camera as THREE.OrthographicCamera;
  const margin = .55;
  camera.left = lightSpace.min.x - margin;
  camera.right = lightSpace.max.x + margin;
  camera.bottom = lightSpace.min.y - margin;
  camera.top = lightSpace.max.y + margin;
  camera.near = Math.max(.1, -lightSpace.max.z - margin);
  camera.far = Math.max(camera.near + .1, -lightSpace.min.z + margin);
  camera.updateProjectionMatrix();
}

export function createLeaflightLighting(scene: THREE.Scene): LeaflightLighting {
  const root = new THREE.Group();
  root.name = 'leaflight-lighting';
  const center = new THREE.Vector3(0, 4, 1);
  const sun = new THREE.DirectionalLight(new THREE.Color().setRGB(1, .75, .45), 20);
  sun.position.copy(center).addScaledVector(incomingSun, -20);
  sun.target.position.copy(center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -.0003;
  sun.shadow.normalBias = .02;
  root.add(sun, sun.target);
  fitShadow(sun);

  // This is only a small non-baked approximation. Consumers with baked indirect
  // lighting can set `lighting.fill.intensity = 0` and it will remain disabled.
  const hemisphere = new THREE.HemisphereLight(new THREE.Color(.33, .44, .54), new THREE.Color(.13, .08, .045), .12);
  root.add(hemisphere);

  const skyMaterial = new THREE.ShaderMaterial({
    vertexShader: skyVertex, fragmentShader: skyFragment, side: THREE.BackSide,
    uniforms: {uTime: {value: 0}, uBeam: {value: 1}, uDaylight: {value: 1}, uWarmth: {value: .48}, uSun: {value: incomingSun.clone()}},
    depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(48, 32, 20), skyMaterial);
  sky.name = 'leaflight-sky'; sky.position.copy(center); root.add(sky);

  const volumeUniforms = {
    uTime: {value: 0}, uBeam: {value: 1}, uDaylight: {value: 1}, uWarmth: {value: .48}, uSun: {value: incomingSun.clone()},
    uShadowMap: {value: null as THREE.Texture | null}, uShadowMatrix: {value: sun.shadow.matrix.clone()}, uHasShadowMap: {value: 0},
  };
  const volumeMaterial = new THREE.ShaderMaterial({
    vertexShader: volumeVertex, fragmentShader: volumeFragment, uniforms: volumeUniforms,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, toneMapped: false,
  });
  const volume = new THREE.Mesh(new THREE.BoxGeometry(roomMax.x - roomMin.x, roomMax.y - roomMin.y, roomMax.z - roomMin.z), volumeMaterial);
  volume.name = 'leaflight-window-volume';
  volume.position.copy(roomMin).add(roomMax).multiplyScalar(.5);
  volume.renderOrder = 1;
  // ShadowMap renders before the main pass. Refresh here as well as in update so
  // a changed time-of-day direction cannot leave the volume sampling last frame.
  volume.onBeforeRender = () => {
    const map = sun.shadow.map?.texture ?? null;
    volumeUniforms.uShadowMap.value = map;
    volumeUniforms.uHasShadowMap.value = map ? 1 : 0;
    volumeUniforms.uShadowMatrix.value.copy(sun.shadow.matrix);
  };
  root.add(volume);
  scene.add(root);
  let lastAngle=NaN;
  const sunDirection=incomingSun.clone(),up=new THREE.Vector3(0,1,0);

  return {
    sun,
    fill: hemisphere,
    update(time, beamStrength, daylight = 1, warmth = .48, angle = .25) {
      const beam = THREE.MathUtils.clamp(beamStrength, 0, 2.5);
      const day = THREE.MathUtils.clamp(daylight, .09, 1);
      const warm = THREE.MathUtils.clamp(warmth, 0, 1);
      // The time-of-day angle is deliberately a small yaw around the Blender ray,
      // anchored at .25 so existing calls preserve the approved composition.
      if(angle!==lastAngle){
        sunDirection.copy(incomingSun).applyAxisAngle(up,THREE.MathUtils.clamp(angle-.25,-.2,.2));
        sun.position.copy(center).addScaledVector(sunDirection,-20);sun.target.position.copy(center);
        fitShadow(sun);lastAngle=angle;
      }
      const warmthWeight=THREE.MathUtils.clamp(warm/.48,0,1),sunset=THREE.MathUtils.clamp((warm-.48)/.52,0,1);
      sun.color.setRGB(THREE.MathUtils.lerp(.55,1,warmthWeight),THREE.MathUtils.lerp(.72,.75-.2*sunset,warmthWeight),THREE.MathUtils.lerp(1,.45-.2*sunset,warmthWeight));
      sun.intensity = 20 * day;
      skyMaterial.uniforms.uTime.value = time;
      skyMaterial.uniforms.uBeam.value = beam;
      skyMaterial.uniforms.uDaylight.value = day;
      skyMaterial.uniforms.uWarmth.value = warm;
      skyMaterial.uniforms.uSun.value.copy(sunDirection);
      volumeUniforms.uTime.value = time;
      volumeUniforms.uBeam.value = beam;
      volumeUniforms.uDaylight.value = day;
      volumeUniforms.uWarmth.value = warm;
      volumeUniforms.uSun.value.copy(sunDirection);
      // The first update normally precedes shadow-map allocation. Keep air-light
      // visible until the next frame, then use the real tree-caster shadow texture.
      const map = sun.shadow.map?.texture ?? null;
      volumeUniforms.uShadowMap.value = map;
      volumeUniforms.uHasShadowMap.value = map ? 1 : 0;
      volumeUniforms.uShadowMatrix.value.copy(sun.shadow.matrix);
    },
    dispose() {
      scene.remove(root);
      sky.geometry.dispose(); skyMaterial.dispose();
      volume.geometry.dispose(); volumeMaterial.dispose();
      sun.shadow.map?.dispose();
    },
  };
}
