/**
 * Geometry authority for the crossing S1 graybox (ferry stern deck). Website Y-up, metres.
 * Bow is +Z, stern -Z, open side +X. Numbers are plausible values estimated from photos, not measurements.
 */
export const DECK={xMin:-2.2,xMax:2.4,zMin:-3.0,zMax:5.0,y:0} as const;
/** Pocket behind the cabin bulkhead: x 0..xMax, z zMin..pocketFrontZ. Forward of it the deck widens to xMin. */
export const POCKET={xMin:0,pocketFrontZ:-.5} as const;
export const RAIL={h:1.0,t:.1} as const;
export const ROOF={underY:2.25,t:.1,margin:.1,beamH:.16} as const;
export const SEA_Y=-6;
export const POST_Z=[-3.0,-1.4,.2,1.8,3.4,5.0] as const;
/** Stair opening (hole in the deck) with a white pipe handrail around it. */
export const STAIR={xMin:-2.2,xMax:-.6,zMin:.9,zMax:3.1} as const;
export const DOOR={z:-1.7,w:.9,h:2.0} as const;
/** Chairs: a row of 4 along the open-side wall facing -X, rows of 3 facing the stern. */
export const CHAIRS={wallRowZ:[-2.7,-2.1,-1.5,-.9],wallRowX:2.05,sternRowsZ:[.6,1.45,2.3],sternRowsX:[.5,1.1,1.7],width:.55,seatH:.45} as const;
export const LAMP={x:1.2,y:2.2,z:-1.2,len:1.2} as const;

/** Standpoints; a is the default. A~3393 (seated, open side + stern corner), B~3400 (standing wide, door left, glitter right), C~3395 (square to the stern, wake). */
export const VIEWS={
 a:{position:[-.4,1.15,.34],target:[2.2,1.40,-.95],fov:62},
 b:{position:[.5,1.55,3.3],target:[1.2,1.0,-3.0],fov:75},
 c:{position:[1.0,1.55,-.1],target:[1.2,1.5,-3.5],fov:70},
} as const;
export type CrossingView=keyof typeof VIEWS;
export const inDeck=(x:number,z:number)=>x>=DECK.xMin&&x<=DECK.xMax&&z>=DECK.zMin&&z<=DECK.zMax&&!(x<POCKET.xMin&&z<POCKET.pocketFrontZ);
export const inStairHole=(x:number,z:number)=>x>STAIR.xMin&&x<STAIR.xMax&&z>STAIR.zMin&&z<STAIR.zMax;
