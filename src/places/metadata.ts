export type PlaceId = 'waterlight' | 'leaflight' | 'oceanlight';
export const places = [
  {id:'waterlight',name:'水光之間',subtitle:'水面與天光'},
  {id:'leaflight',name:'樹影午後',subtitle:'微風穿過枝葉'},
  {id:'oceanlight',name:'海光之室',subtitle:'緩慢起伏的海'},
] as const;
export const isPlaceId=(value:unknown):value is PlaceId=>places.some(place=>place.id===value);
export const moments=[
  {id:'noon',name:'正午',hour:12},
  {id:'sunset',name:'黃昏',hour:17.5},
  {id:'twilight',name:'暮光',hour:19},
  {id:'moonlight',name:'月光',hour:23},
] as const;
