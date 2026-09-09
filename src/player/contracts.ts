import type * as THREE from 'three';
import type {OceanLevel} from '../places/metadata.ts';

/** Art-directed light state; intensity is relative, angle is not an ephemeris. */
export interface LightingState {
  /** Local art-directed hour, optional for legacy scene callers. */
  hour?:number;
  intensity:number;
  warmth:number;
  angle:number;
  activity:number;
}

/** Supplied by the single player clock; scenes must not start their own RAF. */
export interface SceneState extends LightingState {
  beamStrength?:number;
  rain?:number;
  heavyRain?:boolean;
  lowQuality?:boolean;
}

export interface PlaceInstance {
  position:[number,number,number]; target:[number,number,number]; yawRange:number;
  fov?:number; exposure?:number; toneMapping?:THREE.ToneMapping;
  /** Optional authored up axis and portrait framing for architectural scenes. */
  cameraUp?:[number,number,number];
  framingAspect?:number;
  hasSimulation:boolean; waterMode:string;
  setOceanLevel?(level:OceanLevel):void;
  update(dt:number,elapsed:number,state:SceneState):void;
  disturb(u:number,v:number):void;
  resetWater():void;
  dispose():void;
}

/** An unused prepared factory owns its assets until created or disposed. */
export type PlaceFactory=((scene:THREE.Scene,renderer:THREE.WebGLRenderer)=>PlaceInstance)&{dispose?():void};
