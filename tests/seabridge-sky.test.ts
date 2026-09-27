import assert from 'node:assert/strict';
import test from 'node:test';
import {moonDirection,seabridgeDaylight,sunDirection} from '../src/places/seabridge/Daylight.ts';
import {sampleTime} from '../src/systems/TimeOfDay.ts';

const alt=(v:{y:number})=>Math.asin(v.y)*180/Math.PI;
const crossing=(f:(h:number)=>{y:number},from:number,to:number)=>{for(let h=from;h<to;h+=1/60)if(Math.sign(f(h).y)!==Math.sign(f(h+1/60).y))return h;return NaN;};

test('sun rises behind the viewer, peaks in the south and sets over the sea',()=>{
 const rise=crossing(sunDirection,4,9),set=crossing(sunDirection,15,21);
 assert.ok(rise>5.8&&rise<6.4,`rise ${rise}`);assert.ok(set>17.6&&set<18.2,`set ${set}`);
 assert.ok(sunDirection(7).z>.5,'morning sun on the land side (+Z)');
 assert.ok(sunDirection(17.5).z<-.7,'evening sun over the sea (-Z)');
 assert.ok(Math.abs(alt(sunDirection(12))-61.5)<1.5,'noon altitude for latitude 26.5°');
 assert.ok(sunDirection(12).x<-.3,'noon sun to the south (-X)');
});

test('the shifted full-moon arc is over the bridge at 23:00 and sets about 01:00',()=>{
 assert.ok(Math.abs(alt(moonDirection(23))-27)<2,`23:00 altitude ${alt(moonDirection(23))}`);
 assert.ok(moonDirection(23).z<-.6,'23:00 moon over the sea side');
 const set=crossing(h=>moonDirection(h%24),24,27)%24;assert.ok(set>.6&&set<1.5,`moonset ${set}`);
});

test('scene light never comes from below the horizon at any hour',()=>{
 for(let h=0;h<24;h+=.25){const l=seabridgeDaylight(sampleTime(h));assert.ok(l.sun.y>=Math.sin(3*Math.PI/180)-1e-6,`hour ${h}: ${l.sun.y}`);assert.ok(Number.isFinite(l.solar)&&l.solar>=0);}
});
