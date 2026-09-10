export type PlaceId = 'waterlight' | 'leaflight' | 'oceanlight' | 'afterlight' | 'seaward' | 'stairlight' | 'snowwindow';

export type PlaceCapability = 'weather' | 'ocean-level' | 'water-interaction' | 'camera-distance';
export type WeatherProfile = 'water' | 'afterlight' | 'seaward';

export interface PlaceMetadata {
  id: PlaceId;
  name: string;
  subtitle: string;
  capabilities: readonly PlaceCapability[];
  cameraHint: string;
  cameraAriaLabel: string;
  weatherProfile?: WeatherProfile;
}

export const places = [
  {id:'waterlight',name:'水光之間',subtitle:'水面與天光',capabilities:['weather','water-interaction'],weatherProfile:'water',cameraHint:'輕點天窗產生漣漪。拖曳環繞，靠近牆面時停止。',cameraAriaLabel:'拖曳環繞天窗，靠近牆面時停止；方向鍵旋轉，Home重設'},
  {id:'leaflight',name:'樹影午後',subtitle:'微風穿過枝葉',capabilities:[],cameraHint:'微風帶動枝葉與光影。拖曳微調視角，左右各 15°。',cameraAriaLabel:'拖曳觀看窗景，左右各15度；方向鍵旋轉，Home重設'},
  {id:'oceanlight',name:'海光之室',subtitle:'緩慢起伏的海',capabilities:['ocean-level'],cameraHint:'窗外海面三種水位。拖曳微調視角，左右各 15°。',cameraAriaLabel:'拖曳觀看窗景，左右各15度；方向鍵旋轉，Home重設'},
  {id:'afterlight',name:'雨後天井',subtitle:'雨後的光與新葉',capabilities:['weather','camera-distance'],weatherProfile:'afterlight',cameraHint:'青鱂在植物與陰影間聚散。拖曳微調視角，左右各 6°。',cameraAriaLabel:'拖曳觀看雨後天井，左右各6度；滾輪拉近拉遠，方向鍵旋轉，Home重設'},
  {id:'seaward',name:'向海的隧道',subtitle:'海風與一隻魟魚',capabilities:[],cameraHint:'魟魚緩緩穿過明暗交界。拖曳微調視角。',cameraAriaLabel:'拖曳觀看海邊隧道；方向鍵旋轉，Home重設'},
  {id:'stairlight',name:'階光之間',subtitle:'窗光與紅繩',capabilities:[],cameraHint:'窗光隨時刻變化，紅繩隨風輕擺。拖曳微調視角，左右各 15°。',cameraAriaLabel:'拖曳觀看窗景，左右各15度；方向鍵旋轉，Home重設'},
  {id:'snowwindow',name:'雪落海窗',subtitle:'海雪與白色亞麻',capabilities:[],cameraHint:'窗邊可左右微轉共約 15°；雪與亞麻隨時間緩慢變化。',cameraAriaLabel:'雪落海窗左右拖曳或方向鍵微轉；Home重設'},
] as const satisfies readonly PlaceMetadata[];
export const isPlaceId=(value:unknown):value is PlaceId=>places.some(place=>place.id===value);
export const getPlaceMetadata=(id:PlaceId):PlaceMetadata=>places.find(place=>place.id===id)!;
export const placeSupports=(id:PlaceId,capability:PlaceCapability):boolean=>getPlaceMetadata(id).capabilities.includes(capability);
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
