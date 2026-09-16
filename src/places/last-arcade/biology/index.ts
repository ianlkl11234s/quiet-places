import * as THREE from 'three';
import {createMantaModel} from '../../../creatures/manta/index.ts';
import {createArcadeSchools} from '../../../systems/schooling/index.ts';
import {ArcadeAnimalMotion,profiles} from './Motion.ts';
import {installCreatureAmbient} from './CreatureAmbient.ts';
import {arcadeObstacles} from './Obstacles.ts';
/** Owns all creature resources; uses only the player's elapsed time. */
export function createArcadeBiology(){
 const root=new THREE.Group();root.name='kuroshio-arcade-biology';
 const models=profiles.slice(0,3).map(p=>createMantaModel(p.size,p.seed));
 models.forEach((model,i)=>{model.root.name=profiles[i].id;model.root.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});root.add(model.root);});
 // A dedicated fixed-step sampler keeps fish encounters independent of render scheduling.
 let motion=new ArcadeAnimalMotion(false),encounters=new ArcadeAnimalMotion(false);
 const makeSchools=()=>createArcadeSchools({seed:91626,obstacles:arcadeObstacles(),sampleThreats:time=>encounters.sample(time).slice(0,3).map((s,i)=>({position:s.position,velocity:s.velocity,radius:profiles[i].size*.5}))});
 let schools=makeSchools(),last=0,disposed=false;root.add(schools.root);let ambient=installCreatureAmbient(root);
 const debug=()=>({...motion.debug(),schools:schools.getDebug()});root.userData.getDebug=debug;
 return {root,getDebug:debug,update(dt:number,elapsed:number){
  if(disposed)return;if(elapsed<last-1e-6){motion=new ArcadeAnimalMotion(false);encounters=new ArcadeAnimalMotion(false);ambient.dispose();schools.root.removeFromParent();schools.dispose();schools=makeSchools();root.add(schools.root);ambient=installCreatureAmbient(root);}
  last=elapsed;const poses=motion.sample(elapsed);poses.forEach((s,i)=>{const model=models[i];model.root.position.copy(s.position);model.root.quaternion.copy(s.quaternion);model.update({phase:s.phase,amplitude:1,glide:s.glide,asymmetry:s.asymmetry});});
  schools.setRareEventsEnabled(motion.noticeableEvents<1);schools.update(dt,elapsed);ambient.update(elapsed);
 },disturb(){schools.disturb();},dispose(){if(disposed)return;disposed=true;ambient.dispose();models.forEach(m=>m.dispose());schools.dispose();root.removeFromParent();root.clear();}};
}
