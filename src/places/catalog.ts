import type * as THREE from 'three';
import type {EnvironmentState} from '../world/Environment';

import type {PlaceId} from './metadata';
export {places,moments,isPlaceId,type PlaceId} from './metadata';
export interface PlaceInstance {
  position:[number,number,number]; target:[number,number,number]; yawRange:number;
  fov?:number; exposure?:number; toneMapping?:THREE.ToneMapping;
  hasSimulation:boolean; waterMode:string;
  update(dt:number,elapsed:number,state:EnvironmentState):void;
  disturb(u:number,v:number):void; resetWater():void; dispose():void;
}
type Factory=((scene:THREE.Scene,renderer:THREE.WebGLRenderer)=>PlaceInstance)&{dispose?():void};
// Loading modules allocates no GPU resources; only the current factory is active.
export async function preparePlace(id:PlaceId):Promise<Factory>{
  if(id==='leaflight'){
    const {prepareLeaflight}=await import('../world/LeaflightPlace');
    return prepareLeaflight();
  }
  if(id==='waterlight'){
    const [{createEnvironment},{createFishSchool}]=await Promise.all([import('../world/Environment'),import('../world/FishSchool')]);
    return (scene,renderer)=>{
      const env=createEnvironment(scene,renderer);const fish=createFishSchool(scene);
      return {position:[2.6,2.3,9.5],target:[0,3.4,-.2],yawRange:Math.PI/4,
        get hasSimulation(){return env.hasSimulation;},get waterMode(){return env.waterMode;},
        update(dt,elapsed,state){env.update(elapsed,state,dt);fish.update(dt,elapsed,state);},
        disturb:env.disturb,resetWater:env.resetWater,dispose(){fish.dispose();env.dispose();}};
    };
  }
  const [{createWindowPlace},{createFloorKoi}]=await Promise.all([import('../world/WindowPlaces'),import('../world/FloorKoi')]);
  return scene=>{
    const env=createWindowPlace(scene,'ocean');const fish=createFloorKoi(scene);
    return {position:[3,1.8,8],target:[0,1.65,-1],yawRange:Math.PI/12,hasSimulation:false,waterMode:'',
      update(dt,elapsed,state){env.update(elapsed,state);fish.update(dt,elapsed,state);},
      disturb(){},resetWater(){},dispose(){fish.dispose();env.dispose();}};
  };
}
