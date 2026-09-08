import type {SceneState} from '../../player/contracts.ts';
import {seededRandom} from '../../shared/math/seededRandom.ts';
import * as THREE from 'three';
import {WATER_ROOM} from './Room.ts';
import {createWaterSimulation} from '../../systems/WaterSimulation.ts';
import {oceanWaveGLSL} from '../../shared/water/Optics.ts';
import {disturbedSurfaceGLSL, disturbedSurfaceSlopeGLSL} from './SurfaceSampling.ts';
import {SHALLOW_SEA_BOTTOM, SHALLOW_SEA_DEPTH, shallowSeaSunDirection} from './ShallowSea.ts';


export interface WaterlightEnvironment {
  update(elapsed: number, state: SceneState, dt?: number): void;
  disturb(u: number, v: number): void;
  resetWater(): void;
  readonly waterMode: string;
  readonly hasSimulation: boolean;
  dispose(): void;
}

// Local light field beneath the skylight; physical walls use WATER_ROOM.
const LIGHT_CHAMBER = { width: 8, depth: 10, height: 7, opening: 3.6 };
// The room stays dry.  The ceiling opening is a zero-thickness air/water seal
// at y=7; the shallow sea continues from there to the animated free surface.
const SEA_BOTTOM = SHALLOW_SEA_BOTTOM;
const SEA_DEPTH = SHALLOW_SEA_DEPTH;

const causticVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;

// Low-frequency cloud noise; ocean geometry and normals use OceanOptics.
const waterField = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise2(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*f*(f*(f*6.-15.)+10.);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }

`;
// Bounded local focusing estimate from the shared two-interface wave field.
const causticFragment = /* glsl */ `
  uniform float uTime;
  uniform float uStrength;
  uniform sampler2D uWaves; uniform vec2 uWaveTexel; uniform float uUseSimulation;
  uniform vec3 uSunDirection;
  uniform float uWarmth;
  varying vec3 vWorld;
  ${oceanWaveGLSL}
  ${disturbedSurfaceSlopeGLSL}
  vec2 refractedOffset(vec2 p,float receiverDepth){
    vec2 slope=surfaceSlope(p);
    vec3 normal=normalize(vec3(-slope.x,1.,-slope.y));
    // The direct-light path crosses both interfaces: air -> water at the
    // moving free surface, then water -> air at the dry room's sealed bottom.
    vec3 waterRay=refract(-uSunDirection,normal,1./1.333);
    vec3 roomRay=refract(waterRay,vec3(0.,1.,0.),1.333);
    if(length(waterRay)<.01 || length(roomRay)<.01)return vec2(0.);
    return waterRay.xz/max(-waterRay.y,.08)*${SEA_DEPTH.toFixed(1)}+roomRay.xz/max(-roomRay.y,.08)*receiverDepth;
  }
  void main() {
    vec3 sun=-uSunDirection;
    float rise = ${SEA_BOTTOM.toFixed(1)} - vWorld.y;
    vec2 roof = vec2(vWorld.x, vWorld.z) - sun.xz / sun.y * (vWorld.y - ${SEA_BOTTOM.toFixed(1)});
    float aperture = 1.0 - smoothstep(1.70, 2.03, max(abs(roof.x), abs(roof.y + .2)));
    // Estimate irradiance concentration from the Jacobian of the same Snell
    // mapping used for the incoming solar ray. This is a local approximation,
    // not a photon/path-traced caustic solver.
    vec3 incomingWater=refract(-uSunDirection,normalize(vec3(-surfaceSlope(roof).x,1.,-surfaceSlope(roof).y)),1./1.333);
    vec3 incomingRoom=refract(incomingWater,vec3(0.,1.,0.),1.333);
    if(length(incomingWater)<.01 || length(incomingRoom)<.01)discard;
    float e=.035;
    vec2 ox=(refractedOffset(roof+vec2(e,0.),rise)-refractedOffset(roof-vec2(e,0.),rise))/(2.*e);
    vec2 oz=(refractedOffset(roof+vec2(0.,e),rise)-refractedOffset(roof-vec2(0.,e),rise))/(2.*e);
    float jac=abs((1.+ox.x)*(1.+oz.y)-ox.y*oz.x);
    float transmit=1.-pow(1.-max(dot(normalize(vec3(-surfaceSlope(roof).x,1.,-surfaceSlope(roof).y)),uSunDirection),0.),5.);
    float focus=clamp(1./max(jac,.42),.45,2.25)*transmit;
    float fade = (1.0 - smoothstep(0., 16., rise) * .45) * aperture;
    vec3 cool = vec3(.34, .79, .77);
    vec3 cream = vec3(1.0, .78, .45);
    vec3 tint = mix(cool, cream, clamp(uWarmth, 0.0, 1.0));
    gl_FragColor = vec4(tint * max(focus-.58,0.) * fade * uStrength * .16, 1.0);
  }
`;

// The lower plane is an ideal sealed air/water interface. It is deliberately
// opaque: its transmitted colour follows a camera ray through the scene-depth water
// layer and the moving free surface, so the room never becomes water-filled by
// alpha blending or a second, accidental refraction pass.
const shallowSeaFragment = /* glsl */ `
  uniform float uTime; uniform float uWarmth; uniform float uIntensity; uniform float uRain;
  uniform vec3 uSunDirection; uniform vec3 uAbsorption;
  uniform sampler2D uWaves; uniform vec2 uWaveTexel; uniform float uUseSimulation;
  varying vec3 vWorld;
  ${waterField}
  ${oceanWaveGLSL}
  ${disturbedSurfaceGLSL}
  vec3 skyAt(vec3 d){
    float up=clamp(d.y,0.,1.);
    float sunset=smoothstep(.6,.95,uWarmth);
    vec3 horizon=mix(vec3(.20,.48,.62),vec3(.78,.64,.45),sunset);
    vec3 zenith=mix(vec3(.045,.24,.43),vec3(.34,.31,.36),sunset);
    vec3 sky=mix(horizon,zenith,pow(up,.48));
    // Broad, low-contrast clouds are sampled after both refractions. They
    // make the moving ray bend legible without adding a second water pattern.
    vec2 cloudP=d.xz/max(d.y,.16)*2.6+vec2(2.1+uTime*.003,5.7-uTime*.002);
    float cloud=noise2(cloudP)+noise2(cloudP*2.07+vec2(3.1,7.4))*.38;
    cloud=smoothstep(.38,1.30,cloud);
    sky=mix(sky,mix(vec3(.65,.78,.82),vec3(.88,.77,.60),sunset),cloud*.24);
    sky=mix(sky,vec3(.25,.32,.35)+cloud*.12,uRain*.75);
    sky+=mix(vec3(.92,.97,1.),vec3(1.,.82,.55),uWarmth)*pow(max(dot(d,uSunDirection),0.),260.)*.55;
    return sky*(.035+uIntensity*.965);
  }
  void main(){
    vec3 incoming=normalize(vWorld-cameraPosition);
    // Air -> water at the sealed underside. N faces the incident air ray.
    vec3 waterRay=refract(incoming,vec3(0.,-1.,0.),1./1.333);
    if(length(waterRay)<.01){ gl_FragColor=vec4(vec3(.015,.028,.032),1.); return; }
    vec2 start=vWorld.xz;
    float top=${SEA_BOTTOM.toFixed(1)}+${SEA_DEPTH.toFixed(1)}+oceanHeight(start,uTime)+disturbanceHeight(start);
    float travel=max((top-vWorld.y)/max(waterRay.y,.05),0.);
    vec3 surfacePoint=vWorld+waterRay*travel;
    // One re-sample keeps the free-surface height and normal responsive to
    // rain/click disturbances without a second refractive interface.
    top=${SEA_BOTTOM.toFixed(1)}+${SEA_DEPTH.toFixed(1)}+oceanHeight(surfacePoint.xz,uTime)+disturbanceHeight(surfacePoint.xz);
    travel=max((top-vWorld.y)/max(waterRay.y,.05),0.);
    surfacePoint=vWorld+waterRay*travel;
    vec2 slope=surfaceSlope(surfacePoint.xz);
    vec3 surfaceNormal=normalize(vec3(-slope.x,1.,-slope.y));
    // Water -> air at the same free surface. TIR stays a dark internal reflection.
    vec3 airRay=refract(waterRay,-surfaceNormal,1.333);
    float lowerF=.0204+.9796*pow(1.-clamp(dot(vec3(0.,-1.,0.),-incoming),0.,1.),5.);
    float upperF=.0204+.9796*pow(1.-clamp(dot(surfaceNormal,waterRay),0.,1.),5.);
    vec3 attenuation=exp(-uAbsorption*travel);
    vec3 waterTint=mix(vec3(.018,.32,.40),vec3(.20,.36,.33),uWarmth)*(.18+uIntensity*.46);
    vec3 reflected=vec3(.012,.027,.032)+skyAt(reflect(incoming,vec3(0.,-1.,0.)))*lowerF*.12;
    if(length(airRay)<.01){ gl_FragColor=vec4(reflected+waterTint*.32,1.); return; }
    vec3 transmitted=mix(waterTint,skyAt(normalize(airRay)),attenuation);
    vec3 topReflection=skyAt(reflect(waterRay,surfaceNormal));
    vec3 throughTop=mix(transmitted,topReflection,upperF);
    gl_FragColor=vec4(mix(throughTop,reflected,lowerF),1.);
  }
`;

// A back-face room proxy gives each camera ray a bounded exit point.  The
// fragment shader integrates the segment inside the room, so orbiting the
// camera never reveals intersecting transparent sheets.
const volumeVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() { vWorld=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.); }
`;
const volumeFragment = /* glsl */ `
  uniform float uTime; uniform float uStrength; uniform float uWarmth; uniform float uAngle;
  uniform sampler2D uWaves; uniform vec2 uWaveTexel; uniform float uUseSimulation; uniform float uLowQuality;
  ${oceanWaveGLSL}
  ${disturbedSurfaceSlopeGLSL}
  varying vec3 vWorld;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
  vec2 boxHit(vec3 ro,vec3 rd){
    vec3 lo=vec3(-4.,0.,-5.),hi=vec3(4.,7.,5.);
    vec3 a=(lo-ro)/rd,b=(hi-ro)/rd;
    vec3 near=min(a,b),far=max(a,b);
    return vec2(max(max(near.x,near.y),near.z),min(min(far.x,far.y),far.z));
  }
  void main(){
    vec3 ro=cameraPosition, rd=normalize(vWorld-ro);
    vec2 hit=boxHit(ro,rd);
    float begin=max(hit.x,0.), finish=hit.y;
    if(finish<=begin) discard;
    vec3 sun=normalize(vec3(-.45+sin(uAngle)*.14,-1.,-.30+sin(uAngle*.7)*.10));
    float sum=0.;
    const int STEPS=48;
    float count=uLowQuality>.5?24.:48.;
    float stepSize=(finish-begin)/count;
    for(int i=0;i<STEPS;i++){
      if(float(i)>=count)break;
      float jitter=hash(gl_FragCoord.xy);
      vec3 p=ro+rd*(begin+(float(i)+jitter)*stepSize);
      vec2 roof=p.xz-sun.xz/sun.y*(p.y-7.);
      // One bounded inverse projection from the shared surface normal. This
      // couples shafts to the visible waves without claiming a caustic solve.
      float depth=7.-p.y;
      vec2 slope=surfaceSlope(roof);
      vec3 waterRay=refract(sun,normalize(vec3(-slope.x,1.,-slope.y)),1./1.333);
      vec3 roomRay=refract(waterRay,vec3(0.,1.,0.),1.333);
      if(length(waterRay)<.01 || length(roomRay)<.01)continue;
      vec2 shift=(roomRay.xz/max(-roomRay.y,.15)-sun.xz/(-sun.y))*depth*.45;
      shift*=min(1.,.48/max(length(shift),.001));
      vec2 footprint=roof-shift;
      float softness=mix(.20,.52,clamp(depth/7.,0.,1.));
      float aperture=1.-smoothstep(1.80-softness,1.80+softness,max(abs(footprint.x),abs(footprint.y+.2)));
      // Broad irregular patches replace periodic hard-edged light curtains.
      // The wave-driven footprint moves both their density and soft boundary.
      float broad=noise2(footprint*1.65+slope*.8);
      float detail=noise2(footprint*3.1+vec2(4.7,1.3));
      float field=broad*.78+detail*.22;
      float shaft=smoothstep(.18,.86,field);
      float falloff=exp(-length(footprint-vec2(0.,-.2))*.30)*(1.-smoothstep(6.55,7.,p.y));
      sum+=aperture*(.14+shaft*.55)*falloff;
    }
    float opticalDepth=sum*stepSize*.18*uStrength;
    vec3 tint=mix(vec3(.51,.72,.79),vec3(1.,.84,.61),uWarmth);
    // AdditiveBlending uses source alpha. Keep colour energy independent from
    // the accumulated alpha so the soft light field retains its colour.
    gl_FragColor=vec4(tint*.78, min(1.-exp(-opticalDepth),.52));
  }
`;

const dustVertex = /* glsl */ `
  attribute float aSeed; uniform float uTime; uniform float uAngle; uniform float uIntensity; varying float vAlpha;
  void main() {
    vec3 p = position;
    p.x += sin(uTime*.13+aSeed*19.)*.14 + sin(uAngle)*(.5-p.y/7.)*1.7;
    p.z += cos(uTime*.11+aSeed*31.)*.10;
    p.y = fract(uTime*.004+aSeed)*7.0;
    p.x += (-.45 + sin(uAngle)*.14)*(7.-p.y);
    p.z += (-.30 + sin(uAngle*.7)*.10)*(7.-p.y);
    vec4 mv = modelViewMatrix * vec4(p,1.);
    gl_PointSize = (1.2 + aSeed*2.2) * (7. / -mv.z);
    gl_Position = projectionMatrix * mv;
    vAlpha = smoothstep(0., .9, p.y) * (1.0-smoothstep(5.4,7.,p.y)) * (.25+aSeed*.75) * uIntensity;
  }
`;
const dustFragment = /* glsl */ `
  varying float vAlpha;
  void main() { float d=length(gl_PointCoord-.5); gl_FragColor=vec4(vec3(.92,.83,.63), vAlpha*(1.0-smoothstep(0.,.5,d))*.24); }
`;

export function createEnvironment(scene: THREE.Scene, renderer?: THREE.WebGLRenderer): WaterlightEnvironment {
  let simulation: ReturnType<typeof createWaterSimulation> | undefined;
  let waterMode='程序式水波';
  if(renderer){try{simulation=createWaterSimulation(renderer);waterMode='GPU 水面波動模擬';}catch(error){console.warn('GPU water unavailable, using procedural waves',error);waterMode='GPU 模擬不可用，使用程序式水波';}}
  const emptyWave=new THREE.DataTexture(new Float32Array(4),1,1,THREE.RGBAFormat,THREE.FloatType);emptyWave.needsUpdate=true;
  const waveUniforms={uWaves:{value:simulation?.texture??emptyWave},uWaveTexel:{value:simulation?.texelSize??new THREE.Vector2(1/128,1/128)},uUseSimulation:{value:simulation?1:0}};
  const root = new THREE.Group();
  root.name = 'waterlight-environment';
  scene.add(root);
  const disposable: Array<THREE.BufferGeometry | THREE.Material> = [];
  const add = (mesh: THREE.Object3D) => { root.add(mesh); return mesh; };
  // A dark, but readable mineral surface. The small hemisphere term acts as bounced
  // skylight and keeps the architecture from collapsing into a pure silhouette.
  const roomUniforms = {uIntensity:{value:1},uAngle:{value:.25},uWarmth:{value:.48}};
  const roomMaterial = new THREE.ShaderMaterial({uniforms:roomUniforms,vertexShader:causticVertex,fragmentShader:/* glsl */ `
    varying vec3 vWorld;
    uniform float uIntensity; uniform float uAngle; uniform float uWarmth;
    void main(){
      vec2 slope=vec2(-.45+sin(uAngle)*.14,-.30+sin(uAngle*.7)*.10);
      vec2 roof=vWorld.xz-slope*(7.-vWorld.y);
      float aperture=1.-smoothstep(1.6,2.15,max(abs(roof.x),abs(roof.y+.2)));
      float floorFace=1.-smoothstep(0.,.03,vWorld.y);
      float leftFace=1.-smoothstep(0.,.03,abs(vWorld.x+4.));
      float nearOpening=exp(-length(vWorld-vec3(0.,7.,-.2))*.3);
      float mineral=fract(sin(dot(vWorld,vec3(143.17,91.7,38.3)))*41832.);
      vec3 base=vec3(.012,.021,.026)*( .55+nearOpening+floorFace*.23+leftFace*.25 );
      base*=.92+mineral*.16;
      vec3 light=mix(vec3(.38,.66,.79),vec3(1.,.83,.56),uWarmth);
      vec3 color=base*(.23+uIntensity*.77)+light*aperture*uIntensity*.09;
      gl_FragColor=vec4(color,1.);
    }`});
  disposable.push(roomMaterial);
  const makePlane = (w: number, h: number, pos: THREE.Vector3, rotation: THREE.Euler) => {
    const geometry = new THREE.PlaneGeometry(w, h); disposable.push(geometry);
    const mesh = new THREE.Mesh(geometry, roomMaterial); mesh.position.copy(pos); mesh.rotation.copy(rotation); mesh.receiveShadow = true; add(mesh); return mesh;
  };
  const {minX,maxX,minZ,maxZ,height}=WATER_ROOM;
  const width=maxX-minX,depth=maxZ-minZ,centerZ=(minZ+maxZ)/2;
  makePlane(width,depth,new THREE.Vector3(0,0,centerZ),new THREE.Euler(-Math.PI/2,0,0));
  makePlane(width,height,new THREE.Vector3(0,height/2,minZ),new THREE.Euler(0,0,0));
  makePlane(depth,height,new THREE.Vector3(minX,height/2,centerZ),new THREE.Euler(0,Math.PI/2,0));
  makePlane(depth,height,new THREE.Vector3(maxX,height/2,centerZ),new THREE.Euler(0,-Math.PI/2,0));
  makePlane(width,height,new THREE.Vector3(0,height/2,maxZ),new THREE.Euler(0,Math.PI,0));
  // A straight rectangular room; four ceiling slabs leave the water open.
  makePlane(2.2,depth,new THREE.Vector3(-2.9,height,centerZ),new THREE.Euler(Math.PI/2,0,0));
  makePlane(2.2,depth,new THREE.Vector3(2.9,height,centerZ),new THREE.Euler(Math.PI/2,0,0));
  makePlane(3.6,maxZ-1.6,new THREE.Vector3(0,height,(maxZ+1.6)/2),new THREE.Euler(Math.PI/2,0,0));
  makePlane(3.6,-2-minZ,new THREE.Vector3(0,height,(minZ-2)/2),new THREE.Euler(Math.PI/2,0,0));

  const sealGeometry = new THREE.PlaneGeometry(3.6,3.6,32,32); disposable.push(sealGeometry);
  const shallowSeaUniforms={...waveUniforms,uRain:{value:0},uTime:{value:0},uWarmth:{value:.5},uIntensity:{value:1},uSunDirection:{value:shallowSeaSunDirection(0)},uAbsorption:{value:new THREE.Vector3(.22,.065,.035)}};
  const sealMaterial=new THREE.ShaderMaterial({uniforms:shallowSeaUniforms,vertexShader:causticVertex,fragmentShader:shallowSeaFragment,side:THREE.DoubleSide}); disposable.push(sealMaterial);
  const seal=new THREE.Mesh(sealGeometry,sealMaterial);seal.rotation.x=-Math.PI/2;seal.position.set(0,SEA_BOTTOM,-.2);seal.name='shallow-sea-seal';add(seal);

  const causticUniforms = { ...waveUniforms, uTime: { value: 0 }, uStrength: { value: 1 }, uSunDirection:{value:shallowSeaSunDirection(0)}, uWarmth: { value: .5 } };
  const causticMaterial = new THREE.ShaderMaterial({ uniforms: causticUniforms, vertexShader: causticVertex, fragmentShader: causticFragment, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); disposable.push(causticMaterial);
  const overlay = (w: number, h: number, pos: THREE.Vector3, rot: THREE.Euler) => { const g = new THREE.PlaneGeometry(w,h); disposable.push(g); const m = new THREE.Mesh(g, causticMaterial); m.position.copy(pos); m.rotation.copy(rot); add(m); };
  overlay(LIGHT_CHAMBER.width, LIGHT_CHAMBER.depth, new THREE.Vector3(0,.014,0), new THREE.Euler(-Math.PI/2,0,0));
  overlay(LIGHT_CHAMBER.width, LIGHT_CHAMBER.height, new THREE.Vector3(0,3.5,-4.988), new THREE.Euler(0,0,0));
  overlay(5, LIGHT_CHAMBER.height, new THREE.Vector3(-3.988,3.5,-2.5), new THREE.Euler(0,Math.PI/2,0));

  const volumeUniforms = { ...waveUniforms, uLowQuality:{value:0}, uTime: { value: 0 }, uStrength: { value: 1 }, uWarmth: { value: .5 }, uAngle: { value: 0 } };
  // The sun projects toward negative z; this proxy only encloses that lit area.
  const volumeGeometry = new THREE.BoxGeometry(7.98, 6.98, 9.98); disposable.push(volumeGeometry);
  const volumeMaterial = new THREE.ShaderMaterial({
    uniforms: volumeUniforms, vertexShader: volumeVertex, fragmentShader: volumeFragment,
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
  }); disposable.push(volumeMaterial);
  // Kept just inside the architecture so its back-face proxy survives the
  // coplanar room depth test while the shader itself remains clipped to walls.
  const volume = new THREE.Mesh(volumeGeometry, volumeMaterial); volume.position.set(0, 3.5, 0); volume.renderOrder = 1; add(volume);

  const dustCount = 230, dustPositions = new Float32Array(dustCount*3), dustSeeds = new Float32Array(dustCount);
  for (let i=0; i<dustCount; i++) { const n=i*3; dustPositions[n]=(Math.random()-.5)*3.5; dustPositions[n+1]=Math.random()*7; dustPositions[n+2]=-.2+(Math.random()-.5)*3.5; dustSeeds[i]=Math.random(); }
  const dustGeometry = new THREE.BufferGeometry(); dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustPositions,3)); dustGeometry.setAttribute('aSeed',new THREE.BufferAttribute(dustSeeds,1)); disposable.push(dustGeometry);
  const dustMaterial = new THREE.ShaderMaterial({ uniforms: { uTime:{value:0}, uAngle:{value:0}, uIntensity:{value:1} }, vertexShader:dustVertex, fragmentShader:dustFragment, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending }); disposable.push(dustMaterial);
  add(new THREE.Points(dustGeometry,dustMaterial));

  const sun = new THREE.SpotLight(0xb8e6d8, 210, 18, .46, .88, 1); sun.position.set(0,6.85,-.2); sun.target.position.set(-3.05,0,-2.24); sun.castShadow = true; sun.shadow.mapSize.set(1024,1024); root.add(sun, sun.target);
  const bounce = new THREE.HemisphereLight(0xa3bab8, 0x14222c, .7); add(bounce);
  const rim = new THREE.PointLight(0x386766, .22, 9, 2); rim.position.set(-3.6,5.6,-3.8); add(rim);
  const temp = new THREE.Color();

  let rainClock=0;
  let rainRandom=seededRandom(7123);
  return {
    get waterMode(){return waterMode;},
    get hasSimulation(){return Boolean(simulation);},
    disturb(u,v){simulation?.disturb(u,v);},
    resetWater(){simulation?.reset();rainClock=0;rainRandom=seededRandom(7123);},
    update(elapsed, state, dt=0) {
      const rain=THREE.MathUtils.clamp(state.rain??0,0,1);
      if(rain>0 && dt>0){
        rainClock-=dt;
        if(rainClock<=0){
          simulation?.disturb(.10+rainRandom()*.80,.10+rainRandom()*.80);
          rainClock=(.6+rainRandom()*.8)/(2.+rain*6.);
        }
      }else if(rain===0)rainClock=0;
      simulation?.update(dt);
      volumeUniforms.uLowQuality.value=state.lowQuality?1:0;
      waveUniforms.uWaves.value=simulation?.texture??emptyWave;
      const intensity = THREE.MathUtils.clamp(state.intensity, 0, 2);
      const warmth = THREE.MathUtils.clamp(state.warmth, 0, 1);
      const angle = THREE.MathUtils.clamp(state.angle, -1.1, 1.1);
      const sunDirection=shallowSeaSunDirection(angle);
      shallowSeaUniforms.uRain.value=rain; shallowSeaUniforms.uTime.value=elapsed; shallowSeaUniforms.uWarmth.value=warmth; shallowSeaUniforms.uIntensity.value=intensity; shallowSeaUniforms.uSunDirection.value.copy(sunDirection);
      causticUniforms.uTime.value = elapsed; causticUniforms.uStrength.value = intensity; causticUniforms.uSunDirection.value.copy(sunDirection); causticUniforms.uWarmth.value = warmth;
      volumeUniforms.uTime.value = elapsed; volumeUniforms.uStrength.value = intensity * THREE.MathUtils.clamp(state.beamStrength ?? 1, 0, 2.5); volumeUniforms.uWarmth.value = warmth; volumeUniforms.uAngle.value = angle;
      dustMaterial.uniforms.uTime.value = elapsed; dustMaterial.uniforms.uAngle.value = angle; dustMaterial.uniforms.uIntensity.value = intensity;
      const slopeX = -.45 + Math.sin(angle) * .14;
      const slopeZ = -.30 + Math.sin(angle * .7) * .10;
      sun.target.position.set(slopeX * 6.8, 0, -.2 + slopeZ * 6.8);
      sun.intensity = 75 * intensity;
      roomUniforms.uIntensity.value=intensity;roomUniforms.uAngle.value=angle;roomUniforms.uWarmth.value=warmth;
      bounce.intensity=.25+intensity*1.3;
      sun.color.copy(temp.setRGB(THREE.MathUtils.lerp(.48,1, warmth), THREE.MathUtils.lerp(.78,.68,warmth), THREE.MathUtils.lerp(.76,.42,warmth)));
      rim.intensity = .12 + intensity*.10;
    },
    dispose() { simulation?.dispose();emptyWave.dispose();scene.remove(root); disposable.forEach((item) => item.dispose()); },
  };
}
