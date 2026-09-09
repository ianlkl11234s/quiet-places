import * as THREE from 'three';

const TAU = Math.PI * 2;
const SHARK_LENGTH = .9;
const ROUTE_STEPS = 16384;

export interface SharkSpineSample {
  /** 0 at the head and 1 at the tail. */
  s: number;
  /** Local, metre-space displacement. The model faces local +X. */
  offset: THREE.Vector3;
  /** Unit nose-facing local spine direction, for independently posed bones. */
  tangent: THREE.Vector3;
  amplitude: number;
}

export interface SharkMotionSample {
  position: THREE.Vector3;
  /** Direction of the art-directed head pose; movement may climb more steeply. */
  direction: THREE.Vector3;
  quaternion: THREE.Quaternion;
  speed: number;
  /** Tail beat frequency, derived from U, Strouhal number, and peak-to-peak A. */
  frequency: number;
  /** Continuous, unwrapped wave phase in radians. */
  phase: number;
  /** Signed route curvature in m^-1. */
  turnCurvature: number;
  /** 0–1 rear-body turn bias (B_turn), used to widen the tail in a corner. */
  turnBias: number;
  bank: number;
  /** Positive means an ascent in the presentation convention. */
  pitch: number;
  wavelengthRatio: number;
  length: number;
  spine: readonly SharkSpineSample[];
}

/** Shared dense-friendly stations; consumers may interpolate for their own rig. */
export const SHARK_SPINE_S = [0, .06, .13, .21, .30, .40, .51, .61, .70, .78, .84, .89, .93, .96, .985, 1] as const;

type RouteState = { position: THREE.Vector3; tangent: THREE.Vector3; curvature: number };

// Three coordinates: x horizontal, y up, z along each stair flight.  This lane
// stays inside the sealed room and keeps the .9 m animal plus its .081 m tail
// excursion away from the walls, treads and U handrail.  The steep geometric
// climbs are intentionally posed with only a small body pitch: an air-swimming
// art approximation, not a claim of literal hydrodynamics.
const ROUTE = [
  // Outbound: lower platform -> lower flight -> central landing -> upper flight.
  new THREE.Vector3(.80,-1.05,3.25),
  new THREE.Vector3(.80,-.98,2.68),
  new THREE.Vector3(.80,-.45,1.72),
  new THREE.Vector3(.74,.23,.52),
  new THREE.Vector3(.40,.64,-.58),
  new THREE.Vector3(-.64,.78,-.66),
  new THREE.Vector3(-1.23,1.00,-.10),
  new THREE.Vector3(-1.25,1.68,1.18),
  new THREE.Vector3(-1.25,2.40,2.85),
  // Upper platform U turn, at one floor level. No drop through the stairwell.
  new THREE.Vector3(-1.32,2.42,3.25),
  new THREE.Vector3(-1.244,2.42,3.434),
  new THREE.Vector3(-1.06,2.42,3.51),
  new THREE.Vector3(-.876,2.42,3.434),
  new THREE.Vector3(-.80,2.42,3.25),
  new THREE.Vector3(-.87,2.40,2.85),
  // Return alongside the same two stair flights, back through the same landing.
  new THREE.Vector3(-.87,1.68,1.18),
  new THREE.Vector3(-.88,1.00,-.05),
  new THREE.Vector3(-.60,.78,-.60),
  new THREE.Vector3(.15,.64,-.60),
  new THREE.Vector3(.32,.59,-.06),
  new THREE.Vector3(.32,-.15,1.20),
  new THREE.Vector3(.32,-.98,2.68),
  new THREE.Vector3(.32,-1.05,3.25),
  // Lower platform U turn, then repeat with subtle timing/position variations.
  new THREE.Vector3(.39,-1.05,3.42),
  new THREE.Vector3(.56,-1.05,3.49),
  new THREE.Vector3(.73,-1.05,3.42),
] as const;
const ROUTE_CURVE = new THREE.CatmullRomCurve3(ROUTE.map(point => point.clone()), true, 'centripetal');

const ARC_LENGTHS = buildArcLengths();
const ROUTE_LENGTH = ARC_LENGTHS[ROUTE_STEPS];

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function catmull(phase: number, target = new THREE.Vector3()): THREE.Vector3 {
  return ROUTE_CURVE.getPoint(modulo(phase, TAU) / TAU, target);
}

function buildArcLengths(): Float64Array {
  const lengths = new Float64Array(ROUTE_STEPS + 1);
  const previous = catmull(0);
  const next = new THREE.Vector3();
  for (let step = 1; step <= ROUTE_STEPS; step++) {
    catmull(step / ROUTE_STEPS * TAU, next);
    lengths[step] = lengths[step - 1] + next.distanceTo(previous);
    previous.copy(next);
  }
  return lengths;
}

function phaseAtDistance(distance: number): number {
  const wanted = modulo(distance, ROUTE_LENGTH);
  let lo = 0, hi = ROUTE_STEPS;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >>> 1;
    if (ARC_LENGTHS[mid] < wanted) lo = mid; else hi = mid;
  }
  const span = ARC_LENGTHS[hi] - ARC_LENGTHS[lo];
  return ((lo + (span ? (wanted - ARC_LENGTHS[lo]) / span : 0)) / ROUTE_STEPS) * TAU;
}

function speedAt(time: number): number {
  // Two incommensurate gentle terms retain a non-zero cruise speed and prevent
  // the route from becoming an exactly repeating clock.
  return .37 + .030 * Math.sin(TAU * time / 43.7 + .38) + .015 * Math.sin(TAU * time / 61.1 + 1.7);
}

function distanceAt(time: number): number {
  const integral = (period: number, phase: number) => -period / TAU * (Math.cos(TAU * time / period + phase) - Math.cos(phase));
  return .37 * time + .030 * integral(43.7, .38) + .015 * integral(61.1, 1.7);
}

function geometryAtDistance(distance: number): RouteState {
  const phase = phaseAtDistance(distance);
  const position = catmull(phase);
  const tangent = catmull(phase + .0008).sub(catmull(phase - .0008)).normalize();
  const beforeTangent = position.clone().sub(catmull(phase - .16)).normalize();
  const afterTangent = catmull(phase + .16).sub(position).normalize();
  const signed = Math.atan2(beforeTangent.clone().cross(afterTangent).y, beforeTangent.dot(afterTangent));
  const localLength = catmull(phase + .16).distanceTo(catmull(phase - .16));
  return {position,tangent,curvature:localLength > 1e-7 ? signed/localLength : 0};
}
const turnAtDistance=(distance:number)=>THREE.MathUtils.clamp(Math.abs(geometryAtDistance(distance).curvature)/1.5,0,1);
// Integrate extra travel time at corners in distance-space. Inverting this
// table makes the actual position slow down, not merely the reported speed.
const TRAVEL = new Float64Array(ROUTE_STEPS+1);
for(let i=1;i<=ROUTE_STEPS;i++){
  const a=(i-1)*ROUTE_LENGTH/ROUTE_STEPS,b=i*ROUTE_LENGTH/ROUTE_STEPS;
  TRAVEL[i]=TRAVEL[i-1]+(b-a)*.5*(1/(1-.06*turnAtDistance(a))+1/(1-.06*turnAtDistance(b)));
}
function travelledDistance(time:number):number{
  const wanted=modulo(distanceAt(time),TRAVEL[ROUTE_STEPS]);
  let lo=0,hi=ROUTE_STEPS;
  while(lo+1<hi){const mid=(lo+hi)>>>1;if(TRAVEL[mid]<wanted)lo=mid;else hi=mid;}
  return (lo+(wanted-TRAVEL[lo])/(TRAVEL[hi]-TRAVEL[lo]))*ROUTE_LENGTH/ROUTE_STEPS;
}
function routeState(time: number): RouteState {
  const {position,tangent,curvature}=geometryAtDistance(travelledDistance(time));
  // A 1.2 cm deterministic horizontal drift helps the path breathe without eroding
  // the clearance budget. It is applied after curvature sampling on purpose.
  position.x += .012 * Math.sin(TAU * time / 67.3 + .4);
  position.y += .04 + .025 * Math.sin(TAU * time / 47.9 + 1.2);
  return { position, tangent, curvature };
}

function turnStrengthAt(time: number): number {
  return THREE.MathUtils.clamp(Math.abs(routeState(time).curvature) / 1.5, 0, 1);
}

function swimTerms(time: number) {
  const turn = turnStrengthAt(time);
  // Corners lose forward speed but increase St within the requested .25–.35
  // range, and widen the tail by 5%. This raises cadence through St*U/A rather
  // than by applying an unrelated animation multiplier.
  // The inverted travel table applies this same cruise speed to position.
  // Centimetre-scale low-frequency lane drift is excluded from propulsion.
  const speed = speedAt(time)*(1-.06*turn);
  const strouhal = .27 + .07 * turn;
  const tailScale = 1 + .05 * turn;
  const tailPeakToPeak = 2 * .09 * SHARK_LENGTH * tailScale;
  return { turn, speed, strouhal, tailScale, frequency: strouhal * speed / tailPeakToPeak };
}

// Deterministic quadrature cache. Extend on demand instead of freezing phase
// at a fixed horizon. Seeking back reuses identical samples; no animation clock.
const PHASE_STEP = .02;
const PHASE_TABLE:number[] = [0];
function integratedPhaseAt(time: number): number {
  const scaled = Math.max(0,time)/PHASE_STEP;
  const index = Math.floor(scaled);
  while(PHASE_TABLE.length<=index+1){
    const i=PHASE_TABLE.length;
    PHASE_TABLE.push(PHASE_TABLE[i-1]+(swimTerms((i-1)*PHASE_STEP).frequency+swimTerms(i*PHASE_STEP).frequency)*.5*PHASE_STEP*TAU);
  }
  return THREE.MathUtils.lerp(PHASE_TABLE[index],PHASE_TABLE[index+1],scaled-index);
}

function waveState(time: number): { speed: number; frequency: number; phase: number; wavelengthRatio: number; tailScale: number; turn: number } {
  const terms = swimTerms(time);
  const phase = integratedPhaseAt(time);
  const wavelengthRatio = .98 + .08 * Math.sin(TAU * time / 71.3 + .7);
  return { ...terms, phase, wavelengthRatio };
}

function sampleSpine(phase: number, wavelengthRatio: number, tailScale: number, curvature: number): readonly SharkSpineSample[] {
  const wavelength = wavelengthRatio * SHARK_LENGTH;
  return SHARK_SPINE_S.map(s => {
    const amplitude = SHARK_LENGTH * (.009 + (.09 * tailScale - .009) * Math.pow(s, 2.2));
    const localPhase = phase - TAU * (s * SHARK_LENGTH / wavelength);
    // A bounded C-shaped rear bias lets the head lead while the tail trails
    // the corner. Zero at the head, max ~4 cm, no rigid whole-body turn.
    const bend = -.04 * Math.tanh(curvature / 1.5);
    const x = amplitude * Math.sin(localPhase) + bend*s*s;

    const amplitudeDerivative = SHARK_LENGTH * (.09 * tailScale - .009) * 2.2 * Math.pow(s, 1.2);
    const dxds = amplitudeDerivative * Math.sin(localPhase) - amplitude * Math.cos(localPhase) * TAU * SHARK_LENGTH / wavelength + 2*bend*s;
    return {
      s, amplitude,
      // The GLB nose is +X and its independently placed bone roots run from
      // x=.45 (head) to x=-.45 (tail). Lateral bend is therefore local Z.
      // Offset is relative to each bone's rest head, never a second longitudinal
      // translation. Tangent faces toward the model's +X nose.
      offset: new THREE.Vector3(0, 0, x),
      tangent: new THREE.Vector3(SHARK_LENGTH, 0, -dxds).normalize(),
    };
  });
}

/**
 * Pure, deterministic patrol choreography. Equal elapsed values always return
 * equal values, so a paused player does not accumulate any hidden steering.
 */
export function sampleSharkMotion(elapsed: number): SharkMotionSample {
  const time = Number.isFinite(elapsed) ? Math.max(0,elapsed) : 0;
  const route = routeState(time);
  const wave = waveState(time);
  const horizontal = new THREE.Vector3(route.tangent.x, 0, route.tangent.z).normalize();
  const curvature = THREE.MathUtils.clamp(route.curvature, -1.5, 1.5);
  // Bank into the corner about the longitudinal axis; nearly level on straights.
  const bank = -THREE.MathUtils.degToRad(12)*Math.tanh(curvature/1.2);
  const climb = route.tangent.y;
  // Body pitch deliberately remains small even while the route follows stairs.
  const smooth = (value: number, edge0: number, edge1: number) => {
    const u = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return u * u * (3 - 2 * u);
  };
  const pitch = climb > 0
    ? (3 + 5 * smooth(climb, .04, .42)) * Math.PI / 180 * smooth(climb, .005, .04)
    : climb < 0
      ? -(2 + 4 * smooth(-climb, .04, .42)) * Math.PI / 180 * smooth(-climb, .005, .04)
      : 0;
  const direction = new THREE.Vector3(horizontal.x * Math.cos(pitch), Math.sin(pitch), horizontal.z * Math.cos(pitch));
  // Explicit +X nose/+Y dorsal/+Z lateral basis avoids setFromUnitVectors'
  // arbitrary roll when the heading approaches -X. Pitch is already embodied
  // by the forward vector; bank then rolls only the dorsal/lateral frame.
  const lateral = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
  const dorsal = new THREE.Vector3().crossVectors(lateral, direction).normalize();
  lateral.applyAxisAngle(direction, bank);
  dorsal.applyAxisAngle(direction, bank);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(direction, dorsal, lateral));
  return {
    position: route.position, direction, quaternion,
    speed: wave.speed, frequency: wave.frequency, phase: wave.phase,
    turnCurvature: curvature, turnBias: wave.turn, bank, pitch, wavelengthRatio: wave.wavelengthRatio,
    length: SHARK_LENGTH, spine: sampleSpine(wave.phase, wave.wavelengthRatio, wave.tailScale,curvature),
  };
}
