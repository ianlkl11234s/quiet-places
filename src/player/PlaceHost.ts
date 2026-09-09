import * as THREE from 'three';
import type {PlaceFactory, PlaceInstance} from './contracts.ts';
import type {PlaceId} from '../places/metadata.ts';

export interface HostedPlace {
  id: PlaceId;
  scene: THREE.Scene;
  place: PlaceInstance;
}

export interface PlaceHostOptions {
  renderer: THREE.WebGLRenderer;
  preparePlace(id: PlaceId): Promise<PlaceFactory>;
  createScene?: () => THREE.Scene;
  /** Extend the default renderer-state snapshot for host-specific mutations. */
  captureRendererState?: (renderer: THREE.WebGLRenderer) => () => void;
}

/**
 * Owns exactly one active place. A candidate is prepared and constructed
 * before the active place is retired, so a failed switch leaves it usable.
 */
export interface PlaceHost {
  readonly current: HostedPlace | undefined;
  load(id: PlaceId): Promise<HostedPlace>;
  switchTo(id: PlaceId): Promise<HostedPlace>;
  dispose(): void;
}

export function createPlaceHost(options: PlaceHostOptions): PlaceHost {
  const createScene = options.createScene ?? (() => new THREE.Scene());
  const captureRendererState = options.captureRendererState ?? ((renderer: THREE.WebGLRenderer) => {
    const {enabled, type} = renderer.shadowMap;
    return () => { renderer.shadowMap.enabled = enabled; renderer.shadowMap.type = type; };
  });
  let current: HostedPlace | undefined;
  let disposed = false;
  let loading = false;

  async function create(id: PlaceId): Promise<HostedPlace> {
    const factory = await options.preparePlace(id);
    if (disposed) { factory.dispose?.(); throw new Error('Place host is disposed.'); }
    const scene = createScene();
    try {
      return {id, scene, place: factory(scene, options.renderer)};
    } catch (error) {
      factory.dispose?.();
      throw error;
    }
  }

  async function replace(id: PlaceId): Promise<HostedPlace> {
    if (disposed) throw new Error('Place host is disposed.');
    if (loading) throw new Error('Place host is already switching.');
    if (current?.id === id) return current;
    loading = true;
    const restoreBeforeCandidate = captureRendererState(options.renderer);
    let candidate: HostedPlace | undefined;
    try {
      candidate = await create(id);
      const restoreCandidate = captureRendererState(options.renderer);
      const retired = current;
      current = candidate;
      try {
        retired?.place.dispose();
      } finally {
        // Existing places restore their previous shadow setting on dispose.
        // Keep the state established by the newly active place instead.
        restoreCandidate();
      }
      return candidate;
    } catch (error) {
      // A factory may mutate renderer state before reporting a load failure.
      // The active place remains current, so reinstate its renderer state.
      if (!candidate) restoreBeforeCandidate();
      throw error;
    } finally {
      loading = false;
    }
  }

  return {
    get current() { return current; },
    load: replace,
    switchTo: replace,
    dispose() {
      if (disposed) return;
      disposed = true;
      current?.place.dispose();
      current = undefined;
    },
  };
}
