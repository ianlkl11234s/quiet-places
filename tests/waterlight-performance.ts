// Development-only entry: load the real application DOM and composer, then
// report observed presentation intervals and CPU submission cost after warmup.
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
const html = new DOMParser().parseFromString(await (await fetch('/')).text(), 'text/html');
html.querySelectorAll('script').forEach(script => script.remove());
document.body.replaceChildren(...Array.from(html.body.childNodes));
const report = document.createElement('pre'); report.id = 'performance-report';
report.style.cssText = 'position:fixed;left:0;bottom:0;z-index:1000;background:#000c;color:white;font:11px monospace;max-width:95vw;white-space:pre-wrap;pointer-events:none';
document.body.append(report);
let start = 0, previous = 0, lastTriangles = 0, lastCalls = 0;
const intervals: number[] = [], cpu: number[] = [];
const render = EffectComposer.prototype.render;
EffectComposer.prototype.render = function (dt?: number) {
  const now = performance.now(); if (!start) start = now;
  const info = this.renderer.info, auto = info.autoReset;
  info.autoReset = false; info.reset();
  try { render.call(this, dt); } finally { info.autoReset = auto; }
  if (now - start > 5000 && previous && now - start < 20000) {
    intervals.push(now - previous); cpu.push(performance.now() - now);
    lastTriangles = info.render.triangles; lastCalls = info.render.calls;
  }
  previous = now;
  if (now - start >= 20000 && intervals.length) {
    const percentile = (values: number[], q: number) => [...values].sort((a,b) => a-b)[Math.min(values.length-1,Math.floor(values.length*q))];
    report.textContent = JSON.stringify({done:true, viewport:[innerWidth,innerHeight],dpr:this.renderer.getPixelRatio(), quality:(document.querySelector('#quality') as HTMLSelectElement).value, frames:intervals.length, fps:1000/(intervals.reduce((a,b)=>a+b,0)/intervals.length),frameMs:{p50:percentile(intervals,.5),p95:percentile(intervals,.95),max:Math.max(...intervals)},composerCpuMs:{p50:percentile(cpu,.5),p95:percentile(cpu,.95)},triangles:lastTriangles,drawCalls:lastCalls,textures:info.memory.textures,geometries:info.memory.geometries,note:'Actual app/composer; CPU submission is not GPU timing. Foreground tab, 5s warmup + 15s sample.'});
    EffectComposer.prototype.render = render;
  } else report.textContent = `Measuring actual app: ${Math.floor((now-start)/1000)} / 20 seconds`;
};
await import('../src/main.ts');
