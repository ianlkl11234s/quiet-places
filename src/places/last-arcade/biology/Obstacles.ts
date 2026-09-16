import {Box3,Vector3} from 'three';
export type Obstacle={name:string,min:[number,number,number],max:[number,number,number]};
/** Conservative boxes derived from last_arcade.py, Three=(Blender X,Z,-Y).
 * Separate facade, roof, posts and rails; not a single street-sized mesh box. */
export function arcadeObstacles():Obstacle[]{
 const result:Obstacle[]=[];
 const add=(name:string,min:Obstacle['min'],max:Obstacle['max'])=>result.push({name,min,max});
 add('storefront',[-5.9,-.2,-27],[.25,3.65,7]);
 add('soffit',[.05,2.97,-25.7],[1.32,3.65,6.5]);
 add('arcade-roof',[1.2,3.05,-25.7],[3.03,3.65,6.5]);
 for(let i=0;i<10;i++){const z=6.4-i*3.2;add(`post-${i}`,[2.70,-.1,z-.13],[2.94,3.2,z+.13]);}
 for(const y of [-2.8,1.8,6.4,11,15.6,20.2])add(`rail-post-${y}`,[2.97,-.1,-y-.05],[3.07,1.05,-y+.05]);
 for(const h of [.5,1.01])add('rail',[2.98,h-.04,-20.45],[3.06,h+.04,3.25]);
 add('marker',[2.85,2.02,-.79],[3.27,2.54,-.71]);
 add('shop-sign',[.28,2.39,-4.65],[1.22,3.05,-4.55]);
 for(const y of [-5,8,21]){add('utility-pole',[9.4,0,-y-.12],[9.64,6.3,-y+.12]);add('crossarm',[8.59,5.62,-y-.07],[10.45,5.8,-y+.07]);}
 for(const x of [8.87,9.52,10.17])add('power-line',[x-.035,5.42,-34],[x+.035,5.86,5]);
 for(const [start,width,height,setback] of [[-6.8,5.1,5.75,0],[-1.32,4.55,3.25,.14],[3.68,5.5,6,.03],[9.6,4.25,4.05,.28],[14.3,5.2,5.55,.08],[19.95,5.65,3.6,.2]])add('opposite-building',[10.08+setback,0,-start-width-.2],[14.7+setback,height+.4,-start+.2]);
 add('seawall',[-15,-.6,-38.4],[24,.85,-37.8]);
 return result;
}
const boxes=arcadeObstacles().map(o=>new Box3(new Vector3(...o.min),new Vector3(...o.max)));
/** Body envelope swept along sampled future centreline, not a point test. */
export function envelopeClear(p:Vector3,half:Vector3):boolean{
 const body=new Box3(p.clone().sub(half),p.clone().add(half));
 return p.y-half.y>.05&&!boxes.some(box=>box.intersectsBox(body));
}
