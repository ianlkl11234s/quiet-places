import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,renameSync,writeFileSync,existsSync,statSync} from 'node:fs';
import {dirname,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {STUDY_ASSET_PATHS,sameOpening,validateStudy,validateStudyAssets} from '../src/shared/production/StudyPreset.ts';

const DEFAULT_ROOT=fileURLToPath(new URL('../',import.meta.url));
const STUDY_PATH='assets/config/afterlight-study.json';
const GEOMETRY_PATH='assets/config/afterlight-geometry.json';
const INSTALL_PATH='assets/config/afterlight-study.install.json';

function usage(message){
 if(message)console.error(`study: ${message}`);
 console.error('Usage: node --experimental-strip-types scripts/study.mjs validate|stage|apply|rollback --input PATH [--output-dir PATH] [--root PATH] [--reason TEXT]');
 process.exitCode=2;
}

function parse(argv){
 const [command,...rest]=argv;
 const options={};
 for(let index=0;index<rest.length;index+=1){
  const key=rest[index];
  if(!key.startsWith('--'))throw new Error(`未知參數：${key}`);
  const value=rest[index+1];
  if(value===undefined||value.startsWith('--'))throw new Error(`${key} 需要值。`);
  options[key.slice(2)]=value;index+=1;
 }
 if(!['validate','stage','apply','rollback'].includes(command))throw new Error('請指定 validate、stage、apply 或 rollback。');
 if(!options.input)throw new Error('需要 --input。');
 return {command,options};
}

const sha256=value=>createHash('sha256').update(value).digest('hex');
const bytes=file=>readFileSync(file);
const json=file=>JSON.parse(bytes(file).toString('utf8'));
const jsonBytes=value=>Buffer.from(`${JSON.stringify(value,null,2)}\n`);
const hashJson=value=>sha256(JSON.stringify(value));
const safeJsonName=value=>String(value).replace(/[^a-z0-9.-]+/gi,'-');

function rootPath(root,path){return resolve(root,path);}
function safePublicPath(root,path){
 if(typeof path!=='string'||path.startsWith('/')||path.split('/').includes('..'))throw new Error(`不安全的 public 資產路徑：${String(path)}`);
 const publicRoot=resolve(root,'public');
 const absolute=resolve(publicRoot,path);
 if(!absolute.startsWith(`${publicRoot}${sep}`))throw new Error(`不安全的 public 資產路徑：${path}`);
 return absolute;
}

function currentAssets(root){
 const assets={};
 for(const path of STUDY_ASSET_PATHS)assets[path]=sha256(bytes(safePublicPath(root,path)));
 return assets;
}

function requireKnownBaseline(preset){
 if(/^(unknown|unversioned|none|null)$/i.test(preset.baselineRevision.trim()))throw new Error('baselineRevision 不可為 unknown 或 unversioned。');
}

function geometryForPreset(geometry,preset){
 const next=structuredClone(geometry);
 const opening=next?.primaryOpening;
 if(!opening||!Number.isFinite(opening.minX)||!Number.isFinite(opening.maxX))throw new Error('afterlight geometry 缺少 primaryOpening。');
 next.primaryOpening={...opening,
  // The wall-side edge is the authored anchor; only grow the room-facing edge.
  minX:opening.maxX-preset.opening.depth,maxX:opening.maxX,
  minZ:preset.opening.centerZ-preset.opening.width/2,maxZ:preset.opening.centerZ+preset.opening.width/2,
 };
 return next;
}

function presetWithGeometryOpening(preset,geometry){
 const opening=geometry?.primaryOpening;
 if(!opening||![opening.minX,opening.maxX,opening.minZ,opening.maxZ].every(Number.isFinite))throw new Error('afterlight geometry 缺少有效的 primaryOpening。');
 return {...preset,opening:{width:opening.maxZ-opening.minZ,depth:opening.maxX-opening.minX,centerZ:(opening.minZ+opening.maxZ)/2}};
}

function extractInput(file){
 const value=json(file);
 if(value&&typeof value==='object'&&'candidate' in value){
  const record=value;
  if(typeof record.decision!=='string'||typeof record.reason!=='string')throw new Error('experiment 需要 decision 與 reason。');
  return {preset:validateStudy(record.candidate),experiment:{decision:record.decision,reason:record.reason.trim()}};
 }
 return {preset:validateStudy(value),experiment:undefined};
}

function validatePreset(root,preset){
 requireKnownBaseline(preset);
 const formal=validateStudy(json(rootPath(root,STUDY_PATH)));
 requireKnownBaseline(formal);
 if(preset.baselineRevision!==formal.baselineRevision)throw new Error('preset baselineRevision 與目前正式 study 不符。');
 validateStudyAssets(preset,currentAssets(root));
}

function writeAtomic(file,data){
 mkdirSync(dirname(file),{recursive:true});
 const temporary=`${file}.tmp-${process.pid}-${Date.now()}`;
 writeFileSync(temporary,data,{flag:'wx'});
 renameSync(temporary,file);
}

function writeImmutable(file,data){
 if(existsSync(file))throw new Error(`不可覆寫既有候選：${file}`);
 writeAtomic(file,data);
}

function preservePrevious(file,data){
 if(existsSync(file)){
  if(sha256(bytes(file))!==sha256(data))throw new Error(`既有前版內容與 hash 名稱不符：${file}`);
  return;
 }
 writeImmutable(file,data);
}

function stage(root,input,outputDir){
 if(!outputDir)throw new Error('stage 需要 --output-dir。');
 const {preset,experiment}=extractInput(input);validatePreset(root,preset);
 const geometry=json(rootPath(root,GEOMETRY_PATH));
 const override=geometryForPreset(geometry,preset);
 const presetBytes=jsonBytes(preset),overrideBytes=jsonBytes(override);
 const candidateHash=sha256(presetBytes),stageDir=resolve(outputDir,`afterlight-study-${candidateHash.slice(0,12)}`);
 const geometryChanged=!sameOpening(preset,presetWithGeometryOpening(preset,geometry));
 const receipt={schemaVersion:1,kind:'afterlight-study-stage',candidateSha256:candidateHash,presetSha256:candidateHash,
  geometrySha256:sha256(overrideBytes),officialGeometrySha256:sha256(jsonBytes(geometry)),geometryChanged,
  baselineRevision:preset.baselineRevision,assets:preset.assets,
  runtimeConfigFields:['light.overrideSun','light.azimuth','light.elevation','light.intensityScale','light.exposure','light.beam','route','audio.track','audio.loop','audio.fadeSeconds'],
  previewSnapshotFields:['audio.volume','camera','hour','weather','quality','viewport','elapsed','seed'],experiment:experiment??null};
 mkdirSync(stageDir,{recursive:true});
 writeImmutable(join(stageDir,'preset.json'),presetBytes);
 writeImmutable(join(stageDir,'geometry.override.json'),overrideBytes);
 writeImmutable(join(stageDir,'receipt.json'),jsonBytes(receipt));
 const experimentText=`# Afterlight study candidate\n\n- 狀態：${experiment?.decision==='accepted'?'採用候選待正式套用':'提案'}。\n- 基準：${preset.baselineRevision}\n- 候選 preset SHA-256：${candidateHash}\n- 幾何變更：${geometryChanged?'是；需 recipe 與 bake，CLI 會拒絕 apply。':'否'}\n- 理由：${experiment?.reason||'尚未提供；不可直接採用。'}\n\n## 重現\n\n\`node --experimental-strip-types scripts/study.mjs apply --input ${relative(root,join(stageDir,'receipt.json'))} --root ${root}\`\n`;
 writeImmutable(join(stageDir,'experiment.md'),Buffer.from(experimentText));
 return {stageDir,receipt};
}

function receiptFrom(input){
 const receiptFile=existsSync(input)&&statSync(input).isFile()?input:join(input,'receipt.json');
 const receipt=json(receiptFile);
 if(!receipt||receipt.kind!=='afterlight-study-stage'||receipt.schemaVersion!==1)throw new Error('apply 需要有效的 stage receipt。');
 return {receipt,stageDir:dirname(receiptFile)};
}

function verifiedStage(root,input){
 const {receipt,stageDir}=receiptFrom(input);
 const preset=json(join(stageDir,'preset.json')),override=json(join(stageDir,'geometry.override.json'));
 const validated=validateStudy(preset);validatePreset(root,validated);
 if(sha256(jsonBytes(validated))!==receipt.candidateSha256||sha256(jsonBytes(override))!==receipt.geometrySha256)throw new Error('stage 檔案 hash 不符。');
 if(receipt.baselineRevision!==validated.baselineRevision||JSON.stringify(receipt.assets)!==JSON.stringify(validated.assets))throw new Error('stage receipt 與 preset 版本不符。');
 return {receipt,stageDir,preset:validated,override};
}

function apply(root,input,reason){
 const {receipt,stageDir,preset,override}=verifiedStage(root,input);
 const accepted=receipt.experiment?.decision==='accepted'&&typeof receipt.experiment.reason==='string'&&receipt.experiment.reason.trim().length>0;
 if(!accepted&&!reason?.trim())throw new Error('apply 需要 --reason，或輸入 decision 為 accepted 且有 reason 的 experiment。');
 const official=json(rootPath(root,GEOMETRY_PATH));
 if(receipt.geometryChanged||sha256(jsonBytes(official))!==receipt.officialGeometrySha256)throw new Error('開口幾何已變更；請先執行 geometry recipe 與 bake，CLI 不會套用。');
 const target=rootPath(root,STUDY_PATH),next=jsonBytes(preset),installedSha=sha256(next);
 const previous=existsSync(target)?bytes(target):undefined,previousSha=previous?sha256(previous):null;
 if(previous)preservePrevious(rootPath(root,`assets/config/afterlight-study.previous-${safeJsonName(previousSha)}.json`),previous);
 writeAtomic(target,next);
 const install={schemaVersion:1,kind:'afterlight-study-install',installedSha,previousSha,previousFile:previousSha?`afterlight-study.previous-${safeJsonName(previousSha)}.json`:null,stageReceiptSha256:sha256(bytes(join(stageDir,'receipt.json'))),reason:accepted?receipt.experiment.reason:reason.trim(),rolledBack:false};
 writeAtomic(rootPath(root,INSTALL_PATH),jsonBytes(install));
 return {installedSha,previousSha};
}

function rollback(root,input){
 const install=json(rootPath(root,INSTALL_PATH));
 if(!install||install.kind!=='afterlight-study-install'||install.rolledBack)throw new Error('沒有可回退的本次 install。');
 const target=rootPath(root,STUDY_PATH);
 if(!existsSync(target)||sha256(bytes(target))!==install.installedSha)throw new Error('正式設定不是本次 installed hash；拒絕覆寫。');
 if(!install.previousSha||!install.previousFile)throw new Error('本次 install 沒有可回退的前版。');
 const previous=rootPath(root,join('assets/config',install.previousFile));
 if(!existsSync(previous)||sha256(bytes(previous))!==install.previousSha)throw new Error('保存的前版不存在或 hash 不符。');
 writeAtomic(target,bytes(previous));
 install.rolledBack=true;install.rolledBackSha256=install.previousSha;
 writeAtomic(rootPath(root,INSTALL_PATH),jsonBytes(install));
 return {rolledBackTo:install.previousSha};
}

try {
 const {command,options}=parse(process.argv.slice(2));
 const root=resolve(options.root??DEFAULT_ROOT),input=resolve(options.input);
 let result;
 if(command==='validate'){const {preset}=extractInput(input);validatePreset(root,preset);result={valid:true,baselineRevision:preset.baselineRevision};}
 if(command==='stage')result=stage(root,input,resolve(options['output-dir']??'.'));
 if(command==='apply')result=apply(root,input,options.reason);
 if(command==='rollback')result=rollback(root,input);
 console.log(JSON.stringify(result));
} catch(error) {
 console.error(`study: ${error instanceof Error?error.message:String(error)}`);
 process.exitCode=1;
}
