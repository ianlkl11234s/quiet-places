import * as THREE from 'three';

/** Seconds for the moon to climb into place; 0 makes it appear in place. */
export const MOON_RISE_SECONDS = 12;

/**
 * Art-directed placement in the default view: x/y are NDC of a 16:9 frame
 * (right/up positive), size is the apparent diameter in degrees. A real moon
 * is ~0.5°; the larger default is the scene's one permitted quiet impossibility.
 */
export interface MoonSettings {size:number;brightness:number;x:number;y:number}

export interface MoonOptions {
  /** The place's default camera; the moon is fixed in the world, laid out in this view. */
  position:THREE.Vector3Tuple; target:THREE.Vector3Tuple; verticalFov:number;
  defaults:MoonSettings;
  /** Rise start relative to the chosen spot, in default-view NDC; pick a point hidden behind scenery. */
  riseFrom:{x:number;y:number};
  /** Place switch constant: false keeps the moon hidden, restoring the moonless sky. */
  enabled:boolean;
  name:string;
}

// DISTANCE is depth along the default view axis; the slider extremes stay inside camera.far=700.
const DISTANCE = 450, FRAME_ASPECT = 16/9, QUAD = 3; // quad spans 3 disc diameters for the halo

const vertexShader = /* glsl */`
varying vec2 vMoonUv;
void main(){vMoonUv=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`;
// Procedural full disc: an evenly bright limb, faint low-frequency maria kept
// off the rim (dark patches at the edge read as a gibbous, not a full moon) and
// a tight halo. The disc stays below the shared bloom threshold at 100%.
const fragmentShader = /* glsl */`
uniform float uMoonBrightness;
uniform float uMoonVisible;
uniform vec3 uMoonTint;
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
 maria*=1.-smoothstep(.55,.85,r);
 vec3 surface=vec3(.93,.90,.82)*uMoonTint*(.97+.03*mu)*(1.-.16*maria);
 float halo=exp(-max(r-1.,0.)*3.2)*(1.-disc)*.07;
 vec3 color=(surface*disc+vec3(.62,.66,.72)*halo)*uMoonBrightness*uMoonVisible;
 gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
`;

/** A camera-facing disc far down the default sight line; faded by the scene's own night factor. */
export function installFullMoon({position,target,verticalFov,defaults,riseFrom,enabled,name}:MoonOptions){
  const eye = new THREE.Vector3(...position);
  const material = new THREE.ShaderMaterial({
    name, vertexShader, fragmentShader,
    uniforms:{uMoonBrightness:{value:1}, uMoonVisible:{value:0}, uMoonTint:{value:new THREE.Color(1,1,1)}},
    transparent:true, blending:THREE.AdditiveBlending, depthWrite:false,
  });
  const geometry = new THREE.PlaneGeometry(1,1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name; mesh.frustumCulled = false; mesh.visible = false;
  const forward = new THREE.Vector3(...target).sub(eye).normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward);
  const tanV = Math.tan(THREE.MathUtils.degToRad(verticalFov)/2);
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, forward.clone().negate()));
  const settings = {...defaults}, direction = new THREE.Vector3();
  const lowTint = new THREE.Color(1,.80,.60), tint = material.uniforms.uMoonTint.value as THREE.Color;
  // 0 = at the rise start, 1 = at the chosen spot. Starts risen so a room opened
  // at night shows the moon in place; only a transition into night replays the rise.
  let rise = 1, wasVisible = true, initialized = false;
  const directionAt = (x:number,y:number,out:THREE.Vector3) =>
    out.copy(forward).addScaledVector(right, x*tanV*FRAME_ASPECT).addScaledVector(up, y*tanV).normalize();
  const defaultDirection = directionAt(defaults.x, defaults.y, new THREE.Vector3());
  function place(){
    const e = rise*rise*(3-2*rise); // eases out of the rise start and settles into the chosen spot
    directionAt(settings.x+riseFrom.x*(1-e), settings.y+riseFrom.y*(1-e), direction);
    // Parallel to the default image plane, not facing the eye: a billboard this
    // far off-axis would project as a stretched ellipse in the 62° lens.
    mesh.position.copy(eye).addScaledVector(direction, DISTANCE/direction.dot(forward));
    mesh.scale.setScalar(2*DISTANCE*Math.tan(THREE.MathUtils.degToRad(settings.size)/2)*QUAD);
    // Low in the sky the moon is dimmer and warmer (longer air path).
    tint.copy(lowTint).lerp(new THREE.Color(1,1,1), e);
    material.uniforms.uMoonBrightness.value = settings.brightness*(.6+.4*e);
  }
  place();
  return {mesh, defaults,
    setSettings(next:MoonSettings){Object.assign(settings,next);place();},
    /** Unit direction from the viewer to the moon as currently shown. */
    direction,
    /** The same direction for the place's defaults, fully risen: the reference for relative moonlight. */
    defaultDirection,
    /** 0 while hidden or at the rise start, 1 once it has risen. */
    get risen(){return mesh.visible?rise*rise*(3-2*rise):0;},
    update(night:number,dt:number){
      const visible = enabled ? THREE.MathUtils.smoothstep(night,.2,1) : 0;
      if(!initialized){initialized=true;wasVisible=visible>0;rise=wasVisible?1:0;}
      if(visible>0&&!wasVisible)rise=0;
      wasVisible=visible>0;
      // A paused or reduced-motion player advances no time: show the moon in place.
      if(visible>0&&rise<1)rise=dt>0&&MOON_RISE_SECONDS>0?Math.min(1,rise+dt/MOON_RISE_SECONDS):1;
      material.uniforms.uMoonVisible.value = visible;
      mesh.visible = visible > 0;
      place();
    },
    dispose(){mesh.removeFromParent(); geometry.dispose(); material.dispose();},
  };
}
