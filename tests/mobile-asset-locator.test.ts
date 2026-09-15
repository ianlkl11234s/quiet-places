import test from 'node:test';
import assert from 'node:assert/strict';
import {setRoomAssetUrls,resolveAssetUrl} from '../src/shared/resources/AssetLocator.ts';
test('downloaded room uses only its verified dependencies; website URLs remain unchanged',()=>{
 setRoomAssetUrls(undefined);assert.equal(resolveAssetUrl('/models/fish.glb'),'/models/fish.glb');
 setRoomAssetUrls({'models/fish.glb':'capacitor://localhost/_capacitor_file_/fish.glb','audio/quiet.m4a':'capacitor://localhost/_capacitor_file_/quiet.m4a'});
 assert.match(resolveAssetUrl('/models/fish.glb'),/_capacitor_file_/);
 assert.match(resolveAssetUrl('/audio/quiet.m4a'),/_capacitor_file_/);
 assert.throws(()=>resolveAssetUrl('/models/missing.glb'),/缺少已校驗/);
 assert.equal(resolveAssetUrl('blob:generated-texture'),'blob:generated-texture');
 setRoomAssetUrls(undefined);
});
