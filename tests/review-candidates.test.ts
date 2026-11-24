import assert from 'node:assert/strict';
import test from 'node:test';
import {biologyCandidatesEnabled} from '../src/shared/review/candidates.ts';
import {createLongFinKoiSchool} from '../src/places/waterlight/LongFinKoiMotion.ts';
import type {FishSchoolOptions} from '../src/places/waterlight/FishSchool.ts';
import {ArcadeAnimalMotion} from '../src/places/last-arcade/biology/Motion.ts';
import {AntarcticBehavior} from '../src/places/snowhall/AntarcticBehavior.ts';
import type {SchoolCandidateOptions} from '../src/systems/schooling/candidates.ts';
import {resolveSchoolCandidates} from '../src/systems/schooling/candidates.ts';

test('candidates are on when there is no location (Node)', () => {
  assert.equal(biologyCandidatesEnabled(), true);
});

test('every factory accepts the all-off values used by ?bio=off', () => {
  const koi: FishSchoolOptions = {turnBend: 0, bodyLengthFrequency: false, pointerResponse: 0};
  assert.ok(createLongFinKoiSchool(undefined, koi));
  const school: SchoolCandidateOptions = {burstCoast: false, topologicalNeighbours: 0, flashBank: 0, pointerResponse: 0};
  assert.deepEqual(resolveSchoolCandidates(school, .5), {burstCoast: false, neighbours: 0, flashBank: 0, pointerResponse: 0});
  assert.ok(new ArcadeAnimalMotion(false, {speedCoupledFlap: false, tailFollow: false}));
  assert.ok(new AntarcticBehavior(1, {bankDegrees: 0}));
});
