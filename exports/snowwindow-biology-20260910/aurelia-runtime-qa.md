# Aurelia runtime QA — local candidate

- Entry: `src/shared/biology/aurelia/Aurelia.ts`
- Local convention: bell apex and propulsion are `+Z`; scene adapter owns the Three.js Y-up rotation and all root trajectory.
- Geometry: closed two-surface shallow bell with radial edge closure, 4 separate horseshoe gonads, 16 radial canals plus ring canal and 16 paired branch tubes, 4 frilled oral-arm ribbons, 128 short tentacles driven by 32 PBD guides, and 8 rhopalia regions.
- Animation: analytic continuous phase; 0.30 contraction / 0.45 relaxation / 0.25 glide; fixed 120 Hz second-order eight-sector margin response. The `0.80..1.00` radial flap is an implementation approximation of the cited exumbrellar-arclength observation, not a direct coordinate conversion.
- Force diagnostics: `thrustProxy` and decaying `passiveEnergyRecapture` are animation calibration outputs. They are not CFD or biological force measurements.
- Local validation: `node --experimental-strip-types --test tests/aurelia.test.ts` passed 6/6 and `npx tsc --noEmit` passed on 2026-09-10. This does not validate browser transparency sorting, scene lighting, Blender bake, or biological fidelity.
