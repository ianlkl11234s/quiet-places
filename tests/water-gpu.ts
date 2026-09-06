import * as THREE from 'three';
import {createWaterSimulation} from '../src/systems/WaterSimulation';
const result=document.querySelector('#result')!;
try{
 const renderer=new THREE.WebGLRenderer();renderer.setSize(64,64);document.body.append(renderer.domElement);
 const sim=createWaterSimulation(renderer);
 renderer.setViewport(2,3,40,38);renderer.setScissor(1,1,39,39);renderer.setScissorTest(true);
 const viewport=renderer.getViewport(new THREE.Vector4()).toArray().join(',');
 const scissor=renderer.getScissor(new THREE.Vector4()).toArray().join(',');
 const initial=sim.inspect();sim.update(0);const frozen=sim.inspect();
 if(JSON.stringify(initial)!==JSON.stringify(frozen))throw Error('zero dt changed state');
 sim.update(1/120);const noPulse=sim.inspect();sim.reset();
 sim.disturb(.43,.52);sim.update(1/120);const pulse=sim.inspect();
 if(Math.abs(pulse.stateNorm-noPulse.stateNorm)<1e-6)throw Error('pulse did not change surface');
 for(let i=0;i<3600;i++){sim.update(1/60);if(i%60===0)await new Promise(requestAnimationFrame);}
 const after=sim.inspect();
 if(renderer.getRenderTarget()!==null||renderer.getViewport(new THREE.Vector4()).toArray().join(',')!==viewport||renderer.getScissor(new THREE.Vector4()).toArray().join(',')!==scissor||!renderer.getScissorTest())throw Error('renderer state leaked');if(!after.finite||after.maxHeight>.15||after.maxVelocity>2)throw Error('unstable field '+JSON.stringify(after));
 if(after.steps<=initial.steps||after.stateNorm===initial.stateNorm)throw Error('solver did not advance');
 sim.reset();const reset=sim.inspect();if(JSON.stringify(reset)!==JSON.stringify(initial))throw Error('reset mismatch');
 sim.update(1/60);const combined=sim.inspect();sim.reset();sim.update(1/120);sim.update(1/120);const split=sim.inspect();if(JSON.stringify(combined)!==JSON.stringify(split))throw Error('frame-rate dependence');
 const a=sim.texture;sim.dispose();renderer.dispose();
 result.textContent=JSON.stringify({status:'PASS',initial,frozen,pulse,after,reset,rendererStateRestored:true,fixedStepEquivalent:true,textureType:a.type},null,2);
}catch(error){result.textContent='FAIL '+String(error);console.error(error);}
