import {createArcadeSchools} from '../src/systems/schooling/index.ts';
import {arcadeObstacles} from '../src/places/last-arcade/biology/Obstacles.ts';
import {writeFileSync} from 'node:fs';
const old=await import('../exports/last-arcade-schooling/baseline/schooling.ts');
const results={};
for(const [name,factory] of [['before',old.createArcadeSchools],['after',createArcadeSchools]]){
 const school=factory({seed:91626,obstacles:arcadeObstacles()});school.update(0,0);let prev=school.getDebug();const metrics={};for(const kind of ['chromis','fusilier'])metrics[kind]={speeds:[],pitch:[],turn:[],vertical:[],nearest:[],polarization:[]};
 for(let step=1;step<=7200;step++){school.update(1/12,step/12);const d=school.getDebug();for(const kind of ['chromis','fusilier']){const m=metrics[kind];if(step%12===0){m.nearest.push(d[kind].medianNearestNeighborBL);m.polarization.push(d[kind].polarization);}d[kind].agents.forEach((f,i)=>{const p=prev[kind].agents[i],dot=Math.max(-1,Math.min(1,f.heading.reduce((sum,v,j)=>sum+v*p.heading[j],0)));m.speeds.push(f.speedBL);m.pitch.push(Math.asin(Math.min(1,Math.abs(f.heading[1])))*180/Math.PI);m.turn.push(Math.acos(dot)*180/Math.PI*12);m.vertical.push(Math.abs(f.position[1]-p.position[1])*12);});}prev=d;}
 const quantile=(a,p)=>a.sort((a,b)=>a-b)[Math.floor((a.length-1)*p)];results[name]={};for(const [kind,m] of Object.entries(metrics)){results[name][kind]=Object.fromEntries(Object.entries(m).map(([k,v])=>[k,{median:quantile(v,.5),p95:quantile(v,.95),max:Math.max(...(v.length<100000?v:[quantile(v,1)]))}]));results[name][kind].penetrations=prev[kind].actualPenetrations;}school.dispose();
}
writeFileSync('exports/last-arcade-schooling/motion-comparison.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
