import * as THREE from 'three';

export type RedTwine = {
  root: THREE.Group;
  update(elapsed: number, activity: number): void;
  dispose(): void;
};

type Tail = {
  geometry: THREE.BufferGeometry;
  rest: Float32Array;
  phase: number;
  amplitude: number;
};

const RAIL_WIDTH=.066;
const RAIL_THICKNESS=.038;

function wrappedStrip(x:number,width:number){
  const sides=18,positions=new Float32Array((sides+1)*2*3),indices:number[]=[];
  for(let i=0;i<=sides;i++){
    const angle=i/sides*Math.PI*2;
    // A .55 superellipse follows the flattened, almost rectangular rail without clipping its corners.
    const ripple=Math.sin(angle*5+x*310)*.0012;
    const superellipse=(value:number)=>Math.sign(value)*Math.abs(value)**.55;
    const y=superellipse(Math.cos(angle))*(RAIL_THICKNESS*.5+.003+ripple);
    const z=superellipse(Math.sin(angle))*(RAIL_WIDTH*.5+.003+ripple);
    for(let edge=0;edge<2;edge++){
      const at=(i*2+edge)*3;
      positions[at]=x+(edge?width*.5:-width*.5)+Math.sin(angle*3)*.0008;
      positions[at+1]=y;positions[at+2]=z;
    }
    if(i<sides){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}

function tailGeometry(length:number,width:number,side:number){
  const segments=18,positions=new Float32Array((segments+1)*2*3),indices:number[]=[];
  for(let i=0;i<=segments;i++){
    const t=i/segments;
    // The taperless tape has a small permanent crease; motion is applied to this rest shape.
    const centerX=side*(.013+.018*t)+Math.sin(t*7.4+side)*.006*t;
    const centerY=-length*t+.008*Math.sin(t*8.2+side)*t;
    const centerZ=RAIL_WIDTH*.5+.006+.006*Math.sin(t*5.5+side)*t;
    for(let edge=0;edge<2;edge++){
      const at=(i*2+edge)*3;
      const across=(edge?1:-1)*width*.5;
      // A loose twist opens the flat face to the camera while keeping the knot fixed.
      const twist=Math.min(1,t*4)*1.05;
      positions[at]=centerX+across*Math.cos(twist);
      positions[at+1]=centerY+Math.sin(t*18+edge*1.9)*.0014*t;
      positions[at+2]=centerZ+across*Math.sin(twist)+Math.cos(t*13+edge)*.0016*t;
    }
    if(i<segments){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  // BufferAttribute owns a mutable copy; animation must retain an immutable rest shape.
  return {geometry,rest:positions.slice()};
}

/**
 * A tied length of red "汽水帶" packing film for a locally X-directed flat handrail.
 * The root is deliberately left at its attachment origin for the stair assembly to place.
 */
export function createRedTwine():RedTwine{
  const root=new THREE.Group();root.name='stairlight-red-twine';
  const material=new THREE.MeshStandardMaterial({color:0xbe171d,roughness:.31,metalness:0,side:THREE.DoubleSide});
  const owned:THREE.BufferGeometry[]=[];
  // Four offset layers read as a tight tied wrap rather than a decorative bow.
  for(const [x,width] of [[-.026,.019],[-.008,.021],[.010,.018],[.026,.020]] as const){
    const geometry=wrappedStrip(x,width);owned.push(geometry);
    const mesh=new THREE.Mesh(geometry,material);mesh.name='red-twine-wrap';mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  }
  const knot=new THREE.Mesh(new THREE.SphereGeometry(1,10,7),material);
  knot.name='red-twine-knot';knot.position.set(0,-RAIL_THICKNESS*.5-.009,RAIL_WIDTH*.5+.004);knot.scale.set(.024,.012,.017);
  knot.castShadow=true;knot.receiveShadow=true;root.add(knot);owned.push(knot.geometry);

  const tails:Tail[]=[];
  for(const [length,width,side,phase,amplitude] of [[.38,.014,-1,.4,.021],[.52,.022,1,2.1,.054]] as const){
    const built=tailGeometry(length,width,side);owned.push(built.geometry);
    const mesh=new THREE.Mesh(built.geometry,material);mesh.name='red-twine-tail';mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
    tails.push({...built,phase,amplitude});
  }
  let released=false;
  return {
    root,
    update(elapsed,activity){
      if(released)return;
      const wind=THREE.MathUtils.clamp(activity,0,1);
      for(const tail of tails){
        const position=tail.geometry.getAttribute('position') as THREE.BufferAttribute;
        const count=position.count;
        for(let vertex=0;vertex<count;vertex++){
          const t=Math.floor(vertex/2)/18;
          // t² pins the tie while the free end moves 2–6 cm with deterministic scene time.
          const wave=Math.sin(elapsed*2.15+tail.phase+t*5.1)*tail.amplitude*wind*t*t;
          position.setXYZ(vertex,tail.rest[vertex*3]+wave,tail.rest[vertex*3+1]+Math.cos(elapsed*2.6+tail.phase+t*4)*.008*wind*t*t,tail.rest[vertex*3+2]+Math.sin(elapsed*1.7+tail.phase+t*6)*tail.amplitude*.38*wind*t*t);
        }
        position.needsUpdate=true;tail.geometry.computeVertexNormals();
      }
    },
    dispose(){
      if(released)return;released=true;root.removeFromParent();
      owned.forEach(geometry=>geometry.dispose());material.dispose();
    },
  };
}
