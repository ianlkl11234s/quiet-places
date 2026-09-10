import assert from 'node:assert/strict';
import test from 'node:test';
import {places} from '../src/places/metadata.ts';
import type {PlaceId} from '../src/places/metadata.ts';
import {chooseInitialPlace, layoutMemoryBubbles} from '../src/ui/RoomBrowser.ts';

test('initial room respects direct links and returning preferences before random sampling', () => {
  assert.equal(chooseInitialPlace({requested:'seaward',preferred:'waterlight',places,hasStoredPreference:false,random:()=>0}), 'seaward');
  assert.equal(chooseInitialPlace({preferred:'leaflight',places,hasStoredPreference:true,random:()=>.99}), 'leaflight');
  assert.equal(chooseInitialPlace({preferred:'waterlight',places,hasStoredPreference:false,random:()=>0}), places[0].id);
  assert.equal(chooseInitialPlace({preferred:'waterlight',places,hasStoredPreference:false,random:()=>.999}), places.at(-1)?.id);
});

test('memory bubble layout centers the current room and remains deterministic', () => {
  const ids = places.map(place => place.id);
  const first = layoutMemoryBubbles(ids, 'afterlight');
  const second = layoutMemoryBubbles(ids, 'afterlight');
  assert.deepEqual(first, second);
  assert.deepEqual(first.get('afterlight'), {x:66,y:43,scale:1.18,delay:0});
  assert.equal(first.size, ids.length);
});

test('larger room catalogs use bounded non-overlapping memory-bubble rings', () => {
  const ids = Array.from({length:18}, (_, index) => `future-room-${index}` as PlaceId);
  const layout = layoutMemoryBubbles(ids, ids[0]);
  const positions = [...layout.values()];
  const coordinates = positions.map(position => `${position.x.toFixed(3)},${position.y.toFixed(3)}`);

  assert.equal(layout.size, ids.length);
  assert.equal(new Set(coordinates).size, coordinates.length);
  for (const position of positions) {
    assert.ok(position.x >= 35 && position.x <= 94);
    assert.ok(position.y >= 11 && position.y <= 84);
    assert.ok(position.scale >= .46);
  }
});
