import * as THREE from 'three';

// Clear-water art calibration, inverse metres; shared by view and solar transmission.
export const oceanAbsorption = new THREE.Vector3(.065,.035,.027);

// Units: metres, seconds, radians. Both geometry and transported light use this field.
const waves = [
  [.070,.43,.31,.42,0], [.042,-.73,.54,.61,1.7],
  [.025,1.28,-.76,.91,3.8], [.015,-.94,-.72,1.22,.6], [.009,1.74,1.31,1.71,4.1],
] as const;

export function sampleOceanWave(x:number,z:number,time:number){
  let height=0,dx=0,dz=0;
  for(const [a,kx,kz,w,phase] of waves){const p=kx*x+kz*z+w*time+phase;const d=a*Math.cos(p);height+=a*Math.sin(p);dx+=d*kx;dz+=d*kz;}
  return {height,dx,dz};
}

const f=(v:number)=>Number.isInteger(v)?`${v}.0`:String(v);
export const oceanWaveGLSL=`
float oceanHeight(vec2 xz,float time){return ${waves.map(([a,x,z,w,p])=>`${f(a)}*sin(dot(xz,vec2(${f(x)},${f(z)}))+time*${f(w)}+${f(p)})`).join('+')};}
vec2 oceanSlope(vec2 xz,float time){return ${waves.map(([a,x,z,w,p])=>`${f(a)}*vec2(${f(x)},${f(z)})*cos(dot(xz,vec2(${f(x)},${f(z)}))+time*${f(w)}+${f(p)})`).join('+')};}
`;

/** Snell refraction plus unpolarized dielectric Fresnel power transmission.
 * normal points into the incident medium; null means back-face incidence or TIR.
 */
export function refractRay(incident:THREE.Vector3,normal:THREE.Vector3,nFrom:number,nTo:number){
  const i=incident.clone().normalize(),n=normal.clone().normalize();
  const ci=-i.dot(n);if(ci<0||nFrom<=0||nTo<=0)return null;
  const eta=nFrom/nTo,sin2=eta*eta*Math.max(0,1-ci*ci);
  if(sin2>=1)return null;
  const ct=Math.sqrt(1-sin2);
  const rs=(nFrom*ci-nTo*ct)/(nFrom*ci+nTo*ct);
  const rp=(nTo*ci-nFrom*ct)/(nTo*ci+nFrom*ct);
  return {direction:i.multiplyScalar(eta).addScaledVector(n,eta*ci-ct).normalize(),transmission:1-(rs*rs+rp*rp)*.5};
}
