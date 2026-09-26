import type {PlaceFactory} from '../../player/contracts.ts';
import {createWindowPlace} from './WindowRoom.ts';
import {prepareStingrays} from './Stingrays.ts';
import {createOceanAmbient} from './Ambient.ts';

export async function prepareOceanlight():Promise<PlaceFactory> {
  const createRays=await prepareStingrays();
  const factory:PlaceFactory=(scene,renderer)=>{
    const env=createWindowPlace(scene,'ocean',createRays);
    // Candidate weak window IBL (Q1-2); remove this line and the two calls below to revert.
    const ambient=renderer?createOceanAmbient(scene,renderer):undefined;
    return {
      position:[3,1.8,8],target:[0,1.65,-1],yawRange:Math.PI/12,
      hasSimulation:false,waterMode:'',setOceanLevel:env.setOceanLevel,
      update(_dt,elapsed,state){env.update(elapsed,state);ambient?.update(state,env.apertureFactor);},
      disturb(){},resetWater(){},dispose(){ambient?.dispose();env.dispose();},
    };
  };
  return Object.assign(factory,{dispose:createRays.dispose});
}
