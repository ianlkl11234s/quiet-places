import * as THREE from 'three';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';

export type WindowPlaceKind = 'leaf' | 'ocean';

export interface WindowPlaceState {
  intensity: number;
  warmth: number;
  angle: number;
  activity: number;
  beamStrength?: number;
  lowQuality?: boolean;
}

export interface WindowPlace {
  update(elapsed: number, state: WindowPlaceState): void;
  dispose(): void;
}

const stone = new THREE.Color('#625e54');
const warm = new THREE.Color('#ffd39a');
const cool = new THREE.Color('#a9d9e8');
let areaLightsReady=false;

// A small deterministic generator makes the leaf arrangement stable between renders.
function random(seed: number) {
  let value = seed >>> 0;
  return () => ((value = (value * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function addBox(group: THREE.Group, owned: THREE.Object3D[], size: [number, number, number], position: [number, number, number], material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  group.add(mesh); owned.push(mesh);
  return mesh;
}

function disposeObject(object: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures=new Set<THREE.Texture>();
  object.traverse(node => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach(value => materials.add(value));
    else if (material) materials.add(material);
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => {for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);material.dispose();});
  textures.forEach(texture=>texture.dispose());
}

const projectionVertex = /* glsl */`
  varying vec3 vWorld;
  void main(){ vWorld=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.); }
`;

const leafProjectionFragment = /* glsl */`
  uniform float uTime; uniform float uStrength; uniform float uAngle; uniform float uWall; uniform vec3 uTint; uniform vec4 uWindow; uniform vec3 uSun;
  varying vec3 vWorld;
  float hash(vec2 p){return fract(sin(dot(p,vec2(27.1,91.7)))*43758.5453);}
  void main(){
    vec3 source=vWorld-uSun*((vWorld.z+4.9)/uSun.z);
    float aperture=smoothstep(uWindow.x-.15,uWindow.x+.15,source.x)*(1.-smoothstep(uWindow.y-.15,uWindow.y+.15,source.x))*smoothstep(uWindow.z-.15,uWindow.z+.15,source.y)*(1.-smoothstep(uWindow.w-.15,uWindow.w+.15,source.y));
    vec2 p=source.xy*2.6+vec2(sin(uTime*.19)*.06,0.);
    vec2 cell=floor(p);float shadow=0.;
    for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
      vec2 key=cell+vec2(float(x),float(y));float seed=hash(key);
      vec2 center=key+vec2(hash(key+3.2),hash(key+7.1));
      vec2 d=p-center-vec2(sin(uTime*.37+seed*6.)*.09,cos(uTime*.29+seed*8.)*.05);
      float angle=seed*6.28;d=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*d;
      shadow=max(shadow,1.-smoothstep(.65,1.15,length(d/vec2(.44,.15))));
    }
    float flecks=.16+.84*(1.-shadow);
    float edge=aperture;
    gl_FragColor=vec4(uTint, flecks*edge*uStrength*.65);
  }
`;

const causticFragment = /* glsl */`
  uniform float uTime; uniform float uStrength; uniform float uWall; uniform vec3 uTint; uniform vec4 uWindow; uniform vec3 uSun;
  varying vec3 vWorld;
  float hash(vec2 p){return fract(sin(dot(p,vec2(41.7,289.1)))*17321.17);}
  float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
  void main(){
    vec2 p=mix(vWorld.xz,vWorld.zy,uWall)*3.4+vec2(uTime*.10,-uTime*.06);
    float a=sin(p.x*5.+sin(p.y*3.1))*sin(p.y*4.2+sin(p.x*2.));
    float b=sin(p.x*8.-p.y*3.+uTime*.32);
    vec2 warp=vec2(n(p*.65+uTime*.025),n(p*.65+vec2(4.,7.)-uTime*.018));
    float field=n(p+warp*1.5)+n(p*1.8-warp)*.28;
    float width=max(fwidth(field)*1.3,.016);
    float lines=exp(-pow((field-.63)/(width+.023),2.));
    vec2 origin=mix(vec2(0.,-2.7),vec2(-2.5,1.8),uWall);
    vec3 source=vWorld-uSun*((vWorld.z+4.9)/uSun.z);
    float aperture=smoothstep(uWindow.x-.2,uWindow.x+.2,source.x)*(1.-smoothstep(uWindow.y-.2,uWindow.y+.2,source.x))*smoothstep(uWindow.z-.25,uWindow.z+.25,source.y)*(1.-smoothstep(uWindow.w-.25,uWindow.w+.25,source.y));
    gl_FragColor=vec4(uTint,lines*aperture*uStrength*.32);
  }
`;

const oceanVertex = /* glsl */`
  uniform float uTime; uniform float uActivity; varying vec3 vWorld; varying float vWave;
  void main(){
    vec3 p=position;
    // The plane is rotated into world X/Z; local Z is its world-height normal.
    float swell=sin(p.x*.55+uTime*.23)*.12+sin(p.y*.34-uTime*.17)*.10;
    float ripples=sin(p.x*2.7+p.y*1.2-uTime*.55)*.018;
    p.z+=(swell+ripples)*(.32+.68*uActivity);
    vWave=p.z; vWorld=(modelMatrix*vec4(p,1.)).xyz;
    gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
  }
`;
const oceanFragment = /* glsl */`
  uniform float uWarmth; uniform float uIntensity; uniform float uTime; varying vec3 vWorld; varying float vWave;
  float wave(vec2 p){return sin(p.y*3.2+p.x*.65-uTime*.55)*.022+sin(p.y*6.7-p.x*1.3-uTime*.79)*.009+sin(p.y*14.2+p.x*2.8-uTime*1.1)*.003;}
  void main(){
    vec2 p=vWorld.xz;float e=.03;
    vec2 slope=vec2(wave(p+vec2(e,0.))-wave(p-vec2(e,0.)),wave(p+vec2(0.,e))-wave(p-vec2(0.,e)))/(2.*e);
    vec3 normal=normalize(vec3(-slope.x,1.,-slope.y));
    vec3 view=normalize(cameraPosition-vWorld);
    vec3 sun=normalize(vec3(.18,.18,-1.));
    vec3 halfRay=normalize(view+sun);
    float glint=pow(max(dot(normal,halfRay),0.),180./(1.+length(fwidth(slope))*24.));
    float fresnel=.04+.96*pow(1.-max(dot(view,normal),0.),5.);
    vec3 deep=vec3(.014,.065,.079);
    vec3 sky=mix(vec3(.22,.40,.53),vec3(.40,.30,.16),uWarmth);
    vec3 color=mix(deep,sky,fresnel*.75)*(.10+uIntensity*.95);
    color+=mix(vec3(.62,.82,1.),vec3(1.,.78,.39),uWarmth)*glint*(.2+uIntensity*1.3);
    gl_FragColor=vec4(color,1.);
  }
`;
const skyFragment = /* glsl */`
  uniform float uWarmth; uniform float uIntensity; uniform float uAngle; varying vec3 vWorld;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
  void main(){
    vec2 skyPoint=vWorld.xy/max(1.,abs(vWorld.z)*.045);
    float h=clamp((skyPoint.y+.1)/7.,0.,1.);
    vec3 low=mix(vec3(.20,.35,.48),vec3(.50,.29,.095),uWarmth);
    vec3 high=mix(vec3(.13,.30,.47),vec3(.38,.25,.12),uWarmth);
    vec3 color=mix(low,high,smoothstep(.02,.85,h));
    float orb=exp(-length(skyPoint-vec2(sin(uAngle)*3.1,3.8))*1.25);
    color+=mix(vec3(.45,.65,.78),vec3(1.,.63,.34),uWarmth)*orb*(.16+.84*uIntensity);
    color*=.025+uIntensity*.975;
    gl_FragColor=vec4(color,1.);
  }
`;

// A bounded single-source volume.  It integrates only rays that can trace back
// to the window rectangle, keeping the glow as air-light rather than a flat curtain.
const volumeFragment = /* glsl */`
  uniform float uTime; uniform float uStrength; uniform float uWarmth; uniform float uActivity; uniform vec4 uWindow; uniform vec3 uSun;
  varying vec3 vWorld;
  vec2 hitBox(vec3 ro,vec3 rd){
    vec3 lo=vec3(-6.,0.,-5.), hi=vec3(6.,7.,14.);
    vec3 a=(lo-ro)/rd, b=(hi-ro)/rd, n=min(a,b), f=max(a,b);
    return vec2(max(max(n.x,n.y),n.z),min(min(f.x,f.y),f.z));
  }
  void main(){
    vec3 ro=cameraPosition, rd=normalize(vWorld-ro); vec2 hit=hitBox(ro,rd);
    float begin=max(hit.x,0.), end=hit.y; if(end<=begin) discard;
    float sum=0.; const int STEPS=32;
    for(int i=0;i<STEPS;i++){
      float t=begin+(float(i)+.5)/float(STEPS)*(end-begin); vec3 p=ro+rd*t;
      vec3 source=vec3((uWindow.x+uWindow.y)*.5,(uWindow.z+uWindow.w)*.5,-4.9);
      vec3 onWindow=p-uSun*((p.z+4.9)/uSun.z);
      vec2 atWindow=onWindow.xy;
      float aperture=smoothstep(uWindow.x-.08,uWindow.x+.12,atWindow.x)*(1.-smoothstep(uWindow.y-.12,uWindow.y+.08,atWindow.x))*smoothstep(uWindow.z-.08,uWindow.z+.12,atWindow.y)*(1.-smoothstep(uWindow.w-.12,uWindow.w+.08,atWindow.y));
      float streak=.58+.42*sin(p.x*9.+p.y*3.-uTime*(.12+uActivity*.18));
      sum+=aperture*streak*exp(-length(p.xy-vec2((uWindow.x+uWindow.y)*.5,(uWindow.z+uWindow.w)*.5))*.16);
    }
    vec3 tint=mix(vec3(.38,.67,.76),vec3(1.,.72,.43),uWarmth);
    gl_FragColor=vec4(tint,sum/float(STEPS)*uStrength*.65);
  }
`;

function createRoom(kind: WindowPlaceKind) {
  const group = new THREE.Group(); group.name = `${kind}-window-place`;
  const owned: THREE.Object3D[] = [];
  const wall = new THREE.MeshStandardMaterial({color: stone, roughness: .88, metalness: .06});
  const floor = new THREE.MeshStandardMaterial({color: '#434744', roughness: .62, metalness: .12});
  const noise=new Uint8Array(128*128*4);const rng=random(527);
  for(let i=0;i<128*128;i++){const v=190+Math.floor(rng()*55);noise[i*4]=v;noise[i*4+1]=v;noise[i*4+2]=v;noise[i*4+3]=255;}
  const texture=new THREE.DataTexture(noise,128,128);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(6,6);texture.needsUpdate=true;
  wall.map=texture;wall.bumpMap=texture;wall.bumpScale=.025;floor.map=texture;floor.bumpMap=texture;floor.bumpScale=.012;
  const frame = new THREE.MeshStandardMaterial({color: '#091013', roughness: .38, metalness: .62});
  addBox(group, owned, [12, .18, 19], [0, 0, 4.5], floor);
  addBox(group, owned, [12, .18, 19], [0, 7, 4.5], wall);
  addBox(group, owned, [.18, 7, 19], [-6, 3.5, 4.5], wall);
  addBox(group, owned, [.18, 7, 19], [6, 3.5, 4.5], wall);

  const opening = kind === 'leaf'
    ? {left: .7, right: 4.8, bottom: 3, top: 6.3}
    : {left: -4.7, right: 4.7, bottom: .7, top: 2.8};
  const centerX = (opening.left + opening.right) / 2;
  const centerY = (opening.bottom + opening.top) / 2;
  // Four slabs deliberately leave a real opening: objects outside remain visible through it.
  addBox(group, owned, [12, opening.bottom, .22], [0, opening.bottom / 2, -5], wall);
  addBox(group, owned, [12, 7 - opening.top, .22], [0, (opening.top + 7) / 2, -5], wall);
  addBox(group, owned, [opening.left + 6, opening.top - opening.bottom, .22], [(opening.left - 6) / 2, centerY, -5], wall);
  addBox(group, owned, [6 - opening.right, opening.top - opening.bottom, .22], [(opening.right + 6) / 2, centerY, -5], wall);
  const width = opening.right - opening.left, height = opening.top - opening.bottom;
  addBox(group, owned, [width + .16, .11, .18], [centerX, opening.bottom, -4.84], frame);
  addBox(group, owned, [width + .16, .11, .18], [centerX, opening.top, -4.84], frame);
  addBox(group, owned, [.11, height, .18], [opening.left, centerY, -4.84], frame);
  addBox(group, owned, [.11, height, .18], [opening.right, centerY, -4.84], frame);
  return {group, owned, opening};
}

export function createWindowPlace(scene: THREE.Scene, kind: WindowPlaceKind): WindowPlace {
  const {group, owned, opening} = createRoom(kind);
  scene.add(group);
  const sunlight={value:new THREE.Vector3()};
  const windowBounds={value:new THREE.Vector4(opening.left,opening.right,opening.bottom,opening.top)};
  const projectionUniforms = {uSun:sunlight,uWindow:windowBounds,uTime: {value: 0}, uStrength: {value: .5}, uAngle: {value: 0}, uWall: {value: 0}, uTint: {value: new THREE.Color()}};
  const projectionMaterial = new THREE.ShaderMaterial({vertexShader: projectionVertex, fragmentShader: kind === 'leaf' ? leafProjectionFragment : causticFragment, uniforms: projectionUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending});
  const projected = new THREE.Mesh(new THREE.PlaneGeometry(11.6, 13.5), projectionMaterial);
  projected.rotation.x = -Math.PI / 2; projected.position.set(0, .105, -1.3); group.add(projected); owned.push(projected);
  const wallProjectionUniforms = {uSun:sunlight,uWindow:windowBounds,uTime: {value: 0}, uStrength: {value: .5}, uAngle: {value: 0}, uWall: {value: 1}, uTint: {value: new THREE.Color()}};
  const wallProjection = new THREE.Mesh(new THREE.PlaneGeometry(13.5, 6.7), new THREE.ShaderMaterial({vertexShader: projectionVertex, fragmentShader: kind === 'leaf' ? leafProjectionFragment : causticFragment, uniforms: wallProjectionUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}));
  wallProjection.rotation.y = Math.PI / 2; wallProjection.position.set(-5.88, 3.45, 1.1); group.add(wallProjection); owned.push(wallProjection);

  const target = new THREE.Object3D(); target.position.set(kind === 'leaf' ? 1.2 : 0, 1.25, 1.7); group.add(target);
  if(!areaLightsReady){RectAreaLightUniformsLib.init();areaLightsReady=true;}
  const windowLight = new THREE.RectAreaLight('#c9e8ed',4.5,opening.right-opening.left,opening.top-opening.bottom);
  windowLight.position.set((opening.left + opening.right) / 2, (opening.bottom + opening.top) / 2, -4.68);
  windowLight.lookAt(windowLight.position.x,windowLight.position.y,10);group.add(windowLight);
  // Diffuse sky arriving through the opening, used as an indirect-light approximation.
  const skyBounce=new THREE.HemisphereLight(0xdce5db,0x37382f,.6);group.add(skyBounce);
  const volumeUniforms = {uSun:sunlight,uTime: {value: 0}, uStrength: {value: .4}, uWarmth: {value: .2}, uActivity: {value: .2}, uWindow: {value: new THREE.Vector4(opening.left, opening.right, opening.bottom, opening.top)}};
  const volume = new THREE.Mesh(new THREE.BoxGeometry(11.7, 6.7, 18.6), new THREE.ShaderMaterial({vertexShader: projectionVertex, fragmentShader: volumeFragment, uniforms: volumeUniforms, transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending}));
  volume.position.set(0, 3.5, 4.5); group.add(volume); owned.push(volume);

  let animated: (elapsed: number, state: WindowPlaceState) => void;
  if (kind === 'leaf') {
    const r = random(932);
    const branches = new THREE.Group(); branches.position.z = -5.7; group.add(branches);
    const branchMaterial = new THREE.MeshBasicMaterial({color: '#18251b'});
    const branchGeometry=new THREE.CylinderGeometry(1,1,1,7);
    const axis=new THREE.Vector3(0,1,0);
    function branch(a:THREE.Vector3,b:THREE.Vector3,radius:number){const delta=b.clone().sub(a);const mesh=new THREE.Mesh(branchGeometry,branchMaterial);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(axis,delta.clone().normalize());mesh.scale.set(radius,delta.length(),radius);branches.add(mesh);}
    const trunkStart=new THREE.Vector3(4.5,-1,-.8),trunkEnd=new THREE.Vector3(2.3,8,-.8);
    branch(trunkStart,trunkEnd,.095);
    for(let i=0;i<12;i++){const h=1.5+i*.49;const x=4.5-(h+1)*2.2/9;const end=new THREE.Vector3(x+(i%2?-1:1)*(1.1+r()*1.4),h+1.2+r(),-.8-r()*.5);branch(new THREE.Vector3(x,h,-.8),end,.022+r()*.018);}
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, -.5); leafShape.quadraticCurveTo(.42, -.18, .34, .15); leafShape.quadraticCurveTo(.18, .48, 0, .56); leafShape.quadraticCurveTo(-.32, .21, -.35, -.12); leafShape.quadraticCurveTo(-.16, -.42, 0, -.5);
    const leafGeometry = new THREE.ShapeGeometry(leafShape);leafGeometry.scale(.24,.34,1);
    const leafMaterial = new THREE.MeshBasicMaterial({color: '#648141', side: THREE.DoubleSide, transparent: true, opacity: .92});
    const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, 420);
    const leafTint=new THREE.Color();
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3(), euler = new THREE.Euler();
    const leafData: Array<[number, number, number, number]> = [];
    for (let i = 0; i < 420; i++) {
      const x = .45 + r() * 4.65, y = 2.45 + r() * 4.35, z = -5.95 - r() * 2.7, phase = r() * Math.PI * 2;
      leafTint.setHSL(.19+r()*.1,.34+r()*.25,.35+r()*.28);leaves.setColorAt(i,leafTint);
      leafData.push([x, y, z, phase]); position.set(x, y, z); rotation.setFromEuler(new THREE.Euler((r() - .5) * .9, r() * Math.PI, (r() - .5) * .9)); scale.setScalar(.65 + r() * 1.5); matrix.compose(position, rotation, scale); leaves.setMatrixAt(i, matrix);
    }
    leaves.instanceMatrix.needsUpdate = true; group.add(leaves); owned.push(leaves);
    const skyUniforms = {uWarmth: {value: .2}, uIntensity: {value: .5}, uAngle: {value: 0}};
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(22, 12), new THREE.ShaderMaterial({vertexShader: projectionVertex, fragmentShader: skyFragment, uniforms: skyUniforms}));
    sky.position.set(0, 4.2, -13.2); group.add(sky); owned.push(sky);
    animated = (elapsed, state) => {
      const sway = (.035 + state.activity * .11) * (state.lowQuality ? .55 : 1);
      for (let i = 0; i < leafData.length; i++) {
        const [x, y, z, phase] = leafData[i]; position.set(x + Math.sin(elapsed * (.48 + state.activity) + phase) * sway, y + Math.cos(elapsed * .7 + phase) * sway * .28, z); euler.set(.15 * Math.sin(elapsed + phase), phase, .24 * Math.cos(elapsed * .6 + phase)); rotation.setFromEuler(euler); scale.setScalar(.7 + (i % 5) * .16); matrix.compose(position, rotation, scale); leaves.setMatrixAt(i, matrix);
      }
      leaves.instanceMatrix.needsUpdate = true;
      leafMaterial.color.setRGB(.12+state.intensity*.23+state.warmth*.13,.16+state.intensity*.29,.06+state.intensity*.09);
      skyUniforms.uWarmth.value = state.warmth; skyUniforms.uIntensity.value = Math.max(.10, state.intensity); skyUniforms.uAngle.value = state.angle;
    };
  } else {
    const oceanUniforms = {uTime: {value: 0}, uActivity: {value: .2}, uWarmth: {value: .2}, uIntensity: {value: .5}};
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(500, 400, 120, 100), new THREE.ShaderMaterial({vertexShader: oceanVertex, fragmentShader: oceanFragment, uniforms: oceanUniforms}));
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, .78, -205.2); group.add(sea); owned.push(sea);
    const skyUniforms = {uWarmth: {value: .2}, uIntensity: {value: .5}, uAngle: {value: 0}};
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(1200, 400), new THREE.ShaderMaterial({vertexShader: projectionVertex, fragmentShader: skyFragment, uniforms: skyUniforms}));
    sky.position.set(0, 120, -410); group.add(sky); owned.push(sky);
    animated = (elapsed, state) => { oceanUniforms.uTime.value = elapsed; oceanUniforms.uActivity.value = Math.min(.55, .12 + state.activity * .42); oceanUniforms.uWarmth.value = state.warmth; oceanUniforms.uIntensity.value = Math.max(.08, state.intensity); skyUniforms.uWarmth.value = state.warmth; skyUniforms.uIntensity.value = Math.max(.10, state.intensity); skyUniforms.uAngle.value = state.angle; };
  }

  return {
    update(elapsed, state) {
      const strength = Math.max(.08, state.intensity);
      const tint = projectionUniforms.uTint.value.copy(cool).lerp(warm, state.warmth);
      projectionUniforms.uTime.value = elapsed; projectionUniforms.uStrength.value = strength; projectionUniforms.uAngle.value = state.angle;
      wallProjectionUniforms.uTime.value = elapsed; wallProjectionUniforms.uStrength.value = strength; wallProjectionUniforms.uAngle.value = state.angle; wallProjectionUniforms.uTint.value.copy(tint);
      sunlight.value.set(kind==='leaf'?-.65-state.angle*.18:-.25,kind==='leaf'?-.85+state.angle*.12:-.20,1).normalize();
      target.position.copy(windowLight.position).addScaledVector(sunlight.value,7);
      skyBounce.color.copy(tint);skyBounce.intensity=.04+strength*.40;
      windowLight.intensity = .08 + strength * 4; windowLight.color.copy(tint);
      volumeUniforms.uTime.value = elapsed; volumeUniforms.uWarmth.value = state.warmth; volumeUniforms.uActivity.value = state.activity; volumeUniforms.uStrength.value = strength * (state.beamStrength ?? 1) * (state.lowQuality ? .56 : 1);
      animated(elapsed, state);
    },
    dispose() { scene.remove(group); disposeObject(group); },
  };
}
