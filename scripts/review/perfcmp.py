import json,sys
def load(f):
  out={}
  for l in open(f):
    d=json.loads(l); r=d['report']; out[d['place']]=json.loads(r) if isinstance(r,str) else r
  return out
m=load(sys.argv[1]); b=load(sys.argv[2])
print(f"{'scene':12} {'fps m':>6} {'fps b':>6} {'p95 m':>6} {'p95 b':>6} {'cpu95m':>6} {'cpu95b':>6} {'tris m':>8} {'tris b':>8} {'call m':>6} {'call b':>6} {'tex m':>5} {'tex b':>5}")
for k in m:
  a,c=m[k],b[k]
  print(f"{k:12} {a['fps']:6.1f} {c['fps']:6.1f} {a['frameMs']['p95']:6.1f} {c['frameMs']['p95']:6.1f} {a['composerCpuMs']['p95']:6.1f} {c['composerCpuMs']['p95']:6.1f} {a['triangles']:8} {c['triangles']:8} {a['drawCalls']:6} {c['drawCalls']:6} {a['textures']:5} {c['textures']:5}")
