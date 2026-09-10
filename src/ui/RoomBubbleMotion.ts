import {seededRandom} from '../shared/math/seededRandom.ts';

export interface BubbleAnchor {
  id: string;
  x: number;
  y: number;
  scale: number;
}

export const ROOM_BUBBLE_SEED_KEY='quiet-places.room-bubbles.seed';

interface FlowWave {
  kx: number;
  ky: number;
  omega: number;
  phase: number;
  amplitude: number;
}

export interface BubbleBody extends BubbleAnchor {
  anchorX: number;
  anchorY: number;
  vx: number;
  vy: number;
  radius: number;
  maxSpeed: number;
  flowStrength: number;
  shape: number;
  shapeVelocity: number;
  shapeFrequency: number;
  shapePhase: number;
  filmThickness: number;
  filmPhase: number;
  filmSpeed: number;
}

export interface BubbleMotionModel {
  time: number;
  bodies: BubbleBody[];
  waves: FlowWave[];
}

export interface BubblePresentation {
  dx: number;
  dy: number;
  stretchX: number;
  stretchY: number;
  angle: number;
}

const TAU=Math.PI*2;
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));

export function hashBubbleSeed(value:string):number {
  let hash=2166136261;
  for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return hash>>>0;
}

/** A small analytic curl field: smooth, deterministic and divergence-free by construction. */
export function createBubbleMotionModel(anchors:readonly BubbleAnchor[],seed:number):BubbleMotionModel {
  const random=seededRandom(seed);
  const waves=Array.from({length:4},()=>{
    const angle=random()*TAU;
    const spatial=TAU*(.7+random()*1.25);
    return {
      kx:Math.cos(angle)*spatial,
      ky:Math.sin(angle)*spatial,
      omega:(.075+random()*.11)*(random()>.5?1:-1),
      phase:random()*TAU,
      amplitude:(.55+random()*.35)/spatial,
    };
  });
  const bodies=anchors.map(anchor=>({
    ...anchor,
    x:anchor.x/100,
    y:anchor.y/100,
    anchorX:anchor.x/100,
    anchorY:anchor.y/100,
    vx:0,
    vy:0,
    radius:.047*anchor.scale,
    maxSpeed:.011+random()*.007,
    flowStrength:.0022+random()*.0017,
    shape:1,
    shapeVelocity:0,
    shapeFrequency:.52+random()*.48,
    shapePhase:random()*TAU,
    filmThickness:330+random()*310,
    filmPhase:random()*TAU,
    filmSpeed:.028+random()*.035,
  }));
  return {time:0,bodies,waves};
}

function curlVelocity(model:BubbleMotionModel,x:number,y:number){
  let vx=0,vy=0;
  for(const wave of model.waves){
    const cosine=Math.cos(wave.kx*x+wave.ky*y+wave.omega*model.time+wave.phase);
    vx+=wave.amplitude*wave.ky*cosine;
    vy-=wave.amplitude*wave.kx*cosine;
  }
  return {x:vx/model.waves.length,y:vy/model.waves.length};
}

/** Fixed-step, damped motion. It is a UI approximation, not a fluid or soap-film solve. */
export function stepBubbleMotion(model:BubbleMotionModel,dt:number,pinned:ReadonlySet<string>=new Set()):void {
  const step=clamp(dt,0,1/30);
  if(step===0)return;
  model.time+=step;
  const accelerations=model.bodies.map(body=>{
    const held=pinned.has(body.id),flow=curlVelocity(model,body.x,body.y);
    const spring=held ? .72 : .105,damping=held ? 5.2 : .82,flowGain=held ? 0 : body.flowStrength;
    return {
      x:(body.anchorX-body.x)*spring+flow.x*flowGain-body.vx*damping,
      y:(body.anchorY-body.y)*spring+flow.y*flowGain-body.vy*damping-.00018,
      contact:0,
    };
  });

  for(let i=0;i<model.bodies.length;i++)for(let j=i+1;j<model.bodies.length;j++){
    const a=model.bodies[i],b=model.bodies[j];
    const dx=b.x-a.x,dy=b.y-a.y,distance=Math.hypot(dx,dy)||.0001;
    const overlap=a.radius+b.radius+.008-distance;
    if(overlap<=0)continue;
    const nx=dx/distance,ny=dy/distance,force=overlap*.72;
    accelerations[i].x-=nx*force;accelerations[i].y-=ny*force;
    accelerations[j].x+=nx*force;accelerations[j].y+=ny*force;
    accelerations[i].contact=Math.max(accelerations[i].contact,overlap);
    accelerations[j].contact=Math.max(accelerations[j].contact,overlap);
  }

  model.bodies.forEach((body,index)=>{
    const acceleration=accelerations[index];
    const minX=.30+body.radius,maxX=.98-body.radius,minY=.035+body.radius,maxY=.96-body.radius;
    if(body.x<minX)acceleration.x+=(minX-body.x)*1.4;
    if(body.x>maxX)acceleration.x-=(body.x-maxX)*1.4;
    if(body.y<minY)acceleration.y+=(minY-body.y)*1.4;
    if(body.y>maxY)acceleration.y-=(body.y-maxY)*1.4;
    body.vx+=acceleration.x*step;body.vy+=acceleration.y*step;
    const speed=Math.hypot(body.vx,body.vy);
    if(speed>body.maxSpeed){const factor=body.maxSpeed/speed;body.vx*=factor;body.vy*=factor;}
    body.x+=body.vx*step;body.y+=body.vy*step;
    if(body.x<minX||body.x>maxX){body.x=clamp(body.x,minX,maxX);body.vx*=-.18;}
    if(body.y<minY||body.y>maxY){body.y=clamp(body.y,minY,maxY);body.vy*=-.18;}
    const normalizedSpeed=Math.min(1,Math.hypot(body.vx,body.vy)/body.maxSpeed);
    const mode=Math.sin(model.time*body.shapeFrequency+body.shapePhase)*.012;
    const target=1+normalizedSpeed*.035+mode+Math.min(.025,acceleration.contact*.6);
    body.shapeVelocity+=(target-body.shape)*9.5*step-body.shapeVelocity*4.1*step;
    body.shape=clamp(body.shape+body.shapeVelocity*step,.955,1.065);
  });
}

export function bubblePresentation(body:BubbleBody):BubblePresentation {
  const stretchX=Math.sqrt(body.shape),stretchY=1/stretchX;
  return {
    dx:(body.x-body.anchorX)*100,
    dy:(body.y-body.anchorY)*100,
    stretchX,
    stretchY,
    angle:Math.atan2(body.vy,body.vx)*180/Math.PI,
  };
}

/** Three-wavelength thin-film approximation for a restrained UI colour lookup. */
export function thinFilmRgb(thicknessNm:number,cosIncident:number,ior=1.33):readonly [number,number,number] {
  const cosine=clamp(cosIncident,.04,1);
  const sinTransmitted=Math.sqrt(Math.max(0,1-cosine*cosine))/ior;
  const cosTransmitted=Math.sqrt(Math.max(0,1-sinTransmitted*sinTransmitted));
  const r0=((1-ior)/(1+ior))**2;
  const fresnel=r0+(1-r0)*(1-cosine)**5;
  const channel=(wavelength:number)=>{
    const phase=4*Math.PI*ior*thicknessNm*cosTransmitted/wavelength+Math.PI;
    const interference=.5+.5*Math.cos(phase);
    return clamp(fresnel+(1-fresnel)*interference*.72,0,1);
  };
  return [channel(650),channel(510),channel(475)];
}

function filmGradient(body:BubbleBody,time:number){
  const stops=[] as string[];
  for(let index=0;index<=8;index++){
    const angle=index/8*TAU;
    const thickness=body.filmThickness+42*Math.sin(angle*2+body.filmPhase+time*body.filmSpeed)+18*Math.sin(angle*5-body.filmPhase*.7-time*.019);
    const cosIncident=.22+.74*Math.abs(Math.cos(angle-body.filmPhase*.35));
    const [r,g,b]=thinFilmRgb(thickness,cosIncident);
    stops.push(`rgba(${Math.round(r*210+25)},${Math.round(g*210+25)},${Math.round(b*210+25)},.19) ${index*12.5}%`);
  }
  return `conic-gradient(from ${body.filmPhase}rad,${stops.join(',')})`;
}

export interface RoomBubbleMotionController {
  setAnchors(anchors:readonly BubbleAnchor[]):void;
  setReduced(reduced:boolean):void;
  start():void;
  stop():void;
  dispose():void;
}

export function createRoomBubbleMotionController(root:HTMLElement,buttons:readonly HTMLButtonElement[],seed:number,reduced=false):RoomBubbleMotionController {
  const byId=new Map(buttons.map(button=>[button.dataset.place??'',button]));
  let model=createBubbleMotionModel([],seed),raf=0,last=0,accumulator=0,isRunning=false,isReduced=reduced,filmFrame=0;
  const resetPresentation=()=>buttons.forEach(button=>{
    button.style.setProperty('--bubble-motion-x','0px');button.style.setProperty('--bubble-motion-y','0px');
    button.style.setProperty('--bubble-stretch-x','1');button.style.setProperty('--bubble-stretch-y','1');button.style.setProperty('--bubble-tilt','0deg');button.style.setProperty('--bubble-copy-tilt','0deg');
  });
  const render=()=>{
    const rect=root.getBoundingClientRect(),mobile=rect.width<=760;
    for(const body of model.bodies){
      const button=byId.get(body.id);if(!button)continue;
      const pose=bubblePresentation(body),mobileFactor=mobile ? .16 : 1;
      button.style.setProperty('--bubble-motion-x',`${pose.dx/100*rect.width*mobileFactor}px`);
      button.style.setProperty('--bubble-motion-y',`${pose.dy/100*rect.height*mobileFactor}px`);
      button.style.setProperty('--bubble-stretch-x',String(pose.stretchX));button.style.setProperty('--bubble-stretch-y',String(pose.stretchY));button.style.setProperty('--bubble-tilt',`${pose.angle}deg`);button.style.setProperty('--bubble-copy-tilt',`${-pose.angle}deg`);
      if(filmFrame%8===0)button.style.setProperty('--film-gradient',filmGradient(body,model.time));
    }
    filmFrame++;
  };
  const frame=(now:number)=>{
    raf=0;if(!isRunning||isReduced||document.hidden)return;
    if(last===0)last=now;
    accumulator+=Math.min((now-last)/1000,.05);last=now;
    const pinned=new Set(buttons.filter(button=>button.matches(':hover,:focus-visible')).map(button=>button.dataset.place??''));
    let steps=0;while(accumulator>=1/60&&steps<4){stepBubbleMotion(model,1/60,pinned);accumulator-=1/60;steps++;}
    render();raf=requestAnimationFrame(frame);
  };
  const controller:RoomBubbleMotionController={
    setAnchors(anchors){model=createBubbleMotionModel(anchors,seed);last=0;accumulator=0;filmFrame=0;resetPresentation();render();},
    setReduced(value){isReduced=value;if(value){controller.stop();resetPresentation();}},
    start(){if(isRunning||isReduced)return;isRunning=true;last=0;raf=requestAnimationFrame(frame);},
    stop(){isRunning=false;if(raf)cancelAnimationFrame(raf);raf=0;last=0;accumulator=0;},
    dispose(){controller.stop();resetPresentation();},
  };
  return controller;
}
