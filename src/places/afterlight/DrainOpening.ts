// Metres, Three Y-up. Editable mesh counterpart: update_afterlight_drain.py.
export const drainOpening={minX:.85,maxX:1.70,minZ:-1.175,maxZ:-.325,roofY:3,frame:.04,slatWidth:.022,braceWidth:.018};
export const drainSlats=Array.from({length:9},(_,i)=>.89+(i+1)*.77/10);
export const drainBraces=Array.from({length:2},(_,i)=>-1.135+(i+1)*.77/3);
export const corridor={minX:-1.9,maxX:1.8,centerX:-.05};
export const oppositeDrainOpening={...drainOpening,minX:2*corridor.centerX-drainOpening.maxX,maxX:2*corridor.centerX-drainOpening.minX};
export function drainIsOpen(x:number,z:number){
 if(x<corridor.centerX)x=2*corridor.centerX-x;
 return x>.89&&x<1.66&&z>-1.135&&z<-.365&&drainSlats.every(v=>Math.abs(x-v)>.011)&&drainBraces.every(v=>Math.abs(z-v)>.009);
}
// Sample an actual open cell, rather than making rain emerge through metal.
export function drainRainOrigin(u:number,v:number){
 const column=Math.min(9,Math.floor(u*10)),row=Math.min(2,Math.floor(v*3));
 const x0=column===0?.89:drainSlats[column-1]+.011,x1=column===9?1.66:drainSlats[column]-.011;
 const z0=row===0?-1.135:drainBraces[row-1]+.009,z1=row===2?-.365:drainBraces[row]-.009;
 return {x:x0+.005+(x1-x0-.01)*(u*10-column),z:z0+.005+(z1-z0-.01)*(v*3-row)};
}
