import * as THREE from 'three';

export interface EnvironmentState {
  intensity: number;
  warmth: number;
  angle: number;
  activity: number;
}

export interface StillwaterEnvironment {
  update(elapsed: number, state: EnvironmentState): void;
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

// Smooth domain-warped contours avoid polygonal cell boundaries in the light pattern.
const causticFragment = /* glsl */ `
  uniform float uTime;
  uniform float uStrength;
  uniform float uAngle;
  uniform float uWarmth;
  varying vec3 vWorld;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise2(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
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
    vec2 p = roof * 1.55;
    p += vec2(sin(p.y*1.7 + uTime*.18), cos(p.x*1.3-uTime*.14)) * .36;
    float web = focus(p) + focus(p*1.63+vec2(8.1,3.2))*.35;
    float fade = (1.0 - smoothstep(0., 16., rise) * .45) * aperture;
    vec3 cool = vec3(.34, .79, .77);
    vec3 cream = vec3(1.0, .78, .45);
    vec3 tint = mix(cool, cream, clamp(uWarmth, 0.0, 1.0));
    gl_FragColor = vec4(tint * web * fade * uStrength * .9, 1.0);
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
const waterVertex = /* glsl */ `
  uniform float uTime; uniform float uActivity;
  varying vec2 vUv; varying vec3 vWorld;
  ${waterField}
  void main() {
    vUv=uv;
    vec3 p=position;
    // Pin the water to the aperture so no moving black seams open along the rim.
    float rim=smoothstep(0.,.09,min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y)));
    p.z+=waterHeight(uv*7.,uTime)*.095*rim*mix(.6,1.,uActivity);
    vWorld=(modelMatrix*vec4(p,1.)).xyz;
    gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
  }
`;
const waterFragment = /* glsl */ `
  uniform float uTime; uniform float uWarmth; uniform float uIntensity;
  varying vec2 vUv; varying vec3 vWorld;
  ${waterField}
  void main() {
    vec2 p=vUv*7.;
    float e=.025;
    vec2 slope=vec2(waterHeight(p+vec2(e,0),uTime)-waterHeight(p-vec2(e,0),uTime),
                    waterHeight(p+vec2(0,e),uTime)-waterHeight(p-vec2(0,e),uTime))/(2.*e);
    vec3 normal=normalize(vec3(-slope.x*.32,-1.,slope.y*.32));
    vec3 view=normalize(cameraPosition-vWorld);
    float fresnel=.02+.98*pow(1.-abs(dot(normal,view)),5.);
    // A softly varying sky transmitted through the surface, distorted by its slope.
    vec2 refracted=vUv+slope*.085;
    float sky=noise2(refracted*3.+vec2(.02*uTime,4.2));
    vec3 deep=vec3(.055,.18,.22), skyColor=vec3(.39,.66,.78);
    vec3 col=mix(deep,skyColor,.36+sky*.42);
    vec2 sunOffset=(vUv-vec2(.66,.68))*.45;
    vec2 bent=slope+sunOffset;
    // Broader low-energy reflection with a small soft glint; no opaque white blobs.
    float spread=110./(1.+length(fwidth(slope))*18.);
    float glint=exp(-dot(bent,bent)*spread);
    float haze=exp(-dot(sunOffset,sunOffset)*8.);
    vec3 sunlight=mix(vec3(.80,.94,1.),vec3(1.,.87,.59),uWarmth);
    col=mix(col,vec3(.09,.19,.23),fresnel*.5);
    col+=sunlight*(glint*1.05+haze*.045);
    col*=.035+uIntensity*.96;
    float opacity=.30+fresnel*.26+glint*.06;
    gl_FragColor=vec4(col,opacity);
  }
`;

const beamVertex = /* glsl */ `
  varying vec2 vUv; varying vec3 vWorld;
  void main() { vUv=uv; vWorld = (modelMatrix * vec4(position,1.)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vWorld,1.); }
`;
const beamFragment = /* glsl */ `
  uniform float uTime; uniform float uStrength; uniform float uWarmth;
  varying vec2 vUv; varying vec3 vWorld;
  float noise(vec3 p) { return fract(sin(dot(p,vec3(12.9898,78.233,37.719))) * 43758.5453); }
  void main() {
    float edge = smoothstep(0., .27, vUv.x) * (1.0-smoothstep(.73,1.,vUv.x));
    float height = smoothstep(0., .13, vUv.y) * (1.0-smoothstep(.63,1.,vUv.y));
    float grain = .60 + .20*sin(vUv.x*38.+sin(vUv.x*73.+uTime*.13)*1.8) + .12*sin(vUv.x*91.-uTime*.09);
    vec3 col = mix(vec3(.16,.52,.52), vec3(1.,.70,.42), uWarmth);
    gl_FragColor = vec4(col * .65, uStrength * .13 * edge * height * grain);
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

export function createEnvironment(scene: THREE.Scene): StillwaterEnvironment {
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
  makePlane(ROOM.width, ROOM.depth, new THREE.Vector3(0, 0, 0), new THREE.Euler(-Math.PI / 2, 0, 0));
  makePlane(ROOM.width, ROOM.height, new THREE.Vector3(0, 3.5, -5), new THREE.Euler(0, 0, 0));
  makePlane(ROOM.depth, ROOM.height, new THREE.Vector3(-4, 3.5, 0), new THREE.Euler(0, Math.PI / 2, 0));
  makePlane(ROOM.depth, ROOM.height, new THREE.Vector3(4, 3.5, 0), new THREE.Euler(0, -Math.PI / 2, 0));
  // Four ceiling slabs leave the exact 3.6m square of water open.
  makePlane(2.2, ROOM.depth, new THREE.Vector3(-2.9, 7, 0), new THREE.Euler(Math.PI / 2, 0, 0));
  makePlane(2.2, ROOM.depth, new THREE.Vector3(2.9, 7, 0), new THREE.Euler(Math.PI / 2, 0, 0));
  makePlane(3.6, 3.4, new THREE.Vector3(0, 7, 3.3), new THREE.Euler(Math.PI / 2, 0, 0));
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
  const waterUniforms = { uTime: { value: 0 }, uActivity: { value: .5 }, uWarmth: { value: .5 }, uIntensity: { value: 1 } };
  const waterMaterial = new THREE.ShaderMaterial({ uniforms: waterUniforms, vertexShader: waterVertex, fragmentShader: waterFragment, transparent: true, depthWrite: false, side: THREE.DoubleSide }); disposable.push(waterMaterial);
  const water = new THREE.Mesh(waterGeometry, waterMaterial); water.rotation.x = -Math.PI / 2; water.position.set(0, 6.985, -.2); add(water);

  const causticUniforms = { uTime: { value: 0 }, uStrength: { value: 1 }, uAngle: { value: 0 }, uWarmth: { value: .5 } };
  const causticMaterial = new THREE.ShaderMaterial({ uniforms: causticUniforms, vertexShader: causticVertex, fragmentShader: causticFragment, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); disposable.push(causticMaterial);
  const overlay = (w: number, h: number, pos: THREE.Vector3, rot: THREE.Euler) => { const g = new THREE.PlaneGeometry(w,h); disposable.push(g); const m = new THREE.Mesh(g, causticMaterial); m.position.copy(pos); m.rotation.copy(rot); add(m); };
  overlay(ROOM.width, ROOM.depth, new THREE.Vector3(0,.014,0), new THREE.Euler(-Math.PI/2,0,0));
  overlay(ROOM.width, ROOM.height, new THREE.Vector3(0,3.5,-4.988), new THREE.Euler(0,0,0));
  overlay(ROOM.depth, ROOM.height, new THREE.Vector3(-3.988,3.5,0), new THREE.Euler(0,Math.PI/2,0));

  const beamUniforms = { uTime: { value: 0 }, uStrength: { value: 1 }, uWarmth: { value: .5 } };
  const beamMaterial = new THREE.ShaderMaterial({ uniforms: beamUniforms, vertexShader: beamVertex, fragmentShader: beamFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }); disposable.push(beamMaterial);
  // Layered translucent sheets read as suspended air from the viewing angle; unlike
  // a box, every visible surface receives the UV falloff instead of vanishing at an edge.
  const beam = new THREE.Group(); beam.position.set(0, 7, -.2); add(beam);
  const beamMaterials: THREE.ShaderMaterial[] = [];
  const addBeamSheet = (rotationY: number, z: number, opacity: number) => {
    const geometry = new THREE.PlaneGeometry(3.6, 7.0); disposable.push(geometry);
    const material = beamMaterial.clone(); material.uniforms = THREE.UniformsUtils.clone(beamUniforms); material.userData.opacity = opacity; beamMaterials.push(material); disposable.push(material);
    const sheet = new THREE.Mesh(geometry, material); sheet.position.set(0, -3.5, z); sheet.rotation.y = rotationY; beam.add(sheet);
  };
  addBeamSheet(0, 0, .62);
  addBeamSheet(.48, -.34, .28);
  addBeamSheet(-.34, .22, .18);

  const dustCount = 230, dustPositions = new Float32Array(dustCount*3), dustSeeds = new Float32Array(dustCount);
  for (let i=0; i<dustCount; i++) { const n=i*3; dustPositions[n]=(Math.random()-.5)*3.5; dustPositions[n+1]=Math.random()*7; dustPositions[n+2]=-.2+(Math.random()-.5)*3.5; dustSeeds[i]=Math.random(); }
  const dustGeometry = new THREE.BufferGeometry(); dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustPositions,3)); dustGeometry.setAttribute('aSeed',new THREE.BufferAttribute(dustSeeds,1)); disposable.push(dustGeometry);
  const dustMaterial = new THREE.ShaderMaterial({ uniforms: { uTime:{value:0}, uAngle:{value:0}, uIntensity:{value:1} }, vertexShader:dustVertex, fragmentShader:dustFragment, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending }); disposable.push(dustMaterial);
  add(new THREE.Points(dustGeometry,dustMaterial));

  const sun = new THREE.SpotLight(0xb8e6d8, 210, 18, .46, .88, 1); sun.position.set(0,6.85,-.2); sun.target.position.set(-3.05,0,-2.24); sun.castShadow = true; sun.shadow.mapSize.set(1024,1024); root.add(sun, sun.target);
  const bounce = new THREE.HemisphereLight(0xa3bab8, 0x14222c, .7); add(bounce);
  const rim = new THREE.PointLight(0x386766, .22, 9, 2); rim.position.set(-3.6,5.6,-3.8); add(rim);
  const temp = new THREE.Color();

  return {
    update(elapsed, state) {
      const intensity = THREE.MathUtils.clamp(state.intensity, 0, 2);
      const warmth = THREE.MathUtils.clamp(state.warmth, 0, 1);
      const angle = THREE.MathUtils.clamp(state.angle, -1.1, 1.1);
      const activity = THREE.MathUtils.clamp(state.activity, 0, 1);
      skyUniforms.uTime.value=elapsed;skyUniforms.uIntensity.value=intensity;skyUniforms.uWarmth.value=warmth;
      waterUniforms.uTime.value = elapsed; waterUniforms.uActivity.value = activity; waterUniforms.uWarmth.value = warmth; waterUniforms.uIntensity.value = intensity;
      causticUniforms.uTime.value = elapsed; causticUniforms.uStrength.value = intensity; causticUniforms.uAngle.value = angle; causticUniforms.uWarmth.value = warmth;
      beamUniforms.uTime.value = elapsed; beamUniforms.uStrength.value = intensity; beamUniforms.uWarmth.value = warmth;
      beamMaterials.forEach((material) => { material.uniforms.uTime.value = elapsed; material.uniforms.uStrength.value = intensity * material.userData.opacity; material.uniforms.uWarmth.value = warmth; });
      dustMaterial.uniforms.uTime.value = elapsed; dustMaterial.uniforms.uAngle.value = angle; dustMaterial.uniforms.uIntensity.value = intensity;
      beam.rotation.z = -.42 + angle * .10;
      beam.rotation.x = .29 + angle * .06;
      const slopeX = -.45 + Math.sin(angle) * .14;
      const slopeZ = -.30 + Math.sin(angle * .7) * .10;
      sun.target.position.set(slopeX * 6.8, 0, -.2 + slopeZ * 6.8);
      sun.intensity = 75 * intensity;
      roomUniforms.uIntensity.value=intensity;roomUniforms.uAngle.value=angle;roomUniforms.uWarmth.value=warmth;
      bounce.intensity=.25+intensity*1.3;
      sun.color.copy(temp.setRGB(THREE.MathUtils.lerp(.48,1, warmth), THREE.MathUtils.lerp(.78,.68,warmth), THREE.MathUtils.lerp(.76,.42,warmth)));
      rim.intensity = .12 + intensity*.10;
    },
    dispose() { scene.remove(root); disposable.forEach((item) => item.dispose()); },
  };
}
