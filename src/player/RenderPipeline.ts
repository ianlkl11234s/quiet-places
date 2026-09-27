import * as THREE from 'three';
import {Pass} from 'three/addons/postprocessing/Pass.js';

/**
 * Scene pass that keeps multisampling to the geometry render only.
 *
 * The former pipeline put MSAA on the composer's ping-pong targets, so bloom's
 * full-screen composite also wrote into a multisampled half-float surface. Here
 * the scene is rendered into its own MSAA target, resolved once (three resolves
 * after render), then blitted into the single-sample read buffer that bloom and
 * the output pass use. With `samples = 0` it renders straight into the read buffer.
 * The resolved image is the same as before; only where the samples live changes.
 */
export class SceneRenderPass extends Pass {
 scene:THREE.Scene;camera:THREE.Camera;samples=0;
 private msaa:THREE.WebGLRenderTarget|null=null;
 constructor(scene:THREE.Scene,camera:THREE.Camera){super();this.scene=scene;this.camera=camera;this.needsSwap=false;}
 render(renderer:THREE.WebGLRenderer,_writeBuffer:THREE.WebGLRenderTarget,readBuffer:THREE.WebGLRenderTarget){
  const target=this.renderToScreen?null:readBuffer;
  if(this.samples<=0||!target){
   renderer.setRenderTarget(target);renderer.clear();renderer.render(this.scene,this.camera);return;
  }
  if(!this.msaa||this.msaa.samples!==this.samples||this.msaa.texture.type!==target.texture.type){
   this.msaa?.dispose();
   this.msaa=new THREE.WebGLRenderTarget(target.width,target.height,{type:target.texture.type,samples:this.samples});
  }else if(this.msaa.width!==target.width||this.msaa.height!==target.height)this.msaa.setSize(target.width,target.height);
  renderer.setRenderTarget(this.msaa);renderer.clear();renderer.render(this.scene,this.camera);
  // The multisample buffer is already resolved into msaa's texture framebuffer; copy it across.
  const gl=renderer.getContext() as WebGL2RenderingContext;
  const source=(renderer.properties.get(this.msaa) as {__webglFramebuffer?:WebGLFramebuffer}).__webglFramebuffer;
  renderer.setRenderTarget(target);
  const destination=(renderer.properties.get(target) as {__webglFramebuffer?:WebGLFramebuffer}).__webglFramebuffer;
  if(!source||!destination){renderer.clear();renderer.render(this.scene,this.camera);return;}
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,source);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,destination);
  gl.blitFramebuffer(0,0,target.width,target.height,0,0,target.width,target.height,gl.COLOR_BUFFER_BIT,gl.NEAREST);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);
  renderer.resetState();renderer.setRenderTarget(null);
 }
 dispose(){this.msaa?.dispose();this.msaa=null;}
}

/**
 * Antialiasing variants. 'msaa' (default) keeps each room's confirmed look. The others are
 * opt-in comparisons (?aa=msaa2|smaa): measured on Apple M3 / Chrome (ANGLE→Metal), MSAA
 * cost grows roughly per sample, so 2x or SMAA are much cheaper there — but SMAA visibly
 * breaks sub-pixel detail (fin rays, wall cracks, thin twigs), so neither is a default.
 */
export type Antialiasing='msaa'|'msaa2'|'smaa';
export const parseAntialiasing=(value:string|null):Antialiasing=>value==='msaa2'||value==='smaa'?value:'msaa';
