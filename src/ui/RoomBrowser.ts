import type {PlaceId, PlaceMetadata} from '../places/metadata.ts';

export const ROOM_ENTRY_SESSION_KEY = 'quiet-places.room-entry.seen';

interface InitialPlaceOptions {
  requested?: PlaceId;
  preferred: PlaceId;
  places: readonly PlaceMetadata[];
  hasStoredPreference: boolean;
  random?: () => number;
}

/** Direct links and returning visitors stay deterministic; only a true first visit is sampled. */
export function chooseInitialPlace({requested, preferred, places, hasStoredPreference, random = Math.random}: InitialPlaceOptions): PlaceId {
  if (requested) return requested;
  if (hasStoredPreference || places.length === 0) return preferred;
  const sample = Math.min(.999999, Math.max(0, random()));
  return places[Math.floor(sample * places.length)]?.id ?? preferred;
}

export type RoomGridKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

/** Moves focus inside the room grid; edges clamp rather than wrap. `columns` is measured from the live layout. */
export function nextRoomIndex(index: number, count: number, columns: number, key: RoomGridKey): number {
  if (count <= 0) return -1;
  const step = Math.max(1, Math.floor(columns));
  const target = key === 'ArrowLeft' ? index - 1
    : key === 'ArrowRight' ? index + 1
    : key === 'ArrowUp' ? index - step
    : key === 'ArrowDown' ? index + step
    : key === 'Home' ? 0
    : count - 1;
  return Math.min(count - 1, Math.max(0, target));
}
