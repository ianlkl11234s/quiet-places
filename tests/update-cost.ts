// Development-only probe: splits per-frame cost into place.update() CPU and composer.render()+readPixels (GPU-forced).
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
const g = globalThis as any;
const subTotals: Record<string, number> = {};
g.__t = (k: string, f: () => void) => { const s = performance.now(); f(); subTotals[k] = (subTotals[k] ?? 0) + performance.now() - s; };
type Rec = {ms: number; sub: Record<string, number>};
let recording: Rec[] | null = null, lastPlace: any = null, lastArgs: any[] = [];
g.__perf = {onUpdate(ms: number, p: any, a: any[]) {
  lastPlace = p; lastArgs = a;
  const sub = {...subTotals}; for (const k in subTotals) delete subTotals[k];
  recording?.push({ms, sub});
}};
const html = new DOMParser().parseFromString(await (await fetch('/')).text(), 'text/html');
html.querySelectorAll('script').forEach(s => s.remove());
document.body.replaceChildren(...Array.from(html.body.childNodes));
const report = document.createElement('pre'); report.id = 'performance-report';
report.style.cssText = 'position:fixed;left:0;bottom:0;z-index:1000;background:#000c;color:white;font:11px monospace;max-width:95vw;white-space:pre-wrap;pointer-events:none';
document.body.append(report);
const q = (v: number[], p: number) => [...v].sort((a, b) => a - b)[Math.min(v.length - 1, Math.floor(v.length * p))];
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / (v.length || 1);
const summarize = (recs: Rec[]) => {
  const ms = recs.map(r => r.ms), keys = new Set<string>(); recs.forEach(r => Object.keys(r.sub).forEach(k => keys.add(k)));
  const sub: Record<string, {mean: number; p95: number}> = {};
  keys.forEach(k => { const v = recs.map(r => r.sub[k] ?? 0); sub[k] = {mean: mean(v), p95: q(v, .95)}; });
  return {n: ms.length, mean: mean(ms), p50: q(ms, .5), p95: q(ms, .95), max: Math.max(...ms), sub};
};
let start = 0, previous = 0, done = false, composer: EffectComposer | null = null, tri = 0, calls = 0;
const intervals: number[] = [], cpu: number[] = [];
const origRender = EffectComposer.prototype.render;
EffectComposer.prototype.render = function (dt?: number) {
  const now = performance.now(); if (!start) { start = now; recording = []; }
  composer = this;
  const info = this.renderer.info, auto = info.autoReset; info.autoReset = false; info.reset();
  try { origRender.call(this, dt); } finally { info.autoReset = auto; }
  if (!done && now - start > 5000 && previous && now - start < 20000) {
    intervals.push(now - previous); cpu.push(performance.now() - now); tri = info.render.triangles; calls = info.render.calls;
  } else if (!done && now - start <= 5000) recording!.length = 0;
  previous = now;
  if (!done && now - start >= 20000 && intervals.length) { done = true; const passive = recording!; recording = null; setTimeout(() => active(passive), 50); }
  else if (!done) report.textContent = `Measuring: ${Math.floor((now - start) / 1000)} / 20 s`;
};
function active(passiveRecs: Rec[]) {
  const c = composer!, gl = c.renderer.getContext() as WebGL2RenderingContext, px = new Uint8Array(4);
  const force = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const N = 20, rounds: any[] = [];
  const t = (f: () => void) => { const s = performance.now(); f(); return performance.now() - s; };
  let elapsed = lastArgs[1] ?? 0; const dt = 1 / 30;
  const upd = () => { elapsed += dt; lastPlace.update(dt, elapsed, lastArgs[2]); };
  // warm the synchronous path once
  for (let i = 0; i < 3; i++) { upd(); origRender.call(c, dt); } force();
  for (let r = 0; r < 3; r++) {
    // 1) draw only (state frozen), forced complete
    const draw = t(() => { for (let i = 0; i < N; i++) origRender.call(c, dt); force(); }) / N;
    // 2) update only (CPU), recorded with sub timers
    recording = []; for (const k in subTotals) delete subTotals[k];
    for (let i = 0; i < 60; i++) upd();
    const updRecs = recording; recording = null;
    // 3) full frame: update + draw, forced complete
    const full = t(() => { for (let i = 0; i < N; i++) { upd(); origRender.call(c, dt); } force(); }) / N;
    rounds.push({drawMs: draw, update: summarize(updRecs), fullMs: full});
  }
  const med = (k: (r: any) => number) => q(rounds.map(k), .5);
  const result = {done: true, place: new URLSearchParams(location.search).get('place'), viewport: [innerWidth, innerHeight], dpr: c.renderer.getPixelRatio(),
    quality: (document.querySelector('#quality') as HTMLSelectElement | null)?.value, localHour: new Date().getHours(),
    passive: {frames: intervals.length, fps: 1000 / mean(intervals), frameMs: {p50: q(intervals, .5), p95: q(intervals, .95), max: Math.max(...intervals)}, composerCpuMs: {p50: q(cpu, .5), p95: q(cpu, .95)}, update: summarize(passiveRecs)},
    triangles: tri, drawCalls: calls, textures: c.renderer.info.memory.textures, geometries: c.renderer.info.memory.geometries,
    median: {drawMs: med(r => r.drawMs), updateMean: med(r => r.update.mean), updateP95: med(r => r.update.p95), fullMs: med(r => r.fullMs)}, rounds,
    note: 'drawMs = composer.render x20 + readPixels / 20 (state frozen). update from synchronous loop of 60 calls. fullMs = update+render x20 + readPixels / 20.'};
  report.textContent = JSON.stringify(result);
}
await import('../src/main.ts');
