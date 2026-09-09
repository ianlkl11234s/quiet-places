/** Portable, versioned studio inputs. No implicit writes to production settings. */
export interface StudyPreset {
 schemaVersion:1; sceneId:'afterlight'; baselineRevision:string;
 assets:Record<string,string>; seed:1701; elapsed:number;
 viewport:[number,number]; camera:{position:[number,number,number];target:[number,number,number];fov:number};
 hour:number; weather:'dry'|'rain'|'heavy'; quality:'standard'|'low';
 light:{overrideSun:boolean;azimuth:number;elevation:number;intensityScale:number;exposure:number;beam:number};
 opening:{width:number;depth:number;centerZ:number};
 route:{enabled:boolean;points:[number,number,number][];speed:number;tempo:number};
 audio:{track:number;volume:number;loop:boolean;fadeSeconds:number};
}
/** The complete afterlight asset baseline; a candidate cannot select a subset. */
export const STUDY_ASSET_PATHS=[
 'models/afterlight-courtyard.glb','textures/afterlight/room-indirect.exr','models/medaka.glb','models/medaka-motion.json','models/medaka-motion.bin',
] as const;
export const defaultStudy:StudyPreset={schemaVersion:1,sceneId:'afterlight',baselineRevision:'unversioned',assets:{},seed:1701,elapsed:12,viewport:[1280,720],camera:{position:[.42500001192092896,.8174999952316284,2.25],target:[1.25,.72,-.6],fov:53.1301017798049},hour:12,weather:'dry',quality:'standard',light:{overrideSun:false,azimuth:0,elevation:80,intensityScale:1,exposure:1.25,beam:1},opening:{width:1.5,depth:1.1,centerZ:-.38},route:{enabled:false,points:[[.3,.22,0],[1,.28,-.8],[.8,.24,-1.5],[.2,.3,-.6]],speed:.06,tempo:1},audio:{track:0,volume:.5,loop:true,fadeSeconds:0}};
export function validateStudy(input:unknown):StudyPreset {
 const p=input as StudyPreset;
 if(!p||p.schemaVersion!==1||p.sceneId!=='afterlight')throw new Error('不支援的 preset 版本或場景。');
 const finite=(v:unknown,min:number,max:number,label:string)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error(`${label} 必須在 ${min}–${max} 範圍。`);};
 const vector=(v:unknown,label:string)=>{if(!Array.isArray(v)||v.length!==3)throw new Error(`${label} 需三個座標。`);v.forEach(n=>finite(n,-100,100,label));};
 if(typeof p.baselineRevision!=='string'||!p.baselineRevision.length||!p.assets||typeof p.assets!=='object'||Array.isArray(p.assets)||Object.values(p.assets).some(v=>typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v)))throw new Error('缺少有效的基準／資產版本。');
 if(p.seed!==1701)throw new Error('目前 pilot 僅支援固定 seed 1701；群游 cache 使用自身版本。');
 finite(p.elapsed,0,3600,'時間');finite(p.hour,0,24,'時刻');
 if(!Array.isArray(p.viewport)||p.viewport.length!==2)throw new Error('缺少 viewport。');p.viewport.forEach(n=>finite(n,200,2560,'viewport'));
 if(!p.camera)throw new Error('缺少 camera。');vector(p.camera.position,'camera position');vector(p.camera.target,'camera target');finite(p.camera.fov,20,100,'FOV');
 if(!['dry','rain','heavy'].includes(p.weather)||!['standard','low'].includes(p.quality))throw new Error('未知天氣或品質。');
 if(!p.light||typeof p.light.overrideSun!=='boolean')throw new Error('缺少光參數。');
 finite(p.light.azimuth,-180,180,'方位');finite(p.light.elevation,10,90,'高度');finite(p.light.intensityScale,0,2,'主光倍率');finite(p.light.exposure,.1,3,'曝光');finite(p.light.beam,0,2.5,'散射');
 if(!p.opening)throw new Error('缺少開口。');finite(p.opening.width,.3,2,'開口沿牆寬');finite(p.opening.depth,.3,1.5,'開口深度');finite(p.opening.centerZ,-2,1,'開口中心');
 if(!p.route||typeof p.route.enabled!=='boolean'||!Array.isArray(p.route.points)||p.route.points.length<3||p.route.points.length>12)throw new Error('路徑需要 3–12 個控制點。');
 p.route.points.forEach(v=>{vector(v,'路徑');finite(v[0],-1.8,1.6,'路徑 x');finite(v[1],.06,1,'路徑 y');finite(v[2],-3,1,'路徑 z');});finite(p.route.speed,.01,.3,'路徑 m/s');finite(p.route.tempo,.25,2,'節奏倍率');
 if(!p.audio||typeof p.audio.loop!=='boolean')throw new Error('缺少聲音設定。');finite(p.audio.track,0,7,'曲目');if(!Number.isInteger(p.audio.track))throw new Error('曲目需整數。');finite(p.audio.volume,0,1,'音量');finite(p.audio.fadeSeconds,0,5,'淡入秒數');
 return structuredClone(p);
}
export const sameOpening=(a:StudyPreset,b:StudyPreset)=>(['width','depth','centerZ'] as const).every(key=>Math.abs(a.opening[key]-b.opening[key])<1e-9);
export function validateStudyAssets(p:StudyPreset,current:Record<string,string>){
 if(Object.keys(current).length===0||JSON.stringify(Object.entries(p.assets).sort())!==JSON.stringify(Object.entries(current).sort()))throw new Error('資產版本不同，需重新建立候選基準。');
}
