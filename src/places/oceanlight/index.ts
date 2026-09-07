import type {PlaceFactory} from '../../player/contracts.ts';
import {createWindowPlace} from './WindowRoom.ts';
import {prepareStingrays} from './Stingrays.ts';

export async function prepareOceanlight():Promise<PlaceFactory> {
  const createRays=await prepareStingrays();
  const factory:PlaceFactory=scene=>{
    const env=createWindowPlace(scene,'ocean',createRays);
    return {
      position:[3,1.8,8],target:[0,1.65,-1],yawRange:Math.PI/12,
      hasSimulation:false,waterMode:'',setOceanLevel:env.setOceanLevel,
      update(_dt,elapsed,state){env.update(elapsed,state);},
      disturb(){},resetWater(){},dispose(){env.dispose();},
    };
  };
  return Object.assign(factory,{dispose:createRays.dispose});
}
