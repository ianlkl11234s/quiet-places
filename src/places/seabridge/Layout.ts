/**
 * Geometry authority for the S1 graybox. Website Y-up, metres.
 * Sea lies toward -Z (art-directed west-facing coast); +X is to the viewer's right.
 * Step, clearance and platform figures are plausible small-station values chosen
 * for the art brief, not measurements of any real station.
 */
export const STAIR={width:2.0,rise:.16,run:.30,flight1:18,flight2:17,landing:1.4,footZ:0} as const;
export const DECK={y:STAIR.rise*(STAIR.flight1+STAIR.flight2),width:2.0,topLandingDepth:2.1,crossEndZ:-20.9} as const;
// The footpath sits on a bank above the shore bench; the track and platform are
// 1.3 m lower so the platform railing stays below eye height and the sea opens up.
export const TRACK={centerZ:-16.9,gauge:1.067,bedY:-1.3} as const;
export const PLATFORM={xMin:-6,xMax:13,zNear:-18.7,zFar:-21.9,topY:TRACK.bedY+.92} as const;
export const SHORE={seaY:-2.9,wallZ:-22.3,fenceZ:-13.4} as const;

/** Derived stair profile: z decreases as the stair climbs toward the sea. */
export function stairProfile(){
 const f1Run=STAIR.flight1*STAIR.run,f2Run=STAIR.flight2*STAIR.run;
 const f1Top=STAIR.flight1*STAIR.rise;
 const f1End=STAIR.footZ-f1Run,landingEnd=f1End-STAIR.landing,f2End=landingEnd-f2Run;
 const deckStart=f2End,deckLandingEnd=deckStart-DECK.topLandingDepth;
 return {f1Run,f2Run,f1Top,f1End,landingEnd,f2End,deckStart,deckLandingEnd};
}

/** Standpoints. `user` is the default (set by the user in the camera tool, 2026-09-27); a/b stay for comparison via ?seabridgeView=a|b. */
export const VIEWS={
 // User pick: on the right verge at eye height, looking up across at the covered stair.
 user:{position:[5.96,1.37,5.46],target:[0,3.08,-5.47],fov:56.8},
 // A: close to the reference — at the stair foot, near its axis, looking up the flight.
 a:{position:[.5,1.55,5.6],target:[-.1,3.3,-8],fov:60},
 // B: observational — off to the left on the footpath, stair seen obliquely on the right, sea and low sun open on the left.
 b:{position:[-6.4,1.55,6.6],target:[1.4,2.8,-11],fov:58},
} as const;
export type SeabridgeView=keyof typeof VIEWS;

/** Weed patches (centre, ground y, spread radius, clumps, blades per clump, height m). */
/**
 * Where weeds may root: the footpath bank (y=0) ends at the retaining wall, the
 * shore bench (TRACK.bedY) only beside the ballast and, left of the platform,
 * before the coast edge. The walked line up the stair stays clear.
 */
export const grassBlocked=(x:number,z:number,y:number)=>{
 if(y===0)return z<SHORE.fenceZ+.15||(Math.abs(x)<1.25&&z>-12.4&&z<8);
 const beside=z<SHORE.fenceZ-.45&&z>TRACK.centerZ+1.6;
 const seaSide=x<PLATFORM.xMin-.5&&z<TRACK.centerZ-1.5&&z>-19.3;
 return !(beside||seaSide);
};

export const GRASS_PATCHES=[
 // Around the stair foot and along the paving edges, where weeds push through.
 {x:-2.1,z:.8,y:0,radius:1.2,clumps:44,density:30,height:.5},
 {x:2.1,z:.6,y:0,radius:1.2,clumps:44,density:30,height:.5},
 {x:-1.35,z:-3,y:0,radius:.35,clumps:12,density:22,height:.42},
 {x:1.35,z:-3.4,y:0,radius:.35,clumps:12,density:22,height:.42},
 // Foreground verges framing the bottom corners.
 {x:-3.6,z:4.6,y:0,radius:1.8,clumps:60,density:32,height:.55},
 {x:3.8,z:4.9,y:0,radius:1.8,clumps:60,density:32,height:.55},
 {x:-6,z:1.8,y:0,radius:2.6,clumps:60,density:26,height:.6},
 {x:6,z:1.6,y:0,radius:2.6,clumps:60,density:26,height:.6},
 {x:-7.5,z:6.5,y:0,radius:2.2,clumps:40,density:26,height:.55},
 // Back toward the bank edge, kept short and set back so the tips stay below the
 // bank-edge line from the footpath and never read against the sea.
 {x:-10,z:-9.8,y:0,radius:3,clumps:70,density:14,height:.35},
 {x:9,z:-9.8,y:0,radius:3,clumps:70,density:14,height:.35},
// No weeds on the lower shore bench: from the footpath its ground is hidden by
 // the bank, so the tips read as floating on the sea (user feedback 2026-09-27).
] as const;
