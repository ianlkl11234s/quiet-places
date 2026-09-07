export type PlaceId = 'waterlight' | 'leaflight' | 'oceanlight' | 'afterlight';
export const places = [
  {id:'waterlight',name:'水光之間',subtitle:'水面與天光'},
  {id:'leaflight',name:'樹影午後',subtitle:'微風穿過枝葉'},
  {id:'oceanlight',name:'海光之室',subtitle:'緩慢起伏的海'},
  {id:'afterlight',name:'雨後天井',subtitle:'雨後的光與新葉'},
] as const;
export const isPlaceId=(value:unknown):value is PlaceId=>places.some(place=>place.id===value);
export const moments=[
  {id:'dawn',name:'晨曦',hour:6.5},
  {id:'noon',name:'正午',hour:12},
  {id:'sunset',name:'暮色',hour:17.5},
  {id:'moonlight',name:'月夜',hour:23},
] as const;

export const oceanLevels = [
  {id:'below',name:'窗下'},
  {id:'half',name:'半窗'},
  {id:'submerged',name:'全淹'},
] as const;
export type OceanLevel = typeof oceanLevels[number]['id'];
export const isOceanLevel=(value:unknown):value is OceanLevel=>oceanLevels.some(level=>level.id===value);
