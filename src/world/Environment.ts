import * as THREE from 'three';
import {createWaterSimulation} from '../systems/WaterSimulation';

export interface EnvironmentState {
  intensity: number;
  warmth: number;
  angle: number;
  activity: number;
  beamStrength?: number;
  rain?: number;
  lowQuality?: boolean;
}

export interface StillwaterEnvironment {
  update(elapsed: number, state: EnvironmentState, dt?: number): void;
  disturb(u: number, v: number): void;
  resetWater(): void;
  readonly waterMode: string;
  readonly hasSimulation: boolean;
  dispose(): void;
}

const ROOM = { width: 8, depth: 10, height: 7, opening: 3.6 };

const causticVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;

// A continuous, domain-warped wave field. Surface normals come from its gradient,
// so glints follow the moving water instead of outlining Voronoi cells.
const waterField = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise2(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*f*(f*(f*6.-15.)+10.);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  float waterHeight(vec2 p,float t) {
    // A directional spectrum: long swells carry smaller ripples, rather than
    // equally strong crossing sine waves making the surface appear to boil.
    vec2 warp=vec2(noise2(p*.32+vec2(t*.009,0.)),noise2(p*.32+vec2(8.2,-t*.007)))-.5;
    vec2 q=p+warp*.16;
    float h=0.;
    for(int i=0;i<12;i++){
      float band=float(i);
      float seed=fract(sin(band*73.17+19.3)*43758.5453);
      float angle=.45+(seed-.5)*1.5;
      if(i==3 || i==7) angle+=1.35;
      vec2 direction=vec2(cos(angle),sin(angle));
      float frequency=1.25*pow(1.37,band);
      float amplitude=.145*pow(.60,band);
      float speed=sqrt(frequency)*.27;
      float phase=dot(q,direction)*frequency-t*speed+seed*6.283185;
      h+=sin(phase)*amplitude;
    }
    return h;
  }

`;
// Smooth domain-warped contours avoid polygonal cell boundaries in the light pattern.
const causticFragment = /* glsl */ `
  uniform float uTime;
  uniform float uStrength;
  uniform sampler2D uWaves; uniform vec2 uWaveTexel; uniform float uUseSimulation;
  uniform float uAngle;
  uniform float uWarmth;
  varying vec3 vWorld;
  ${waterField}
  float focus(vec2 p){
    vec2 drift=vec2(uTime*.045,-uTime*.031);
    vec2 warp=vec2(noise2(p*.8+drift),noise2(p*.8+vec2(4.8,9.1)-drift));
    float n=noise2(p+warp*1.7+drift)+noise2(p*1.83-warp+drift*.6)*.32;
    float width=max(fwidth(n)*1.4,.016);
    return exp(-pow((n-.62)/(width+.027),2.));
  }
  void main() {
    // Back-project the fragment to the ceiling. This is the same angled opening
    // used by every receiver, so caustics never leak into impossible regions.
    vec3 sun = normalize(vec3(-.45 + sin(uAngle)*.14, -1.0, -.30 + sin(uAngle*.7)*.10));
    float rise = 7.0 - vWorld.y;
    vec2 roof = vec2(vWorld.x, vWorld.z) - sun.xz / sun.y * (vWorld.y - 7.0);
    float aperture = 1.0 - smoothstep(1.70, 2.03, max(abs(roof.x), abs(roof.y + .2)));
    // The aperture is projected from the roof, while the fine pattern is in
    // world space.  This keeps the illumination physically clipped by the
    // skylight without stretching a roof texture into long wall worms.
    vec3 receiver=abs(normalize(cross(dFdx(vWorld),dFdy(vWorld))));
    vec2 p=(receiver.y>.7?vWorld.xz:(receiver.x>.7?vWorld.zy:vWorld.xy))*1.86;
    p += vec2(sin(p.y*1.9 + uTime*.18), cos(p.x*1.6-uTime*.14)) * .22;
    if(uUseSimulation>.5){
      vec2 uv=vec2(roof.x/3.6+.5,.5-(roof.y+.2)/3.6);
      vec2 e=uWaveTexel;
      vec2 tilt=vec2(texture2D(uWaves,clamp(uv+vec2(e.x,0),0.,1.)).r-texture2D(uWaves,clamp(uv-vec2(e.x,0),0.,1.)).r,texture2D(uWaves,clamp(uv+vec2(0,e.y),0.,1.)).r-texture2D(uWaves,clamp(uv-vec2(0,e.y),0.,1.)).r)/(2.*3.6*e);
      p+=tilt*3.*min(rise,5.)*.35;
    }
    p+=vec2(waterHeight(roof*3.89,uTime))*.18;
    float web = focus(p) * .72 + focus(p*1.47+vec2(8.1,3.2))*.24;
    float fade = (1.0 - smoothstep(0., 16., rise) * .45) * aperture;
    vec3 cool = vec3(.34, .79, .77);
    vec3 cream = vec3(1.0, .78, .45);
    vec3 tint = mix(cool, cream, clamp(uWarmth, 0.0, 1.0));
    gl_FragColor = vec4(tint * web * fade * uStrength * .62, 1.0);
  }
`;

const waterVertex = /* glsl */ `
  uniform float uTime; uniform float uActivity;
  uniform sampler2D uWaves; uniform float uUseSimulation;
  varying vec2 vUv; varying vec3 vWorld;
  ${waterField}
  void main() {
    vUv=uv;
    vec3 p=position;
    // Pin the water to the aperture so no moving black seams open along the rim.
    float rim=smoothstep(0.,.09,min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y)));
    // Keep the accepted wind spectrum; GPU waves are an additive interaction layer.
    float height=waterHeight(uv*14.,uTime)*.065;
    if(uUseSimulation>.5) height+=texture2D(uWaves,uv).r*3.;
    p.z+=height*rim;
    vWorld=(modelMatrix*vec4(p,1.)).xyz;
    gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
  }
`;
// Rays sample the same procedural sky as the separate upper layer. This is
// single-interface refraction, not an opacity overlay of undistorted clouds.
const waterFragment = /* glsl */ `
  uniform float uTime; uniform float uWarmth; uniform float uIntensity; uniform float uRain;
  uniform sampler2D uWaves; uniform vec2 uWaveTexel; uniform float uUseSimulation;
  varying vec2 vUv; varying vec3 vWorld;
  ${waterField}
  float heightAt(vec2 uv){
    float height=waterHeight(uv*14.,uTime)*.065;
    if(uUseSimulation>.5) height+=texture2D(uWaves,clamp(uv,0.,1.)).r*3.;
    return height;
  }
  vec3 skyAt(vec2 world){
    vec2 p=world*.24+vec2(uTime*.004,0.);
    float clouds=noise2(p)+noise2(p*2.13+vec2(3.2,8.1))*.4+noise2(p*4.3)*.12;
    clouds=smoothstep(.72,1.12,clouds);
    vec3 blue=mix(vec3(.065,.22,.40),vec3(.13,.26,.40),uWarmth);
    vec3 white=mix(vec3(.87,.94,1.),vec3(1.,.88,.68),uWarmth*.6);
    vec3 sky=mix(blue,white,clouds*.65);
    sky=mix(sky,vec3(.22,.30,.34)+clouds*.13,uRain*.8);
    // Distant falling streaks above the surface, seen through the same refraction.
    vec2 rainUV=world*vec2(11.,2.5)+vec2(0.,uTime*2.4);
    vec2 cell=floor(rainUV);vec2 f=fract(rainUV);
    float seed=hash(cell);
    float streak=(1.-smoothstep(.018,.075,abs(f.x-.5)))
      *smoothstep(.05,.18,f.y)*(1.-smoothstep(.45,.85,f.y))*step(.76,seed);
    sky+=vec3(.26,.32,.35)*streak*uRain;
    return (sky+white*exp(-length(world-vec2(1.,-.6))*.42)*.055)*(.035+uIntensity*.9);
  }
  void main(){
    vec2 e=uWaveTexel;
    vec2 slope=vec2(heightAt(vUv+vec2(e.x,0))-heightAt(vUv-vec2(e.x,0)),heightAt(vUv+vec2(0,e.y))-heightAt(vUv-vec2(0,e.y)))/(2.*3.6*e);
    float rim=smoothstep(0.,.09,min(min(vUv.x,vUv.y),min(1.-vUv.x,1.-vUv.y)));
    vec3 normal=normalize(vec3(slope.x*rim,-1.,-slope.y*rim));
    vec3 view=normalize(cameraPosition-vWorld);
    vec3 ray=refract(-view,normal,1./1.333);
    vec2 skyPoint=vWorld.xz+ray.xz*((8.3-vWorld.y)/max(ray.y,.05));
    float fresnel=.0204+.9796*pow(1.-clamp(dot(normal,view),0.,1.),5.);
    vec3 transmitted=skyAt(skyPoint)*vec3(.92,.98,1.);
    vec3 reflected=vec3(.018,.033,.04)*(.1+uIntensity);
    vec3 col=mix(transmitted,reflected,fresnel*.65);
    // An extended bright sky patch, broken up by the simulated normals.
    vec3 sunRay=normalize(vec3(-.12,.88,-.45));
    float alignment=max(dot(ray,sunRay),0.);
    float highlight=pow(alignment,90.);
    vec3 sunColor=mix(vec3(.82,.94,1.),vec3(1.,.87,.63),uWarmth);
    col+=sunColor*highlight*uIntensity*.8;
    // Restore the accepted broad sky glints using the combined surface slope.
    // A shared height field lets the expanding GPU rings bend these highlights.
    vec2 opticalSlope=slope/(.065*14./3.6);
    vec2 sunOffset=(vUv-vec2(.66,.68))*.45;
    vec2 bent=opticalSlope+sunOffset;
    float spread=110./(1.+length(fwidth(opticalSlope))*18.);
    float glint=exp(-dot(bent,bent)*spread)*rim;
    col+=sunColor*glint*uIntensity*.85;
    gl_FragColor=vec4(col,1.);
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
  uniform sampler2D uWaves; uniform float uUseSimulation; uniform float uLowQuality;
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
      float aperture=1.-smoothstep(1.58,1.82,max(abs(roof.x),abs(roof.y+.2)));
      // Fine, moving striations are evaluated at the roof interception,
      // preserving the incoming-light direction without making a solid cone.
      float wav=noise2(roof*1.8+vec2(uTime*.035,-uTime*.023));
      vec2 waveUV=clamp(vec2(roof.x/3.6+.5,.5-(roof.y+.2)/3.6),0.,1.);
      float surface=uUseSimulation>.5?texture2D(uWaves,waveUV).r:0.;
      float bands=.5+.5*sin(roof.x*11.+wav*3.+uTime*.16+surface*90.);
      float shaft=smoothstep(.56,.88,bands)*(.42+.58*noise2(roof*4.-uTime*.03));
      float falloff=exp(-length(roof-vec2(0.,-.2))*.34)*(1.-smoothstep(6.55,7.,p.y));
      sum+=aperture*(.10+shaft)*falloff;
    }
    float opticalDepth=sum*stepSize*.22*uStrength;
    vec3 tint=mix(vec3(.51,.72,.79),vec3(1.,.84,.61),uWarmth);
    // AdditiveBlending uses source alpha. Keep colour energy independent from
    // the accumulated alpha so the intentionally thin shafts remain visible.
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

export function createEnvironment(scene: THREE.Scene, renderer?: THREE.WebGLRenderer): StillwaterEnvironment {
  let simulation: ReturnType<typeof createWaterSimulation> | undefined;
  let waterMode='程序式水波';
  if(renderer){try{simulation=createWaterSimulation(renderer);waterMode='GPU 水面波動模擬';}catch(error){console.warn('GPU water unavailable, using procedural waves',error);waterMode='GPU 模擬不可用，使用程序式水波';}}
  const emptyWave=new THREE.DataTexture(new Float32Array(4),1,1,THREE.RGBAFormat,THREE.FloatType);emptyWave.needsUpdate=true;
  const waveUniforms={uWaves:{value:simulation?.texture??emptyWave},uWaveTexel:{value:simulation?.texelSize??new THREE.Vector2(1/128,1/128)},uUseSimulation:{value:simulation?1:0}};
  const root = new THREE.Group();
  root.name = 'stillwater-environment';
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
  makePlane(20, 21, new THREE.Vector3(0, 0, 5.5), new THREE.Euler(-Math.PI / 2, 0, 0));
  makePlane(ROOM.width, ROOM.height, new THREE.Vector3(0, 3.5, -5), new THREE.Euler(0, 0, 0));
  makePlane(5, ROOM.height, new THREE.Vector3(-4, 3.5, -2.5), new THREE.Euler(0, Math.PI / 2, 0));
  makePlane(5, ROOM.height, new THREE.Vector3(4, 3.5, -2.5), new THREE.Euler(0, -Math.PI / 2, 0));
  // The viewing bay widens behind the original lit chamber to contain the
  // complete orbit. Keep its back walls and caustics at the accepted positions.
  makePlane(Math.hypot(6,3),7,new THREE.Vector3(-7,3.5,1.5),new THREE.Euler(0,Math.atan2(3,6),0));
  makePlane(Math.hypot(6,3),7,new THREE.Vector3(7,3.5,1.5),new THREE.Euler(0,Math.atan2(-3,6),0));
  makePlane(13,7,new THREE.Vector3(-10,3.5,9.5),new THREE.Euler(0,Math.PI/2,0));
  makePlane(13,7,new THREE.Vector3(10,3.5,9.5),new THREE.Euler(0,-Math.PI/2,0));
  makePlane(20,7,new THREE.Vector3(0,3.5,16),new THREE.Euler(0,Math.PI,0));
  // Four ceiling slabs leave the exact 3.6m square of water open.
  makePlane(8.2, 21, new THREE.Vector3(-5.9, 7, 5.5), new THREE.Euler(Math.PI / 2, 0, 0));
  makePlane(8.2, 21, new THREE.Vector3(5.9, 7, 5.5), new THREE.Euler(Math.PI / 2, 0, 0));
  makePlane(3.6, 14.4, new THREE.Vector3(0, 7, 8.8), new THREE.Euler(Math.PI / 2, 0, 0));
  makePlane(3.6, 3.0, new THREE.Vector3(0, 7, -3.5), new THREE.Euler(Math.PI / 2, 0, 0));

  // The sky is a separate surface above the water: a visible second layer,
  // seen through the translucent interface and occluded by the ceiling slabs.
  const skyUniforms={uTime:{value:0},uIntensity:{value:1},uWarmth:{value:.48}};
  const skyGeometry=new THREE.PlaneGeometry(40,40);disposable.push(skyGeometry);
  const skyMaterial=new THREE.ShaderMaterial({uniforms:skyUniforms,side:THREE.DoubleSide,
    vertexShader:causticVertex,fragmentShader:/* glsl */ `
    varying vec3 vWorld; uniform float uTime; uniform float uIntensity; uniform float uWarmth;
    ${waterField}
    void main(){
      vec3 ray=vWorld-cameraPosition;
      vec2 aperture=cameraPosition.xz+ray.xz*((7.-cameraPosition.y)/ray.y);
      if(max(abs(aperture.x),abs(aperture.y+.2))>1.795)discard;
      vec2 p=vWorld.xz*.24+vec2(uTime*.004,0.);
      float clouds=noise2(p)+noise2(p*2.13+vec2(3.2,8.1))*.4+noise2(p*4.3)*.12;
      clouds=smoothstep(.72,1.12,clouds);
      vec3 blue=mix(vec3(.065,.22,.40),vec3(.13,.26,.40),uWarmth);
      vec3 white=mix(vec3(.87,.94,1.),vec3(1.,.88,.68),uWarmth*.6);
      vec3 col=mix(blue,white,clouds*.65);
      float sun=exp(-length(vWorld.xz-vec2(1.,-.6))*.42);
      col+=white*sun*.055;
      gl_FragColor=vec4(col*(.035+uIntensity*.9),1.);
    }`});disposable.push(skyMaterial);
  const sky=new THREE.Mesh(skyGeometry,skyMaterial);sky.rotation.x=Math.PI/2;sky.position.set(0,8.3,-.2);add(sky);

  const waterGeometry = new THREE.PlaneGeometry(3.6, 3.6, 90, 90); disposable.push(waterGeometry);
  const waterUniforms = { ...waveUniforms, uTime: { value: 0 }, uActivity: { value: .5 }, uWarmth: { value: .5 }, uIntensity: { value: 1 }, uRain:{value:0} };
  const waterMaterial = new THREE.ShaderMaterial({ uniforms: waterUniforms, vertexShader: waterVertex, fragmentShader: waterFragment, side: THREE.DoubleSide }); disposable.push(waterMaterial);
  const water = new THREE.Mesh(waterGeometry, waterMaterial); water.rotation.x = -Math.PI / 2; water.position.set(0, 6.985, -.2); add(water);

  const causticUniforms = { ...waveUniforms, uTime: { value: 0 }, uStrength: { value: 1 }, uAngle: { value: 0 }, uWarmth: { value: .5 } };
  const causticMaterial = new THREE.ShaderMaterial({ uniforms: causticUniforms, vertexShader: causticVertex, fragmentShader: causticFragment, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); disposable.push(causticMaterial);
  const overlay = (w: number, h: number, pos: THREE.Vector3, rot: THREE.Euler) => { const g = new THREE.PlaneGeometry(w,h); disposable.push(g); const m = new THREE.Mesh(g, causticMaterial); m.position.copy(pos); m.rotation.copy(rot); add(m); };
  overlay(ROOM.width, ROOM.depth, new THREE.Vector3(0,.014,0), new THREE.Euler(-Math.PI/2,0,0));
  overlay(ROOM.width, ROOM.height, new THREE.Vector3(0,3.5,-4.988), new THREE.Euler(0,0,0));
  overlay(5, ROOM.height, new THREE.Vector3(-3.988,3.5,-2.5), new THREE.Euler(0,Math.PI/2,0));

  const volumeUniforms = { ...waveUniforms, uLowQuality:{value:0}, uTime: { value: 0 }, uStrength: { value: 1 }, uWarmth: { value: .5 }, uAngle: { value: 0 } };
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
  let rainSeed=7123;
  const rainRandom=()=>{rainSeed=(Math.imul(rainSeed,1664525)+1013904223)>>>0;return rainSeed/4294967296;};
  return {
    get waterMode(){return waterMode;},
    get hasSimulation(){return Boolean(simulation);},
    disturb(u,v){simulation?.disturb(u,v);},
    resetWater(){simulation?.reset();rainClock=0;rainSeed=7123;},
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
      waterUniforms.uRain.value=rain;
      volumeUniforms.uLowQuality.value=state.lowQuality?1:0;
      waveUniforms.uWaves.value=simulation?.texture??emptyWave;
      const intensity = THREE.MathUtils.clamp(state.intensity, 0, 2);
      const warmth = THREE.MathUtils.clamp(state.warmth, 0, 1);
      const angle = THREE.MathUtils.clamp(state.angle, -1.1, 1.1);
      const activity = THREE.MathUtils.clamp(state.activity, 0, 1);
      skyUniforms.uTime.value=elapsed;skyUniforms.uIntensity.value=intensity;skyUniforms.uWarmth.value=warmth;
      waterUniforms.uTime.value = elapsed; waterUniforms.uActivity.value = activity; waterUniforms.uWarmth.value = warmth; waterUniforms.uIntensity.value = intensity;
      causticUniforms.uTime.value = elapsed; causticUniforms.uStrength.value = intensity; causticUniforms.uAngle.value = angle; causticUniforms.uWarmth.value = warmth;
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
