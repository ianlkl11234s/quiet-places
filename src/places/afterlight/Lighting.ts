import * as THREE from 'three';
import {corridor,drainOpening as opening} from './DrainOpening.ts';

// Sky gradient derived from the existing leaflight sky; calibration belongs to this courtyard.
const skyVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;

const beamFragment=/* glsl */`
 uniform sampler2D uDepth,uShadow;
 uniform mat4 uProjectionInverse,uCameraWorld,uShadowMatrix;
 uniform vec4 uViewport;
 uniform vec3 uSun;
 uniform float uBeam,uDay,uWarm,uSteps,uHasShadow;
 #include <packing>
 float shadowAt(vec3 p){
  if(uHasShadow<.5)return 0.;
  vec4 s=uShadowMatrix*vec4(p,1.);s.xyz/=s.w;
  if(any(lessThan(s.xyz,vec3(0.)))||any(greaterThan(s.xyz,vec3(1.))))return 0.;
  return step(s.z-.0006,unpackRGBAToDepth(texture2D(uShadow,s.xy)));
 }
 float aperture(vec3 p){
  float t=(p.y-3.)/uSun.y;
  if(t<0.)return 0.;
  vec3 q=p-uSun*t;
  if(q.x<${corridor.centerX.toFixed(3)})q.x=${(2*corridor.centerX).toFixed(3)}-q.x; // Equal drains mirrored about the widened corridor centre.
  return smoothstep(${opening.minX.toFixed(3)},${(opening.minX+.04).toFixed(3)},q.x)*(1.-smoothstep(${(opening.maxX-.04).toFixed(3)},${opening.maxX.toFixed(3)},q.x))*
   smoothstep(${opening.minZ.toFixed(3)},${(opening.minZ+.04).toFixed(3)},q.z)*(1.-smoothstep(${(opening.maxZ-.04).toFixed(3)},${opening.maxZ.toFixed(3)},q.z));
 }
 void main(){
  vec2 uv=(gl_FragCoord.xy-uViewport.xy)/uViewport.zw;
  float d=texture2D(uDepth,uv).x;
  vec4 endView=uProjectionInverse*vec4(uv*2.-1.,d*2.-1.,1.);endView/=endView.w;
  vec3 endWorld=(uCameraWorld*endView).xyz;
  vec3 ro=cameraPosition,rd=normalize(endWorld-ro);
  float limit=min(length(endWorld-ro),16.);
  float stepSize=limit/uSteps,light=0.;
  float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
  for(int i=0;i<32;i++){
   if(float(i)>=uSteps)break;
   vec3 p=ro+rd*((float(i)+jitter)*stepSize);
   if(p.y>0.&&p.y<3.&&p.x>${corridor.minX.toFixed(3)}&&p.x<${corridor.maxX.toFixed(3)}&&p.z>-9.&&p.z<4.)light+=aperture(p)*shadowAt(p)*stepSize;
  }
  float alpha=(1.-exp(-light*.025*uBeam))*uDay;
  vec3 color=mix(vec3(.43,.55,.7),vec3(.86,.75,.52),uWarm);
  gl_FragColor=vec4(color,alpha);
 }
`;

/** Scene-owned camera-depth prepass; unchanged model/deformation in all three passes. */
export function createAfterlightLighting(scene:THREE.Scene,renderer:THREE.WebGLRenderer,model:THREE.Object3D,weather:THREE.Object3D){
 const root=new THREE.Group();root.name='afterlight-lighting';scene.add(root);
 const incoming=new THREE.Vector3(.28,-1,.25).normalize(),center=new THREE.Vector3(0,1,-2);
 const sun=new THREE.DirectionalLight(0xffedc5,6);sun.target.position.copy(center);sun.position.copy(center).addScaledVector(incoming,-15);
 sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.00012;sun.shadow.normalBias=.008;
 const sc=sun.shadow.camera;sc.left=-6;sc.right=6;sc.top=7;sc.bottom=-7;sc.near=.1;sc.far=30;sc.updateProjectionMatrix();root.add(sun,sun.target);
 const fill=new THREE.HemisphereLight(0xb3c4cc,0x464235,.018);root.add(fill);
 const skyMaterial=new THREE.ShaderMaterial({vertexShader:skyVertex,fragmentShader:skyFragment,side:THREE.BackSide,depthWrite:false,
  uniforms:{uTime:{value:0},uDaylight:{value:1},uWarmth:{value:.48},uSun:{value:incoming}}});
 const sky=new THREE.Mesh(new THREE.SphereGeometry(120,24,16),skyMaterial);root.add(sky);
 const target=new THREE.WebGLRenderTarget(1,1,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
 target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
 const uniforms={uDepth:{value:target.depthTexture},uShadow:{value:null as THREE.Texture|null},uHasShadow:{value:0},
  uProjectionInverse:{value:new THREE.Matrix4()},uCameraWorld:{value:new THREE.Matrix4()},uShadowMatrix:{value:new THREE.Matrix4()},
  uViewport:{value:new THREE.Vector4()},uSun:{value:incoming},uBeam:{value:1},uDay:{value:1},uWarm:{value:.5},uSteps:{value:32}};
 const beamMaterial=new THREE.ShaderMaterial({uniforms,vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:beamFragment,
  transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
 const beam=new THREE.Mesh(new THREE.PlaneGeometry(2,2),beamMaterial);beam.frustumCulled=false;beam.renderOrder=1;root.add(beam);
 beam.onBeforeRender=()=>{uniforms.uShadow.value=sun.shadow.map?.texture??null;uniforms.uHasShadow.value=uniforms.uShadow.value?1:0;uniforms.uShadowMatrix.value.copy(sun.shadow.matrix);};
 const depthBindings:Array<{mesh:THREE.Mesh,material:THREE.Material|THREE.Material[],depth:THREE.Material|THREE.Material[]}>=[];
 const ownedDepth:THREE.Material[]=[];
 model.traverse(o=>{
  if(!(o instanceof THREE.Mesh))return;
  let depth:THREE.Material|THREE.Material[];
  if(o.customDepthMaterial)depth=o.customDepthMaterial;
  else{
   const make=(m:THREE.Material)=>{const s=m as THREE.MeshStandardMaterial;const d=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:s.map,alphaMap:s.alphaMap,alphaTest:s.alphaTest,side:s.side});ownedDepth.push(d);return d;};
   depth=Array.isArray(o.material)?o.material.map(make):make(o.material);
  }
  depthBindings.push({mesh:o,material:o.material,depth});
 });
 let busy=false,low=false;
 const previous=scene.onBeforeRender;
 scene.onBeforeRender=(r,s,camera,currentTarget)=>{
  if(busy)return;
  // Scene uses a render-target fourth argument at runtime (Object3D typings differ).
  Reflect.apply(previous,scene,[r,s,camera,currentTarget]);
  uniforms.uProjectionInverse.value.copy(camera.projectionMatrixInverse);uniforms.uCameraWorld.value.copy(camera.matrixWorld);
  r.getCurrentViewport(uniforms.uViewport.value);
  if(uniforms.uBeam.value<=0){beam.visible=false;return;}beam.visible=true;
  const viewport=uniforms.uViewport.value;
  const width=Math.max(1,Math.round(viewport.z*(low?.4:.65))),height=Math.max(1,Math.round(viewport.w*(low?.4:.65)));
  if(target.width!==width||target.height!==height)target.setSize(width,height);
  const oldTarget=r.getRenderTarget(),oldAuto=r.autoClear,oldBackground=scene.background,oldShadow=r.shadowMap.enabled;
  const weatherVisible=weather.visible;
  busy=true;
  try{
   root.visible=false;weather.visible=false;scene.background=null;r.shadowMap.enabled=false;r.autoClear=true;
   depthBindings.forEach(b=>{b.material=b.mesh.material;b.mesh.material=b.depth;});
   r.setRenderTarget(target);r.render(scene,camera);
  }finally{
   depthBindings.forEach(b=>{b.mesh.material=b.material;});root.visible=true;weather.visible=weatherVisible;
   scene.background=oldBackground;r.shadowMap.enabled=oldShadow;r.autoClear=oldAuto;r.setRenderTarget(oldTarget);busy=false;
  }
 };
 return {sun,
  captureEnvironment(){
   // One local afternoon reflection basis. No recursive volume/depth callbacks.
   const capture=new THREE.Scene(),copy=model.clone(true),light=sun.clone(),skyCopy=sky.clone();
   capture.add(copy,light,light.target,fill.clone(),skyCopy);capture.updateMatrixWorld(true);
   const pmrem=new THREE.PMREMGenerator(renderer);
   try{return pmrem.fromScene(capture,0,.03,180,{size:128,position:new THREE.Vector3(.8,.25,.6)});}
   finally{pmrem.dispose();light.shadow.map?.dispose();}
  },
  update(time:number,beamStrength:number,intensity:number,warmth:number,angle:number,lowQuality:boolean){
   low=lowQuality;
   const day=THREE.MathUtils.clamp(intensity/.9,.025,1.15);
   // Art-directed day/night basis: moonlight is dim and cool, never a bright afternoon map.
   const night=THREE.MathUtils.smoothstep(intensity,.09,.3);
   incoming.set(.28,-1,.25).normalize().applyAxisAngle(new THREE.Vector3(0,1,0),THREE.MathUtils.clamp(angle-.25,-.16,.16));
   sun.position.copy(center).addScaledVector(incoming,-15);
   sun.intensity=6*day*(2-night);
   sun.color.setRGB(THREE.MathUtils.lerp(.45,1,night),THREE.MathUtils.lerp(.61,.88-warmth*.12,night),THREE.MathUtils.lerp(1,.62-warmth*.22,night));
   fill.intensity=.018*day+.085*(1-night);
   const shadowSize=low?1024:2048;
   if(sun.shadow.mapSize.x!==shadowSize){sun.shadow.mapSize.set(shadowSize,shadowSize);sun.shadow.map?.dispose();sun.shadow.map=null;}
   skyMaterial.uniforms.uTime.value=time;skyMaterial.uniforms.uDaylight.value=day;skyMaterial.uniforms.uWarmth.value=warmth;
   uniforms.uBeam.value=THREE.MathUtils.clamp(beamStrength,0,2.5);uniforms.uDay.value=day*(.08+.92*night);uniforms.uWarm.value=warmth;uniforms.uSteps.value=low?16:32;
   return {day,indirect:day*(.15+.85*night)+.35*(1-night)};
  },
  dispose(){scene.onBeforeRender=previous;root.removeFromParent();sky.geometry.dispose();skyMaterial.dispose();beam.geometry.dispose();beamMaterial.dispose();ownedDepth.forEach(m=>m.dispose());target.dispose();sun.shadow.map?.dispose();},
 };
}

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
