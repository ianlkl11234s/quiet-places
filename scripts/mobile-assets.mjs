import {copyFileSync,existsSync,mkdirSync,readFileSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {dirname,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const defaultRoot=fileURLToPath(new URL('../',import.meta.url));
const argument=(name)=>{const at=process.argv.indexOf(name);return at<0?undefined:process.argv[at+1];};
const root=resolve(argument('--root')??defaultRoot);
const output=resolve(root,argument('--output')??'.mobile-public');
const downloadOutput=resolve(root,argument('--download-output')??'.mobile-downloads');
const configPath=resolve(root,'assets/config/mobile-assets.json');
const publicRoot=resolve(root,'public');
const sha256=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const inside=(parent,path)=>path===parent||path.startsWith(parent+sep);
const sourcePath=(asset)=>{
  if(typeof asset!=='string'||!asset||asset.startsWith('/')||asset.includes('..')||asset.includes('\\'))throw new Error(`非法 public 資產路徑：${String(asset)}`);
  const path=resolve(publicRoot,asset);
  if(!inside(publicRoot,path))throw new Error(`資產越出 public：${asset}`);
  return path;
};
function glbHasExternalUris(path){
  const bytes=readFileSync(path);
  if(bytes.length<20||bytes.toString('utf8',0,4)!=='glTF')throw new Error(`不是 GLB：${relative(root,path)}`);
  const jsonLength=bytes.readUInt32LE(12),jsonType=bytes.readUInt32LE(16);
  if(jsonType!==0x4e4f534a||20+jsonLength>bytes.length)throw new Error(`GLB JSON chunk 無效：${relative(root,path)}`);
  const json=JSON.parse(bytes.toString('utf8',20,20+jsonLength).trim());
  return [...(json.buffers??[]),...(json.images??[])].some(item=>typeof item.uri==='string'&&item.uri.length>0);
}
function revision(){try{return execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();}catch{return 'unavailable';}}
function fileRecord(path,rootPath){
  const source=sourcePath(path),destination=resolve(rootPath,path);
  mkdirSync(dirname(destination),{recursive:true});copyFileSync(source,destination);
  return {path,bytes:statSync(destination).size,sha256:sha256(destination)};
}
export function assetVersionFor(files,sharedFiles){return `sha256-${createHash('sha256').update(JSON.stringify({files,sharedFiles})).digest('hex').slice(0,16)}`;}
function prepareRoot(path,name){
  if(path===root||!inside(root,path)||path!==resolve(root,name))throw new Error(`輸出只能是 repo 內的 ${name}。`);
  rmSync(path,{recursive:true,force:true});mkdirSync(path,{recursive:true});
}
function main(){
  const config=JSON.parse(readFileSync(configPath,'utf8'));
  if(config.schemaVersion!==1||config.licenseStatus!=='unverified; see docs/production/IPHONE_ASSETS.md'||config.pilot?.sceneId!=='seaward'||config.pilot?.status!=='bundled-for-iphone-pilot-only')throw new Error('mobile asset config 的 pilot 契約無效。');
  const inventory=config.inventory;
  if(!inventory||typeof inventory!=='object'||Object.keys(inventory).length!==8)throw new Error('inventory 必須列出正式八景。');
  const allInventory=new Set(Object.values(inventory).flat());
  for(const asset of allInventory)if(!existsSync(sourcePath(asset)))throw new Error(`inventory 檔案不存在：${asset}`);
  for(const asset of allInventory)if(asset.endsWith('.glb')&&glbHasExternalUris(sourcePath(asset)))throw new Error(`拒絕含外部 URI 的 GLB：${asset}`);
  const selected=[...new Set([...config.pilot.runtimeAssets,...config.sharedAudio])];
  if(selected.some(asset=>!allInventory.has(asset)&&!config.sharedAudio.includes(asset)))throw new Error('pilot 資產必須有 inventory 或 sharedAudio 來源。');
  for(const asset of selected){
    const source=sourcePath(asset);
    if(!existsSync(source))throw new Error(`pilot 檔案不存在：${asset}`);
    if(asset.endsWith('.glb')&&glbHasExternalUris(source))throw new Error(`拒絕含外部 URI 的 GLB：${asset}`);
  }
  prepareRoot(output,'.mobile-public');
  prepareRoot(downloadOutput,'.mobile-downloads');
  const files=selected.map(asset=>fileRecord(asset,output));
  const manifest={schemaVersion:1,kind:'quiet-places-mobile-public',sourceRevision:revision(),pilot:{...config.pilot,files:config.pilot.runtimeAssets},sharedAudio:config.sharedAudio,inventory,provenance:config.provenance,files};
  writeFileSync(resolve(output,'mobile-assets.manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  const downloadable=[...new Set([...allInventory,...config.sharedAudio])].sort();
  const downloadableFiles=downloadable.map(asset=>fileRecord(asset,downloadOutput));
  const recordsByPath=new Map(downloadableFiles.map(file=>[file.path,file]));
  const sharedFiles=config.sharedAudio.map(asset=>recordsByPath.get(asset));
  const rooms=Object.entries(inventory).map(([roomId,assets])=>{
    const roomFiles=assets.map(asset=>recordsByPath.get(asset));
    const sharedAssets=[...config.sharedAudio];
    const totalBytes=[...roomFiles,...sharedFiles].reduce((sum,file)=>sum+file.bytes,0);
    return {schemaVersion:1,roomId,assetVersion:assetVersionFor(roomFiles,sharedFiles),appSchemaVersion:1,totalBytes,files:roomFiles,sharedAssets,provenance:config.provenance[roomId],licenseStatus:config.licenseStatus};
  });
  const roomManifests={schemaVersion:1,kind:'quiet-places-room-manifests',appSchemaVersion:1,sourceRevision:revision(),sharedFiles,rooms};
  const serializedRoomManifests=JSON.stringify(roomManifests,null,2)+'\n';
  writeFileSync(resolve(output,'room-manifests.json'),serializedRoomManifests);
  writeFileSync(resolve(downloadOutput,'room-manifests.json'),serializedRoomManifests);
  const downloadManifest={schemaVersion:1,kind:'quiet-places-mobile-download-payload',sourceRevision:revision(),files:downloadableFiles};
  writeFileSync(resolve(downloadOutput,'mobile-assets.manifest.json'),JSON.stringify(downloadManifest,null,2)+'\n');
  const total=files.reduce((sum,file)=>sum+file.bytes,0);
  console.log(`mobile assets prepared: ${files.length} bundled files, ${total} bytes at ${relative(root,output)}; ${downloadableFiles.length} downloadable files at ${relative(root,downloadOutput)}`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
