// The website keeps its public URLs. The mobile host installs a verified room's
// complete mapping before preparing any model, motion cache, texture or audio.
let roomUrls:Readonly<Record<string,string>>|undefined;
export function setRoomAssetUrls(urls:Readonly<Record<string,string>>|undefined){roomUrls=urls;}
export function resolveAssetUrl(url:string):string{
 if(!roomUrls||!url.startsWith('/')||url.startsWith('//'))return url;
 const path=url.slice(1);
 if(!path.startsWith('models/')&&!path.startsWith('textures/')&&!path.startsWith('audio/'))return url;
 const resolved=roomUrls[path];
 if(!resolved)throw new Error(`房間缺少已校驗資產：${path}`);
 return resolved;
}
