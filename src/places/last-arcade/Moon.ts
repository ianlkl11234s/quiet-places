import * as THREE from 'three';

/** Mid-Autumn candidate switch: 0 restores the confirmed moonless night sky. */
export const ARCADE_FULL_MOON = 1;

/**
 * Art-directed placement in the default view: x/y are NDC of a 16:9 frame
 * (right/up positive), size is the apparent diameter in degrees. A real moon
 * is ~0.5°; the larger default is the scene's one permitted quiet impossibility.
 */
export interface MoonSettings {size:number;brightness:number;x:number;y:number}
export const ARCADE_MOON_DEFAULTS:MoonSettings = {size:2.4, brightness:1, x:.70, y:.76};

// DISTANCE is depth along the default view axis; the slider extremes stay inside camera.far=700.
const DISTANCE = 450, FRAME_ASPECT = 16/9, QUAD = 3; // quad spans 3 disc diameters for the halo

const vertexShader = /* glsl */`
varying vec2 vMoonUv;
void main(){vMoonUv=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`;
// Procedural full disc: faint limb darkening, low-frequency maria and a tight
// halo. The disc stays below the shared bloom threshold at 100% brightness.
const fragmentShader = /* glsl */`
uniform float uMoonBrightness;
uniform float uMoonVisible;
varying vec2 vMoonUv;
float moonHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float moonNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(moonHash(i),moonHash(i+vec2(1,0)),f.x),mix(moonHash(i+vec2(0,1)),moonHash(i+vec2(1,1)),f.x),f.y);}
void main(){
 vec2 p=vMoonUv*${QUAD.toFixed(1)};
 float r=length(p);
 float edge=fwidth(r)*1.5;
 float disc=1.-smoothstep(1.-edge,1.,r);
 float mu=sqrt(max(0.,1.-r*r));
 float maria=smoothstep(.45,.75,moonNoise(p*1.6+vec2(3.1,7.4))*.65+moonNoise(p*3.7+11.)*.35);
 vec3 surface=vec3(.93,.90,.82)*(.86+.14*mu)*(1.-.24*maria);
 float halo=exp(-max(r-1.,0.)*3.2)*(1.-disc)*.07;
 vec3 color=(surface*disc+vec3(.62,.66,.72)*halo)*uMoonBrightness*uMoonVisible;
 gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
`;

/** A camera-facing disc far down the default sight line; faded by the scene's own night factor. */
export function installArcadeMoon(position:THREE.Vector3Tuple,target:THREE.Vector3Tuple,verticalFov:number){
  const eye = new THREE.Vector3(...position);
  const material = new THREE.ShaderMaterial({
    name:'arcade-full-moon', vertexShader, fragmentShader,
    uniforms:{uMoonBrightness:{value:1}, uMoonVisible:{value:0}},
    transparent:true, blending:THREE.AdditiveBlending, depthWrite:false,
  });
  const geometry = new THREE.PlaneGeometry(1,1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'arcade-full-moon'; mesh.frustumCulled = false; mesh.visible = false;
  const forward = new THREE.Vector3(...target).sub(eye).normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward);
  const tanV = Math.tan(THREE.MathUtils.degToRad(verticalFov)/2);
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, forward.clone().negate()));
  function setSettings(settings:MoonSettings){
    const direction = forward.clone()
      .addScaledVector(right, settings.x*tanV*FRAME_ASPECT)
      .addScaledVector(up, settings.y*tanV).normalize();
    // Parallel to the default image plane, not facing the eye: a billboard this
    // far off-axis would project as a stretched ellipse in the 62° lens.
    mesh.position.copy(eye).addScaledVector(direction, DISTANCE/direction.dot(forward));
    mesh.scale.setScalar(2*DISTANCE*Math.tan(THREE.MathUtils.degToRad(settings.size)/2)*QUAD);
    material.uniforms.uMoonBrightness.value = settings.brightness;
  }
  setSettings(ARCADE_MOON_DEFAULTS);
  return {mesh, setSettings,
    update(night:number){
      const visible = ARCADE_FULL_MOON ? THREE.MathUtils.smoothstep(night,.2,1) : 0;
      material.uniforms.uMoonVisible.value = visible;
      mesh.visible = visible > 0;
    },
    dispose(){mesh.removeFromParent(); geometry.dispose(); material.dispose();},
  };
}
