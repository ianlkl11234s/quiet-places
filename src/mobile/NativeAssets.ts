import {Capacitor, registerPlugin, type PluginListenerHandle} from '@capacitor/core';

export interface NativeAssetFile {
  path:string;
  bytes:number;
  sha256:string;
  /** Optional absolute HTTPS URL; otherwise `path` is resolved under `baseUrl`. */
  url?:string;
}

export interface RoomAssetManifest {
  schemaVersion:1;
  appSchemaVersion:1;
  roomId:string;
  assetVersion:string;
  minAppVersion?:string;
  /** Complete room size: its own files plus the shared assets it names. */
  totalBytes:number;
  files:NativeAssetFile[];
  sharedAssets:string[];
  provenance?:string;
  licenseStatus?:string;
}

export interface NativeAssetProgress {
  roomId:string;
  phase:'downloading'|'verifying'|'ready';
  bytesDownloaded:number;
  totalBytes:number;
  filePath?:string;
}

export interface InstalledRoomAssets {
  roomId:string;
  assetVersion:string;
  totalBytes:number;
  /** Native installed receipt; `files` includes the resolved shared dependencies. */
  manifest:RoomAssetManifest;
  /** `file://` URLs; use `toWebUrls` before handing them to Three.js/WebAudio. */
  urls:Record<string,string>;
}

export interface NativeAssetStatus extends Partial<InstalledRoomAssets> {
  roomId:string;
  state:'notDownloaded'|'downloading'|'ready'|'invalid';
  reason?:string;
  retainedBytes?:number;
}

export interface InvalidNativeRoom {roomId:string;reason:string;}
export interface NativeAssetList {rooms:InstalledRoomAssets[];invalidRooms:InvalidNativeRoom[];retainedBytes:number;}

interface NativeAssetsPlugin {
  download(options:{manifest:RoomAssetManifest;sharedFiles?:NativeAssetFile[];baseUrl:string}):Promise<InstalledRoomAssets>;
  cancel(options:{roomId:string}):Promise<void>;
  status(options:{roomId:string}):Promise<NativeAssetStatus>;
  list():Promise<NativeAssetList>;
  resolve(options:{roomId:string}):Promise<InstalledRoomAssets>;
  remove(options:{roomId:string}):Promise<void>;
  rollback(options:{roomId:string}):Promise<InstalledRoomAssets>;
  addListener(eventName:'progress', listener:(progress:NativeAssetProgress)=>void):Promise<PluginListenerHandle>;
}

export const NativeAssets=registerPlugin<NativeAssetsPlugin>('NativeAssets');

/** Converts native file URLs to Capacitor's WebView-safe local URL form. */
export function toWebUrls(installed:InstalledRoomAssets):InstalledRoomAssets {
  if(!Capacitor.isNativePlatform())return installed;
  return {...installed,urls:Object.fromEntries(Object.entries(installed.urls).map(([path,url])=>[path,Capacitor.convertFileSrc(url)]))};
}
