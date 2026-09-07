import { LEGACY_PREFERENCES_STORAGE_KEY, loadPreferences, PREFERENCES_STORAGE_KEY, savePreferences, type PreferencesStorage } from '../src/systems/Preferences.ts';

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
  const preferences = { version: 1 as const, place: 'leaflight' as const, hour: 6.5, live: true, beamStrength: 2.5, volume: 0.4, quality: 'low' as const, weather: 'rain' as const, rainIntensity: 0.8 };
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
  equal(storage.getItem(PREFERENCES_STORAGE_KEY), JSON.stringify(legacy), 'legacy preferences migrate to the new key');
  equal(storage.getItem(LEGACY_PREFERENCES_STORAGE_KEY), JSON.stringify(legacy), 'legacy key is retained');
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
