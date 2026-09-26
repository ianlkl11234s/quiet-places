import sys
from PIL import Image, ImageStat
scene=sys.argv[1]; dirs=sys.argv[2:]
boxes={
 'oceanlight':{'leftWall':(60,150,220,450),'rightWall':(1420,150,1560,450),'ceiling':(600,20,1000,120),'frontWall':(300,420,600,520)},
 'waterlight':{'lowerWallNearBeam':(650,520,900,680),'leftLowCorner':(250,560,430,720),'farRightWall':(1300,300,1560,600),'upperLeftWall':(40,100,300,400),'floorNear':(700,760,1100,880)},
 'leaflight':{'room':(100,500,500,800),'nightSky':(1350,30,1500,120),'control_noonFloorPatch':(1050,650,1200,720)},
}[scene]
def lum(im,b):
    c=im.crop(b).convert('RGB'); s=ImageStat.Stat(c).mean
    return round(.2126*s[0]+.7152*s[1]+.0722*s[2],1)
for m in ['dawn','noon','sunset','moon']:
    row=[m]
    for name,b in boxes.items():
        vals=[lum(Image.open(f'{d}/{scene}-{m}.png'),b) for d in dirs]
        row.append(f"{name}:"+"/".join(map(str,vals)))
    print('  '.join(row))
