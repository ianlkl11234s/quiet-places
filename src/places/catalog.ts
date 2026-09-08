import type {PlaceFactory} from '../player/contracts.ts';
import type {PlaceId} from './metadata.ts';
export {places,moments,isPlaceId,type PlaceId} from './metadata.ts';

// Loading the catalog creates no scene resources. Each adapter owns its assets.
export async function preparePlace(id:PlaceId):Promise<PlaceFactory>{
  if(id==='leaflight')return (await import('./leaflight/index.ts')).prepareLeaflight();
  if(id==='waterlight')return (await import('./waterlight/index.ts')).prepareWaterlight();
  if(id==='afterlight')return (await import('./afterlight/index.ts')).prepareAfterlight();
  return (await import('./oceanlight/index.ts')).prepareOceanlight();
}
