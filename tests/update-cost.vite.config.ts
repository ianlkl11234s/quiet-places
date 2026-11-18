// Measurement-only Vite config: wraps place.update() and a few creature calls with timers.
// Used only by tests/update-cost.html; does not touch src/ on disk.
import {defineConfig, mergeConfig, type Plugin} from 'vite';
import base from '../vite.config.ts';
const sub: Record<string, Array<[string, string, string]>> = {
  'src/places/seabridge/index.ts': [['sardines.update(elapsed);', 'sardines', 'sardines.update(elapsed)']],
  'src/places/last-arcade/index.ts': [['biology.update(_dt,elapsed);', 'biology_total', 'biology.update(_dt,elapsed)']],
  'src/places/last-arcade/biology/index.ts': [
    ['schools.update(dt,elapsed);ambient.update(elapsed);', 'schools', 'schools.update(dt,elapsed)'],
  ],
  'src/places/snowhall/index.ts': [['life.update(elapsed);', 'antarctic_life', 'life.update(elapsed)']],
  'src/places/snowwindow/index.ts': [['creatures.update(elapsed,light.visibility);', 'creatures', 'creatures.update(elapsed,light.visibility)']],
};
const plugin: Plugin = {
  name: 'perf-wrap', enforce: 'pre',
  transform(code, id) {
    const path = id.split('?')[0];
    if (path.endsWith('src/places/catalog.ts')) {
      const head = 'export async function preparePlace(id:PlaceId):Promise<PlaceFactory>{';
      if (!code.includes(head)) throw new Error('catalog head not found');
      return code.replace(head, 'async function preparePlaceRaw(id:PlaceId):Promise<PlaceFactory>{') + `
export async function preparePlace(id:PlaceId):Promise<PlaceFactory>{const f=await preparePlaceRaw(id);
 const w:any=(scene:any,renderer:any)=>{const p:any=f(scene,renderer);const u=p.update.bind(p);
  p.update=(...a:any[])=>{const s=performance.now();u(...a);(globalThis as any).__perf?.onUpdate(performance.now()-s,p,a);};return p;};
 w.dispose=()=>f.dispose?.();return w;}
`;
    }
    for (const [file, edits] of Object.entries(sub)) if (path.endsWith(file)) {
      let out = code;
      for (const [from, name, expr] of edits) {
        if (!out.includes(from)) throw new Error(`pattern not found in ${file}: ${from}`);
        const rest = from.slice(expr.length + 1); // text after "expr;"
        out = out.replace(from, `globalThis.__t('${name}',()=>{${expr};});${rest}`);
      }
      return out;
    }
  },
};
export default mergeConfig(base, defineConfig({plugins: [plugin]}));
