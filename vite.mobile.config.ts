import {defineConfig} from 'vite';
import {execFileSync} from 'node:child_process';
const sourceRevision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const sourceDirty=Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim());
export default defineConfig({
 publicDir:'.mobile-public',
 define:{__QUIET_PLACES_MOBILE__:true,__QUIET_PLACES_ASSET_BASE__:JSON.stringify(process.env.QUIET_PLACES_ASSET_BASE_URL??''),__QUIET_PLACES_SOURCE__:JSON.stringify({sourceRevision,sourceDirty})},
 plugins:[{name:'mobile-entry',transformIndexHtml:{order:'pre',handler:html=>html
  .replace('/src/main.ts','/src/mobile/main.ts')
  .replace('width=device-width, initial-scale=1.0','width=device-width, initial-scale=1.0, viewport-fit=cover')
  .replace(/<link[^>]+rel="icon"[^>]*>/g,'')}}],
 build:{outDir:'dist-mobile',rollupOptions:{input:'index.html'}},
});
