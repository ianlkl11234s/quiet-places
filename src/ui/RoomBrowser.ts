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

export interface MemoryBubblePosition {
  x: number;
  y: number;
  scale: number;
  delay: number;
}

const primaryPositions: readonly Omit<MemoryBubblePosition, 'delay'>[] = [
  {x: 66, y: 43, scale: .85},
  {x: 66, y: 18, scale: .85},
  {x: 87, y: 30, scale: .85},
  {x: 87, y: 57, scale: .85},
  {x: 66, y: 73, scale: .85},
  {x: 45, y: 57, scale: .85},
  {x: 45, y: 30, scale: .85},
];

/** Keeps every current-catalog bubble equally sized while the active room holds the central anchor. */
export function layoutMemoryBubbles(ids: readonly PlaceId[], current: PlaceId): ReadonlyMap<PlaceId, MemoryBubblePosition> {
  const ordered = [current, ...ids.filter(id => id !== current)];
  return new Map(ordered.map((id, index) => {
    const primary = ordered.length <= primaryPositions.length ? primaryPositions[index] : index === 0 ? primaryPositions[0] : undefined;
    if (primary) return [id, {...primary, delay: index * 45}] as const;
    const orbitIndex=index-1,ringIndex=Math.floor(orbitIndex/8),slot=orbitIndex%8;
    const remaining=ordered.length-1-ringIndex*8,slots=Math.min(8,remaining);
    const angle=-Math.PI/2+slot*Math.PI*2/slots+ringIndex*.22;
    const radiusX=24+ringIndex*11,radiusY=22+ringIndex*10;
    return [id, {
      x: Math.min(94, Math.max(35, 66+Math.cos(angle)*radiusX)),
      y: Math.min(84, Math.max(11, 43+Math.sin(angle)*radiusY)),
      scale: .85,
      delay: index * 45,
    }] as const;
  }));
}
