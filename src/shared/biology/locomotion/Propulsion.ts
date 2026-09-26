/**
 * Shared propulsion cadence (Q1-3b) and hover (Q1-3c).
 *
 * f = f0 + U / (k * BL). U is swim speed (m/s), BL body length (m), k the
 * distance travelled per tail beat in body lengths (dimensionless), f0 the
 * zero-speed cadence (Hz). Its linear form follows the familiar
 * "tail-beat frequency rises linearly with speed" relation for body-caudal
 * swimmers; every f0/k/maxFrequency value passed by a consumer is species art
 * calibration, not a measurement. Phase must be integrated from f, never
 * computed from an elapsed clock, so cadence changes do not jump the wave.
 */

export interface TailBeatParams {
  /** Cadence at zero speed, Hz. */
  f0: number;
  /** Body lengths travelled per beat (stride), dimensionless, > 0. */
  k: number;
  /** Upper clamp, Hz. */
  maxFrequency: number;
}

/** Tail-beat frequency in Hz for speed `speed` (m/s) and body length `bodyLength` (m). */
export function tailBeatFrequency(speed: number, bodyLength: number, params: TailBeatParams): number {
  const u = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  const length = Number.isFinite(bodyLength) && bodyLength > 0 ? bodyLength : 1;
  return Math.min(params.maxFrequency, params.f0 + u / (Math.max(1e-6, params.k) * length));
}

/** Integrates phase in cycles (not radians). Non-positive/invalid dt keeps the phase. */
export function advancePhaseCycles(phaseCycles: number, frequency: number, dt: number): number {
  return dt > 0 && Number.isFinite(dt) && Number.isFinite(frequency) ? phaseCycles + frequency * dt : phaseCycles;
}

export interface HoverParams {
  /** At or below this speed (body lengths/s) the fish is fully hovering. */
  hoverSpeedBL: number;
  /** At or above this speed (body lengths/s) the fish is fully swimming. */
  swimSpeedBL: number;
  /** Tail amplitude multiplier left while fully hovering (0 = still tail). */
  residualTail: number;
  /** Peak pectoral sculling angle while fully hovering, rad. */
  pectoralAmplitude: number;
}

/** 1 = hovering, 0 = swimming; smoothstep in speed/BL. */
export function hoverWeight(speed: number, bodyLength: number, params: HoverParams): number {
  const length = Number.isFinite(bodyLength) && bodyLength > 0 ? bodyLength : 1;
  const bl = (Number.isFinite(speed) ? Math.max(0, speed) : 0) / length;
  const {hoverSpeedBL: a, swimSpeedBL: b} = params;
  if (!(b > a)) return bl <= a ? 1 : 0;
  const t = Math.min(1, Math.max(0, (bl - a) / (b - a)));
  return 1 - t * t * (3 - 2 * t);
}

/** Tail amplitude multiplier: 1 while swimming, `residualTail` while hovering. */
export function hoverTailScale(hover: number, params: HoverParams): number {
  return 1 - hover * (1 - params.residualTail);
}

/**
 * Pectoral sculling angles (rad) for the left/right fin, each in its own
 * mirrored fin frame. `phase` is any integrated phase in radians (callers reuse
 * their propulsion phase so pause/seek stay reproducible). The two fins
 * alternate (half a cycle apart) while hovering.
 */
export function pectoralScull(phase: number, hover: number, params: HoverParams): {left: number; right: number} {
  const amplitude = params.pectoralAmplitude * Math.min(1, Math.max(0, hover));
  return {left: amplitude * Math.sin(phase), right: amplitude * Math.sin(phase + Math.PI)};
}
