import {seededRandom} from '../../shared/math/seededRandom.ts';

// Shared authored rainfall: the visible streak and its swept collision segment
// are two samples of the same deterministic drop, not unrelated random impacts.
const random=seededRandom(74019);
export const rainDrops=Array.from({length:80},()=>({phase:random(),seed:random()*1000,speed:4+random()*2.5,length:.035+random()*.065,brightness:.35+random()*.65,width:.00055+random()*.00065}));
const hash=(n:number)=>{const v=Math.sin(n*12.9898)*43758.5453;return v-Math.floor(v);};
export function rainOrigin(seed:number,cycle:number){return {x:.68+hash(seed+cycle*7.13)*.51,z:-1.19+hash(seed+cycle*13.71+4)*.77};}
export function rainSample(index:number,time:number){
 const d=rainDrops[index],cycle=time*d.speed/3+d.phase,lap=Math.floor(cycle),phase=cycle-lap,y=3*(1-phase),o=rainOrigin(d.seed,lap),drift=.012*(3-y);
 return {x:o.x+drift,y,z:o.z+drift*.35,cycle:lap,phase};
}
export type RainBlock={cycle:number,y:number};
