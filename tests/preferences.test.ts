import { getRoomPreferences, LEGACY_PREFERENCES_STORAGE_KEY, loadPreferences, PREFERENCES_STORAGE_KEY, savePreferences, saveRoomPreferences, type PreferencesStorage } from '../src/systems/Preferences.ts';

class MemoryStorage implements PreferencesStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class ThrowingStorage implements PreferencesStorage {
  getItem(): string | null { throw new Error('unavailable'); }
  setItem(): void { throw new Error('unavailable'); }
}

class MigrationWriteFailingStorage extends MemoryStorage {
  setItem(key: string, value: string): void {
    if (key === PREFERENCES_STORAGE_KEY) throw new Error('new key unavailable');
    super.setItem(key, value);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert(Object.is(actual, expected), `${message}: expected ${String(expected)}, received ${String(actual)}`);
}

function defaultsAreReturnedForInvalidData(): void {
  const storage = new MemoryStorage();
  storage.setItem(PREFERENCES_STORAGE_KEY, '{not json');
  equal(loadPreferences(storage).hour, 14, 'corrupt JSON falls back');

  storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ version: 2, hour: 3 }));
  equal(loadPreferences(storage).hour, 14, 'unknown version falls back');
}

function valuesAreSanitized(): void {
  const storage = new MemoryStorage();
  storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({
    version: 1, hour: null, live: 'yes', beamStrength: 8, volume: -1,
    quality: 'ultra', weather: 'snow', rainIntensity: 2,
  }));
  const preferences = loadPreferences(storage);
  equal(preferences.hour, 14, 'invalid hour uses default');
  equal(preferences.live, false, 'non-boolean live uses default');
  equal(preferences.beamStrength, 2.5, 'beam strength clamps');
  equal(preferences.volume, 0, 'volume clamps');
  equal(preferences.quality, 'standard', 'invalid quality uses default');
  equal(preferences.weather, 'clear', 'invalid weather uses default');
  equal(preferences.rainIntensity, 1, 'rain intensity clamps');

  savePreferences({ ...preferences, hour: Number.NaN }, storage);
  equal(loadPreferences(storage).hour, 14, 'non-finite saved hour uses default');
}

function storageFailuresAreSafe(): void {
  const storage = new ThrowingStorage();
  equal(loadPreferences(storage).hour, 14, 'read failure falls back');
  equal(savePreferences(loadPreferences(storage), storage), false, 'write failure is reported');
}

function roundTrip(): void {
  const storage = new MemoryStorage();
  const preferences = { version: 1 as const, place: 'leaflight' as const, hour: 6.5, live: true, beamStrength: 2.5, volume: 0.4, quality: 'low' as const, weather: 'rain' as const, rainIntensity: 0.8, rooms: {} };
  equal(savePreferences(preferences, storage), true, 'save succeeds');
  const loaded = loadPreferences(storage);
  equal(loaded.place, 'leaflight', 'place round-trips');
  equal(loaded.hour, 6.5, 'hour round-trips');
  equal(loaded.live, true, 'live round-trips');
  equal(loaded.beamStrength, 2.5, 'maximum beam strength round-trips');
  equal(loaded.quality, 'low', 'quality round-trips');
  equal(loaded.weather, 'rain', 'weather round-trips');
}

function legacyPreferencesMigrateToTheNewKey(): void {
  const storage = new MemoryStorage();
  const legacy = { version: 1, place: 'oceanlight', hour: 17.5, live: true, beamStrength: 1.4, volume: 0.2, quality: 'low', weather: 'rain', rainIntensity: 0.7 };
  storage.setItem(LEGACY_PREFERENCES_STORAGE_KEY, JSON.stringify(legacy));

  const loaded = loadPreferences(storage);
  equal(loaded.place, 'oceanlight', 'legacy place is loaded');
  equal(loaded.hour, 17.5, 'legacy hour is loaded');
  equal(JSON.parse(storage.getItem(PREFERENCES_STORAGE_KEY)!).rooms.waterlight === undefined, true, 'legacy migration stores an empty room map');
  equal(storage.getItem(LEGACY_PREFERENCES_STORAGE_KEY), JSON.stringify(legacy), 'legacy key is retained');
}

function roomPreferencesAreIndependentAndRoundTrip(): void {
  const storage = new MemoryStorage();
  const preferences = loadPreferences(storage);
  saveRoomPreferences(preferences, 'waterlight', { hour: 0, live: false, beamStrength: 0, weather: 'rain', rainIntensity: 0, oceanLevel: 'below' });
  saveRoomPreferences(preferences, 'oceanlight', { hour: 23.5, live: true, beamStrength: 2.5, weather: 'clear', rainIntensity: 1, oceanLevel: 'submerged' });
  equal(savePreferences(preferences, storage), true, 'room preferences save');

  const loaded = loadPreferences(storage);
  const waterlight = getRoomPreferences(loaded, 'waterlight');
  const oceanlight = getRoomPreferences(loaded, 'oceanlight');
  equal(waterlight.hour, 0, 'room hour preserves zero');
  equal(waterlight.beamStrength, 0, 'room beam strength preserves zero');
  equal(waterlight.rainIntensity, 0, 'room rain intensity preserves zero');
  equal(oceanlight.oceanLevel, 'submerged', 'ocean level round-trips');
  waterlight.hour = 12;
  equal(getRoomPreferences(loaded, 'waterlight').hour, 0, 'returned room preferences are independent copies');
}

function roomPreferencesSanitizeAndFallBack(): void {
  const storage = new MemoryStorage();
  storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({
    version: 1, place: 'leaflight', hour: 7, live: true, beamStrength: 1.5, weather: 'rain', rainIntensity: 0.2,
    rooms: {
      leaflight: { hour: -3, live: 'yes', beamStrength: 9, weather: 'snow', rainIntensity: 2, oceanLevel: 'high' },
      invalid: { hour: 4 },
    },
  }));
  const loaded = loadPreferences(storage);
  const leaflight = getRoomPreferences(loaded, 'leaflight');
  equal(leaflight.hour, 0, 'room hour clamps');
  equal(leaflight.live, false, 'room live is strict');
  equal(leaflight.beamStrength, 2.5, 'room beam strength clamps');
  equal(leaflight.weather, 'clear', 'room weather falls back');
  equal(leaflight.rainIntensity, 1, 'room rain intensity clamps');
  equal(leaflight.oceanLevel, 'below', 'room ocean level falls back');
  equal(loaded.rooms.invalid, undefined, 'unknown rooms are filtered');

  const legacy = loadPreferences(new MemoryStorage());
  legacy.place = 'leaflight'; legacy.hour = 9; legacy.live = true; legacy.beamStrength = 1.2; legacy.weather = 'rain'; legacy.rainIntensity = 0.4;
  equal(getRoomPreferences(legacy, 'leaflight').hour, 9, 'legacy current room uses top-level hour');
  equal(getRoomPreferences(legacy, 'waterlight').hour, 14, 'unvisited room uses defaults');
}

function newKeyTakesPriorityOverLegacy(): void {
  const storage = new MemoryStorage();
  storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ version: 1, place: 'leaflight', hour: 6.5 }));
  storage.setItem(LEGACY_PREFERENCES_STORAGE_KEY, JSON.stringify({ version: 1, place: 'oceanlight', hour: 22 }));

  const loaded = loadPreferences(storage);
  equal(loaded.place, 'leaflight', 'new key takes priority');
  equal(loaded.hour, 6.5, 'new key values are preserved');
}

function failedMigrationStillReturnsLegacyPreferences(): void {
  const storage = new MigrationWriteFailingStorage();
  storage.setItem(LEGACY_PREFERENCES_STORAGE_KEY, JSON.stringify({ version: 1, place: 'leaflight', hour: 12, live: true }));

  const loaded = loadPreferences(storage);
  equal(loaded.place, 'leaflight', 'legacy preferences survive a migration write failure');
  equal(loaded.hour, 12, 'legacy hour survives a migration write failure');
  equal(storage.getItem(PREFERENCES_STORAGE_KEY), null, 'failed migration does not create the new key');
}

defaultsAreReturnedForInvalidData();
valuesAreSanitized();
storageFailuresAreSafe();
roundTrip();
legacyPreferencesMigrateToTheNewKey();
newKeyTakesPriorityOverLegacy();
failedMigrationStillReturnsLegacyPreferences();
roomPreferencesAreIndependentAndRoundTrip();
roomPreferencesSanitizeAndFallBack();
