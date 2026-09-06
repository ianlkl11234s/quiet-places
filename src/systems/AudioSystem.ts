export function createAudioSystem(){
 let context:AudioContext|undefined;let gain:GainNode|undefined;let enabled=false;
 async function toggle(){
  if(!context){
   context=new AudioContext();gain=context.createGain();gain.gain.value=0;gain.connect(context.destination);
   const buffer=context.createBuffer(1,context.sampleRate*8,context.sampleRate);const data=buffer.getChannelData(0);let brown=0;
   for(let i=0;i<data.length;i++){brown=(brown+Math.random()*.04-.02)/1.02;data[i]=brown*3;}
   const source=context.createBufferSource();source.buffer=buffer;source.loop=true;
   const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=500;source.connect(filter);filter.connect(gain);source.start();
   const breath=context.createOscillator();breath.frequency.value=.085;const depth=context.createGain();depth.gain.value=55;breath.connect(depth);depth.connect(filter.frequency);breath.start();
  }
  await context.resume();enabled=!enabled;gain!.gain.setTargetAtTime(enabled?.055:0,context.currentTime,.7);return enabled;
 }
 function visibility(hidden:boolean){if(!context)return;if(hidden)void context.suspend();else if(enabled)void context.resume()}
 return {toggle,visibility,dispose:()=>context?.close()};
}
