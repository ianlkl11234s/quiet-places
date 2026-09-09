import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const required=[
  'AGENTS.md','docs/production/README.md','docs/production/CAPABILITIES.md',
  'docs/production/PREFERENCES.md','docs/production/ROADMAP.md',
  'docs/production/templates/scene.md','docs/production/templates/experiment.md',
  'docs/prompts/quiet-places-master.txt','skills/quiet-places-production/SKILL.md',
  'docs/MATERIALS_AND_LIGHTING.md','docs/biology/README.md',
];
const metadata=readFileSync(resolve(root,'src/places/metadata.ts'),'utf8');
const block=metadata.split('export const places = [')[1]?.split('] as const')[0];
const ids=[...(block??'').matchAll(/id:\s*'([^']+)'/g)].map(match=>match[1]);
const errors=[];
if (!ids.length) errors.push('無法讀取正式 places 清單；metadata 格式改變時請同步檢查器。');
if (new Set(ids).size!==ids.length) errors.push('場景 ID 重複');
for (const id of ids) required.push(`docs/scenes/${id}.md`,`src/places/${id}/index.ts`);
for (const path of required) {
  if (!existsSync(resolve(root,path))) errors.push(`缺少 ${path}`);
}
for (const error of errors) console.error(error);
if (errors.length) process.exitCode=1;
else console.log(`製作入口通過：${ids.join(', ')}；${required.length} 個必要路徑。未驗證內容、資產或畫面。`);

// Contract checks are intentionally separate from visual acceptance.
const {createHash}=await import('node:crypto');
const {validateStudy,validateStudyAssets}=await import('../src/shared/production/StudyPreset.ts');
const {createDrainGeometry}=await import('../src/shared/geometry/DrainGeometry.ts');
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
try{
 const recipeRegistry=JSON.parse(readFileSync(resolve(root,'assets/config/asset-recipes.json'),'utf8'));
 if(recipeRegistry.schemaVersion!==1)throw new Error('未知 recipe schema');
 for(const recipe of recipeRegistry.recipes){for(const input of recipe.inputs){if(!existsSync(resolve(root,input)))throw new Error(`recipe ${recipe.id} 缺少 ${input}`);}}
 const study=validateStudy(JSON.parse(readFileSync(resolve(root,'assets/config/afterlight-study.json'),'utf8')));
 const current=Object.fromEntries(Object.keys(study.assets).map(path=>[path,hash(resolve(root,'public',path))]));validateStudyAssets(study,current);
 createDrainGeometry(JSON.parse(readFileSync(resolve(root,'assets/config/afterlight-geometry.json'),'utf8')));
 const version=JSON.parse(readFileSync(resolve(root,'tools/studio/assets.json'),'utf8'));validateStudyAssets(study,version.assets);if(version.revision!==study.baselineRevision)throw new Error('Studio 基準版本與正式設定不同；請執行 studio:prepare。');
 const manifestAt=process.argv.indexOf('--manifest');
 if(manifestAt>=0){
  const path=resolve(root,process.argv[manifestAt+1]??'');const {dirname,sep}=await import('node:path');const directory=dirname(path);const manifest=JSON.parse(readFileSync(path,'utf8'));
  if(manifest.schemaVersion!==1||manifest.validation?.status!=='passed'||!Array.isArray(manifest.outputs)||!manifest.outputs.length)throw new Error('manifest 未通過或無 outputs');
  for(const output of manifest.outputs){const file=resolve(directory,output.path);if(!file.startsWith(directory+sep)||hash(file)!==output.sha256)throw new Error(`manifest output 不一致：${output.path}`);}
  console.log(`manifest outputs SHA-256 通過：${path}`);
 }
 console.log('recipe 輸入、幾何契約、正式 preset 與 studio 資產版本通過。');
}catch(error){console.error(String(error));process.exitCode=1;}
