/** The existing 32-bit LCG. Keep constants and unsigned seed conversion stable. */
export function seededRandom(seed:number):()=>number {
  let value=seed>>>0;
  return ()=>{
    value=(Math.imul(value,1664525)+1013904223)>>>0;
    return value/4294967296;
  };
}
