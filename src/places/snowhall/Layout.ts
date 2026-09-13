import * as THREE from 'three';

export const SNOW_HALL_DOORS = [
 {side:'right',z:2.55,width:1.02},
 {side:'left',z:-2.05,width:.96},
 {side:'left',z:-6.35,width:.92},
 {side:'right',z:-6.35,width:.92},
] as const;

export type SnowhallDraft={
 version:1;
 corridorWidth:number;
 window:{x:number;y:number;width:number;height:number};
 camera:{position:[number,number,number];target:[number,number,number];fov:number};
 snowScale:number;
};

export const SNOW_HALL_BASELINE:SnowhallDraft={
 version:1,
 corridorWidth:2.8,
 window:{x:0,y:1.76,width:1.76,height:2.05},
 camera:{position:[.34,1.03,-.07],target:[0,1.31,-10.85],fov:50},
 snowScale:1.83,
};

const finite=(value:number,label:string)=>{if(!Number.isFinite(value))throw new Error(`${label} 必須是有限數值。`);return value;};

export function validateSnowhallDraft(input:SnowhallDraft):SnowhallDraft{
 const draft=structuredClone(input);
 finite(draft.corridorWidth,'走廊寬度');finite(draft.window.x,'窗戶 X');finite(draft.window.y,'窗戶 Y');finite(draft.window.width,'窗戶寬度');finite(draft.window.height,'窗戶高度');finite(draft.snowScale,'雪粒倍率');
 if(draft.corridorWidth<2.8||draft.corridorWidth>6.5)throw new Error('走廊淨寬必須介於 2.8 到 6.5 m。');
 if(draft.window.width<.8||draft.window.width>3||draft.window.height<.8||draft.window.height>2.6)throw new Error('窗戶寬高超出試片範圍。');
 const wallEdge=draft.corridorWidth/2+.12,frameHalf=draft.window.width/2+.09;
 if(Math.abs(draft.window.x)+frameHalf>wallEdge-.12)throw new Error('窗戶超出走廊端牆。');
 if(draft.window.y-draft.window.height/2<.25||draft.window.y+draft.window.height/2>3.05)throw new Error('窗戶上下緣超出端牆。');
 if(draft.snowScale<.35||draft.snowScale>2.5)throw new Error('雪粒倍率必須介於 0.35 到 2.5。');
 for(const [label,values] of [['相機位置',draft.camera.position],['相機注視點',draft.camera.target]] as const)values.forEach(value=>finite(value,label));
 finite(draft.camera.fov,'FOV');if(draft.camera.fov<20||draft.camera.fov>100)throw new Error('FOV 必須介於 20 到 100 度。');
 const [px,py,pz]=draft.camera.position,[tx,ty,tz]=draft.camera.target;
 if((px-tx)**2+(py-ty)**2+(pz-tz)**2<1e-8)throw new Error('相機位置與注視點不能重合。');
 return draft;
}

export function snowhallGeometry(input:SnowhallDraft){
 const draft=validateSnowhallDraft(input),wallX=draft.corridorWidth/2+.12,baseboardX=draft.corridorWidth/2-.025;
 const apertureLeft=draft.window.x-draft.window.width/2+.075,apertureRight=draft.window.x+draft.window.width/2-.075;
 const apertureBottom=draft.window.y-draft.window.height/2-.09,apertureTop=draft.window.y+draft.window.height/2+.02;
 return {
  floorWidth:draft.corridorWidth+.48,wallX,baseboardX,doorX:draft.corridorWidth/2-.013,jambX:draft.corridorWidth/2-.045,
  endLeft:{width:apertureLeft+wallX,x:(-wallX+apertureLeft)/2},
  endRight:{width:wallX-apertureRight,x:(wallX+apertureRight)/2},
  endTop:{width:apertureRight-apertureLeft,height:3.33-apertureTop,y:(3.33+apertureTop)/2},
  endBottom:{width:apertureRight-apertureLeft,height:apertureBottom+.09,y:(apertureBottom-.09)/2},
  frame:{outerWidth:draft.window.width+.18,outerHeight:draft.window.height+.17,sideX:draft.window.width/2+.045,topY:draft.window.height/2+.04},
  draft,
 };
}

function resizeBox(root:THREE.Object3D,name:string,size:[number,number,number],position:[number,number,number]){
 const mesh=root.getObjectByName(name) as THREE.Mesh<THREE.BoxGeometry>|undefined;if(!mesh)return;
 const {width,height,depth}=mesh.geometry.parameters;mesh.scale.set(size[0]/width,size[1]/height,size[2]/depth);mesh.position.set(...position);
}

export function applySnowhallLayout(root:THREE.Group,input:SnowhallDraft){
 const g=snowhallGeometry(input),w=g.draft.window;
 root.userData.snowScale=g.draft.snowScale;
 resizeBox(root,'snowhall-floor',[g.floorWidth,.18,19.2],[0,-.09,-2.25]);
 resizeBox(root,'snowhall-ceiling',[g.floorWidth,.22,19.2],[0,3.31,-2.25]);
 resizeBox(root,'snowhall-left-wall',[.24,3.42,19.2],[-g.wallX,1.62,-2.25]);
 resizeBox(root,'snowhall-right-wall',[.24,3.42,19.2],[g.wallX,1.62,-2.25]);
 resizeBox(root,'snowhall-left-baseboard',[.055,.10,19.05],[-g.baseboardX,.05,-2.25]);
 resizeBox(root,'snowhall-right-baseboard',[.055,.10,19.05],[g.baseboardX,.05,-2.25]);
 resizeBox(root,'snowhall-end-left',[g.endLeft.width,3.42,.28],[g.endLeft.x,1.62,-11.72]);
 resizeBox(root,'snowhall-end-right',[g.endRight.width,3.42,.28],[g.endRight.x,1.62,-11.72]);
 resizeBox(root,'snowhall-end-lintel',[g.endTop.width,g.endTop.height,.28],[w.x,g.endTop.y,-11.72]);
 resizeBox(root,'snowhall-end-sill-wall',[g.endBottom.width,g.endBottom.height,.28],[w.x,g.endBottom.y,-11.72]);
 resizeBox(root,'snowhall-frame-top',[g.frame.outerWidth,.09,.18],[w.x,w.y+g.frame.topY,-11.53]);
 resizeBox(root,'snowhall-frame-bottom',[g.frame.outerWidth,.09,.18],[w.x,w.y-g.frame.topY,-11.53]);
 resizeBox(root,'snowhall-frame-left',[.09,g.frame.outerHeight,.18],[w.x-g.frame.sideX,w.y,-11.53]);
 resizeBox(root,'snowhall-frame-right',[.09,g.frame.outerHeight,.18],[w.x+g.frame.sideX,w.y,-11.53]);
 resizeBox(root,'snowhall-window-glass',[w.width,w.height,.018],[w.x,w.y,-11.51]);
 resizeBox(root,'snowhall-snow-on-sill',[w.width+.02,.055,.32],[w.x,w.y-w.height/2+.035,-11.63]);
 root.traverse(object=>{const side=object.userData.doorSide as 'left'|'right'|undefined;if(!side)return;const sign=side==='right'?1:-1;object.position.x=sign*(object.userData.doorPart==='door'?g.doorX:g.jambX);});
 const light=root.getObjectByName('snowhall-window-area-light') as THREE.RectAreaLight|undefined;if(light){light.position.x=w.x;light.position.y=w.y;light.width=w.width;light.height=w.height;light.lookAt(w.x,w.y,-10.46);}
 root.userData.onSnowhallLayoutChange?.(g.draft);
}
