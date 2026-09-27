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
 a:{position:[.45,1.5,1.7],target:[-.1,3.9,-8],fov:64},
 // B: observational — off to the left on the footpath, stair seen obliquely on the right, sea and low sun open on the left.
 b:{position:[-4.6,1.55,3.4],target:[1.6,2.9,-11],fov:58},
} as const;
export type SeabridgeView=keyof typeof VIEWS;
