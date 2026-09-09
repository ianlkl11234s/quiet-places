import * as THREE from 'three';
import type {PlaceFactory} from '../../player/contracts.ts';
import {collectModelResources,disposeModelResources} from '../../shared/resources/ModelResources.ts';
import {seededRandom} from '../../shared/math/seededRandom.ts';
import {prepareTunnelRay} from './Stingray.ts';
import {tunnelMaterial,seaMaterial} from './Materials.ts';

export async function prepareSeaward():Promise<PlaceFactory>{
 const createRay=await prepareTunnelRay();
 const factory:PlaceFactory=(scene)=>{
  const root=new THREE.Group();root.name='seaward-tunnel';scene.add(root);
  const time={value:0},day={value:1},beam={value:1};
  const wall=tunnelMaterial('wall',time,day,beam),floor=tunnelMaterial('floor',time,day,beam),ceiling=tunnelMaterial('ceiling',time,day,beam);
  const box=(name:string,size:[number,number,number],pos:[number,number,number],material:THREE.Material)=>{
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.name=name;mesh.position.set(...pos);root.add(mesh);return mesh;
  };
  box('wet-concrete-floor',[7.4,.22,23],[0,-.11,-.5],floor);
  box('left-wall',[.35,4.5,20],[-3.575,2.1,-1],wall);
  box('right-wall',[.35,4.5,20],[3.575,2.1,-1],wall);
  box('low-ceiling',[7.5,.3,20],[0,4.35,-1],ceiling);
  box('seaward-parapet',[15,.62,.4],[0,.16,-13.6],wall);
  const ocean=new THREE.Mesh(new THREE.PlaneGeometry(1100,1000),seaMaterial(time,day));ocean.rotation.x=-Math.PI/2;ocean.position.set(0,-.32,-513);root.add(ocean);
  const mountainMaterial=new THREE.MeshBasicMaterial({color:'#abb9bb',fog:false});
  for(const [x,z,w,h] of [[-170,-430,210,12],[120,-390,200,23],[270,-440,180,35]]){
   const shape=new THREE.Shape();shape.moveTo(-w/2,0);
   for(let i=0;i<=40;i++){const t=i/40;shape.lineTo((t-.5)*w,Math.pow(Math.sin(t*Math.PI),1.8)*h*(.82+.12*Math.sin(t*17.)+.06*Math.cos(t*31.)));}
   shape.lineTo(w/2,0);shape.closePath();const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),mountainMaterial);mesh.position.set(x,-.3,z);root.add(mesh);
  }
  const metal=new THREE.MeshStandardMaterial({color:'#343c3e',roughness:.73,metalness:.55});
  const pipe=(a:THREE.Vector3,b:THREE.Vector3,r:number)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,a.distanceTo(b),8),metal);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());root.add(mesh);};
  pipe(new THREE.Vector3(3.22,1.05,7),new THREE.Vector3(3.22,1.05,-10.8),.035);
  for(let z=-10;z<8;z+=2)pipe(new THREE.Vector3(3.22,1.05,z),new THREE.Vector3(3.4,.90,z),.022);
  // Sparse dry grass: original procedural silhouettes, no asserted botanical species.
  const random=seededRandom(91),grassMaterial=new THREE.MeshStandardMaterial({color:'#756e50',roughness:1,side:THREE.DoubleSide});
  const grass=new THREE.Group();root.add(grass);
  for(let i=0;i<62;i++){
   const x=(i<31?-1:1)*(2.7+random()*.6),z=-11.7+random()*.7,h=.2+random()*.65,lean=(random()-.5)*.45;
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([x-.012,0,z,x+.012,0,z,x+lean*.5,h*.65,z,x+lean,h,z-.08],3));geometry.setIndex([0,1,2,1,3,2]);geometry.computeVertexNormals();grass.add(new THREE.Mesh(geometry,grassMaterial));
  }
  const sky=new THREE.HemisphereLight('#b7cbd6','#292623',.14);root.add(sky);
  const opening=new THREE.PointLight('#e3e7df',65,35,2);opening.position.set(1.7,3.1,-12);root.add(opening);
  const ray=createRay(root);
  const shadowMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
   vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:'varying vec2 v;void main(){float r=length((v-.5)*2.);gl_FragColor=vec4(0.,0.,0.,(1.-smoothstep(.1,1.,r))*.19);}'});
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1.5,1.1),shadowMaterial);shadow.rotation.x=-Math.PI/2;root.add(shadow);
  const visitor=root.getObjectByName('tunnel-stingray')!;
  const background=new THREE.Color('#c0ccd0');scene.background=background;
  let disposed=false;
  return {position:[-2,1.25,1.8],target:[-4.1,1.5,-11],yawRange:Math.PI/30,get fov(){return typeof window!=='undefined'&&window.innerWidth<700?90:53;},exposure:1.15,hasSimulation:false,waterMode:'',
   update(_dt,elapsed,state){time.value=elapsed;beam.value=state.beamStrength??1;day.value=.10+.90*Math.min(1,Math.max(0,state.intensity));background.set('#c0ccd0').multiplyScalar(day.value);opening.intensity=65*day.value;sky.intensity=.14*day.value;mountainMaterial.color.set('#abb9bb').multiplyScalar(day.value);grass.rotation.z=Math.sin(elapsed*.31)*.001;ray.update(elapsed);shadow.position.set(visitor.position.x,.012,visitor.position.z);},
   disturb(){},resetWater(){},dispose(){if(disposed)return;disposed=true;ray.dispose();disposeModelResources(collectModelResources(root),['geometries','materials','textures']);root.removeFromParent();if(scene.background===background)scene.background=null;},
  };
 };
 return Object.assign(factory,{dispose:createRay.dispose});
}
