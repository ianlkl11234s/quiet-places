import {defineConfig} from 'vite';
import {execFileSync} from 'node:child_process';
const sourceRevision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const sourceDirty=Boolean(execFileSync('git',['diff','HEAD','--name-only'],{encoding:'utf8'}).trim());
export default defineConfig({
 cacheDir:process.env.QUIET_PLACES_VITE_CACHE,
 define:{__QUIET_PLACES_SOURCE__:JSON.stringify({sourceRevision,sourceDirty})},
 build:{rollupOptions:{input:{app:'index.html',studio:'tools/studio/index.html'}}},
});
