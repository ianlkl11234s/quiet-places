/**
 * A host-owned monotonic scene clock. Places receive its elapsed value and
 * must not create their own animation frame loop.
 */
export interface SceneClockSnapshot {
  elapsed: number;
  paused: boolean;
  disposed: boolean;
}

export interface SceneClock {
  readonly elapsed: number;
  readonly paused: boolean;
  readonly disposed: boolean;
  snapshot(): SceneClockSnapshot;
  setPaused(value: boolean): void;
  reset(elapsed?: number): void;
  /** Advances by seconds, clamping late frames and returning the applied dt. */
  advance(deltaSeconds: number): number;
  dispose(): void;
}

export interface SceneClockOptions {
  elapsed?: number;
  paused?: boolean;
  maxDeltaSeconds?: number;
}

export function createSceneClock(options: SceneClockOptions = {}): SceneClock {
  const maximum = options.maxDeltaSeconds ?? .05;
  if (!Number.isFinite(maximum) || maximum <= 0) throw new RangeError('Scene clock maxDeltaSeconds must be positive.');
  let elapsed = Number.isFinite(options.elapsed) ? Math.max(0, options.elapsed!) : 0;
  let paused = options.paused === true;
  let disposed = false;
  return {
    get elapsed() { return elapsed; },
    get paused() { return paused; },
    get disposed() { return disposed; },
    snapshot: () => ({elapsed, paused, disposed}),
    setPaused(value) { if (!disposed) paused = value; },
    reset(value = 0) { if (!disposed) elapsed = Number.isFinite(value) ? Math.max(0, value) : 0; },
    advance(deltaSeconds) {
      if (disposed || paused || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0;
      const dt = Math.min(deltaSeconds, maximum);
      elapsed += dt;
      return dt;
    },
    dispose() { disposed = true; },
  };
}
