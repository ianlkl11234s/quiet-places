/** Rebuild the editable Blender interchange from the website's rest geometry.
 * node --experimental-strip-types assets/blender/scripts/export_afterlight_vegetation.mjs
 */
import {writeFile} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createPlantGeometry} from '../../../src/places/afterlight/PlantGeometry.ts';
// GLTFExporter uses FileReader for its binary Blob on Node as well as browsers.
globalThis.FileReader=class {
 readAsArrayBuffer(blob){blob.arrayBuffer().then(buffer=>{this.result=buffer;this.onloadend?.();});}
};
const plant=createPlantGeometry();plant.root.updateMatrixWorld(true);
plant.root.userData.source='src/places/afterlight/PlantGeometry.ts; rest geometry, runtime spring physics is not baked';
const data=await new GLTFExporter().parseAsync(plant.root,{binary:true});
await writeFile(new URL('../../../public/models/afterlight-vegetation.glb',import.meta.url),new Uint8Array(data));
plant.dispose();
