import type {PlaceFactory} from '../../player/contracts.ts';
import {createEnvironment} from './Environment.ts';
import {prepareLongFinKoiSchool} from './FishSchool.ts';

export async function prepareWaterlight():Promise<PlaceFactory> {
  const prepareFish=await prepareLongFinKoiSchool();
  const factory:PlaceFactory=(scene,renderer)=>{
    const env=createEnvironment(scene,renderer);
    let fish:ReturnType<typeof prepareFish>;
    try{fish=prepareFish(scene);}
    catch(error){env.dispose();prepareFish.dispose();throw error;}
    return {
      position:[2.6,2.3,9.5],target:[0,3.4,-.2],yawRange:Math.PI/4,
      get hasSimulation(){return env.hasSimulation;},
      get waterMode(){return env.waterMode;},
      update(dt,elapsed,state){env.update(elapsed,state,dt);fish.update(dt,elapsed,state);},
      disturb:env.disturb,resetWater:env.resetWater,
      dispose(){fish.dispose();env.dispose();},
    };
  };
  factory.dispose=prepareFish.dispose;
  return factory;
}
