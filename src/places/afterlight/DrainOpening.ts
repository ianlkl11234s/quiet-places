// Metres, Three Y-up. Editable mesh counterpart: update_afterlight_drain.py.
export const drainOpening={minX:.60,maxX:1.70,minZ:-1.40,maxZ:-.10,roofY:3,frame:.04,slatWidth:.022,braceWidth:.018};
export const drainSlats=Array.from({length:9},(_,i)=>.64+(i+1)*1.02/10);
export const drainBraces=Array.from({length:2},(_,i)=>-1.36+(i+1)*1.22/3);
export const corridor={minX:-2.0,maxX:1.8,centerX:-.1};
export const oppositeDrainOpening={...drainOpening,minX:2*corridor.centerX-drainOpening.maxX,maxX:2*corridor.centerX-drainOpening.minX};
export function drainIsOpen(x:number,z:number){
 if(x<corridor.centerX)x=2*corridor.centerX-x;
 return x>.64&&x<1.66&&z>-1.36&&z<-.14&&drainSlats.every(v=>Math.abs(x-v)>.011)&&drainBraces.every(v=>Math.abs(z-v)>.009);
}
// Sample an actual open cell, rather than making rain emerge through metal.
export function drainRainOrigin(u:number,v:number){
 const column=Math.min(9,Math.floor(u*10)),row=Math.min(2,Math.floor(v*3));
 const x0=column===0?.64:drainSlats[column-1]+.011,x1=column===9?1.66:drainSlats[column]-.011;
 const z0=row===0?-1.36:drainBraces[row-1]+.009,z1=row===2?-.14:drainBraces[row]-.009;
 return {x:x0+.005+(x1-x0-.01)*(u*10-column),z:z0+.005+(z1-z0-.01)*(v*3-row)};
}
