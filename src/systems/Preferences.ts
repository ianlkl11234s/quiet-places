export type RenderQuality = 'standard' | 'low';
export type Weather = 'clear' | 'rain';

export interface Preferences {
  version: 1;
  hour: number;
  live: boolean;
  beamStrength: number;
  volume: number;
  quality: RenderQuality;
  weather: Weather;
  rainIntensity: number;
}

export interface PreferencesStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const PREFERENCES_STORAGE_KEY = 'stillwater.preferences';

const defaults = (): Preferences => ({
  version: 1,
  hour: 14,
  live: false,
  beamStrength: 1,
  volume: 0.35,
  quality: 'standard',
  weather: 'clear',
  rainIntensity: 0.5,
});

function clamp(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function resolveStorage(storage?: PreferencesStorage): PreferencesStorage | undefined {
  if (storage) return storage;
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

function normalize(value: unknown): Preferences {
  const fallback = defaults();
  if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1) return fallback;
  const candidate = value as Partial<Preferences>;
  return {
    version: 1,
    hour: clamp(candidate.hour, fallback.hour, 0, 23.99),
    live: candidate.live === true,
    beamStrength: clamp(candidate.beamStrength, fallback.beamStrength, 0, 2.5),
    volume: clamp(candidate.volume, fallback.volume, 0, 1),
    quality: candidate.quality === 'low' || candidate.quality === 'standard' ? candidate.quality : fallback.quality,
    weather: candidate.weather === 'rain' || candidate.weather === 'clear' ? candidate.weather : fallback.weather,
    rainIntensity: clamp(candidate.rainIntensity, fallback.rainIntensity, 0, 1),
  };
}

export function loadPreferences(storage?: PreferencesStorage): Preferences {
  try {
    const serialized = resolveStorage(storage)?.getItem(PREFERENCES_STORAGE_KEY);
    return serialized === null || serialized === undefined ? defaults() : normalize(JSON.parse(serialized));
  } catch {
    return defaults();
  }
}

export function savePreferences(preferences: Preferences, storage?: PreferencesStorage): boolean {
  try {
    const target = resolveStorage(storage);
    if (!target) return false;
    target.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(normalize(preferences)));
    return true;
  } catch {
    return false;
  }
}
