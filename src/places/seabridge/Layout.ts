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

/** Two standpoint candidates for S1; chosen with ?seabridgeView=a|b. */
export const VIEWS={
 // A: close to the reference — at the stair foot, near its axis, looking up the flight.
 a:{position:[.5,1.55,5.6],target:[-.1,3.3,-8],fov:60},
 // B: observational — off to the left on the footpath, stair seen obliquely on the right, sea and low sun open on the left.
 b:{position:[-6.4,1.55,6.6],target:[1.4,2.8,-11],fov:58},
} as const;
export type SeabridgeView=keyof typeof VIEWS;

/** Weed patches (centre, ground y, spread radius, clumps, blades per clump, height m). */
/** The walked line from the footpath up the stair stays clear of weeds. */
export const grassKeepOut=(x:number,z:number)=>Math.abs(x)<1.25&&z>-12.4&&z<8;

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
 // The bank edge above the retaining wall.
 {x:-10,z:-12.6,y:0,radius:5.5,clumps:80,density:14,height:.7},
 {x:9,z:-12.6,y:0,radius:5.5,clumps:80,density:14,height:.7},
 // Shore bench left of the platform.
 {x:-14,z:-17.5,y:TRACK.bedY,radius:6,clumps:60,density:10,height:.7},
] as const;
