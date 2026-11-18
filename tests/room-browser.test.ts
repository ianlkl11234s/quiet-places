import assert from 'node:assert/strict';
import test from 'node:test';
import {places} from '../src/places/metadata.ts';
import {chooseInitialPlace, nextRoomIndex} from '../src/ui/RoomBrowser.ts';

test('initial room respects direct links and returning preferences before random sampling', () => {
  assert.equal(chooseInitialPlace({requested:'seaward',preferred:'waterlight',places,hasStoredPreference:false,random:()=>0}), 'seaward');
  assert.equal(chooseInitialPlace({preferred:'leaflight',places,hasStoredPreference:true,random:()=>.99}), 'leaflight');
  assert.equal(chooseInitialPlace({preferred:'waterlight',places,hasStoredPreference:false,random:()=>0}), places[0].id);
  assert.equal(chooseInitialPlace({preferred:'waterlight',places,hasStoredPreference:false,random:()=>.999}), places.at(-1)?.id);
});

test('every room carries a life label for the wall', () => {
  assert.ok(places.every(place => typeof place.life === 'string' && place.life.length > 0));
});

test('room grid keys move by one, by a row, and clamp at the ends', () => {
  assert.equal(nextRoomIndex(4, 10, 5, 'ArrowRight'), 5);
  assert.equal(nextRoomIndex(4, 10, 5, 'ArrowLeft'), 3);
  assert.equal(nextRoomIndex(2, 10, 5, 'ArrowDown'), 7);
  assert.equal(nextRoomIndex(7, 10, 5, 'ArrowUp'), 2);
  assert.equal(nextRoomIndex(8, 10, 5, 'ArrowDown'), 9);
  assert.equal(nextRoomIndex(1, 10, 5, 'ArrowUp'), 0);
  assert.equal(nextRoomIndex(0, 10, 5, 'ArrowLeft'), 0);
  assert.equal(nextRoomIndex(9, 10, 5, 'ArrowRight'), 9);
  assert.equal(nextRoomIndex(4, 10, 2, 'Home'), 0);
  assert.equal(nextRoomIndex(4, 10, 2, 'End'), 9);
  assert.equal(nextRoomIndex(3, 10, 0, 'ArrowDown'), 4);
});
