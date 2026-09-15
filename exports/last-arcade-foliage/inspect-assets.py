"""Read actual GLB attributes; compare authored color and retained architecture."""
import hashlib,json,math,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def load(path):
 data=path.read_bytes();cursor=12;g=None
 while cursor<len(data):
  size,kind=struct.unpack_from('<II',data,cursor);start=cursor+8
  if kind==0x4e4f534a:g=json.loads(data[start:start+size])
  if kind==0x004e4942:return g,data[start:start+size]
  cursor=start+size
 raise ValueError('GLB binary missing')
def attribute(asset,index):
 g,b=asset;a=g['accessors'][index];v=g['bufferViews'][a['bufferView']]
 count={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
 code,size={5126:('f',4),5123:('H',2),5125:('I',4),5121:('B',1)}[a['componentType']]
 offset=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',size*count)
 values=[struct.unpack_from('<'+code*count,b,offset+i*stride) for i in range(a['count'])]
 assert all(math.isfinite(x) for row in values for x in row)
 return values
def details(path):
 asset=load(path);g,b=asset;result={}
 for node in g['nodes']:
  if node.get('extras',{}).get('arcade_role')!='foliage':continue
  attrs=g['meshes'][node['mesh']]['primitives'][0]['attributes']
  rgb=attribute(asset,attrs['COLOR_0']);lum=sorted(.2126*r+.7152*g+.0722*b for r,g,b in rgb)
  sky=attribute(asset,attrs['_ARCADE_SKY']) if '_ARCADE_SKY' in attrs else None
  wind=attribute(asset,attrs['_ARCADE_WIND'])
  result[node['name']]={'vertices':len(rgb),'linearRGBMean':[sum(c[i] for c in rgb)/len(rgb) for i in range(3)],'linearLuminanceMean':sum(lum)/len(lum),'linearLuminanceP95':lum[int(.95*(len(lum)-1))],'skyMean':sum(c[0] for c in sky)/len(sky) if sky else None,'windRange':[min(c[0] for c in wind),max(c[0] for c in wind)]}
 arch={}
 for node in g['nodes']:
  if node.get('extras',{}).get('arcade_role')!='architecture':continue
  mesh=g['meshes'][node['mesh']]
  for i,primitive in enumerate(mesh['primitives']):
   rows=attribute(asset,primitive['attributes']['POSITION'])
   arch[node['name']+str(i)]=hashlib.sha256(repr(rows).encode()).hexdigest()
 return result,arch
before,a=details(ROOT/'exports/last-arcade-foliage/baseline/last-arcade.glb')
after,b=details(ROOT/'public/models/last-arcade.glb')
assert a==b,'Architecture positions changed during foliage-only revision'
out={'architecturePositionStreamsUnchanged':len(a),'before':before,'after':after,'scope':'Authored linear vertex colors, not rendered brightness or biological measurements'}
(ROOT/'exports/last-arcade-foliage/asset-check.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2))
