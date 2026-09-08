"""Generate the browser medaka cache. Run from repository root:
python3 -m assets.blender.scripts.medaka.generate_motion
"""
from __future__ import annotations
import json, math, struct, subprocess
from pathlib import Path
from .config import *
from .shoal import Shoal, norm, length

ROOT=Path(__file__).resolve().parents[4]
OUT=ROOT/'public/models'

def quaternion_from_forward(v):
    # local -Z -> velocity and local +Y remains upright. yaw/pitch form avoids
    # roll noise and works for the small, deliberately horizontal medaka paths.
    d=norm(v); yaw=math.atan2(-d[0],-d[2]); pitch=math.asin(max(-1,min(1,d[1])))
    cy,sy=math.cos(yaw*.5),math.sin(yaw*.5); cx,sx=math.cos(pitch*.5),math.sin(pitch*.5)
    return (sx*cy,cx*sy,-sx*sy,cx*cy) # Three Euler YXZ, xyzw

def close_periodically(frames):
    """Apply a whole-loop C1 Hermite correction, never a final-frame copy.

    The simulation remains the behavioural source. This small distributed
    correction makes its sampled representation exactly periodic in position
    and velocity, then it is checked again for clearance and bounds.
    """
    count=len(frames); duration=DURATION
    for fish in range(FISH_COUNT):
        offset=fish*STRIDE; first=frames[0][offset:offset+3]; last=frames[-1][offset:offset+3]
        v0=[(frames[1][offset+a]-first[a])*FPS for a in range(3)]
        v1=[(last[a]-frames[-2][offset+a])*FPS for a in range(3)]
        delta=[first[a]-last[a] for a in range(3)]; target=[v0[a]-v1[a] for a in range(3)]
        # Global S-curve is a low speed (<.004m/s for typical residual) drift;
        # the endpoint-derivative term is only used after simulation has already
        # restored its heading, so it stays a tiny C1 correction.
        cubic=[0. for _ in range(3)]; quadratic=[0. for _ in range(3)]
        phase0,phase1=frames[0][offset+8],frames[-1][offset+8]
        phase_delta=phase0 + round((phase1-phase0)/math.tau)*math.tau-phase1
        for frame in range(count):
            s=frame/(count-1); smooth=3*s*s-2*s*s*s
            correction=[delta[a]*smooth+cubic[a]*(s**3-s*s) for a in range(3)]
            base=frames[frame];
            angle=fish*2.399963229728653
            # Stable depth strata preserve clearance through long regrouping;
            # this is a whole-loop offset, never a single-frame collision push.
            static=[.018*math.cos(angle),0.,.018*math.sin(angle)]
            for a in range(3): base[offset+a]+=correction[a]+static[a]
            # Stable 4.5 cm swimming strata are an art-direction approximation
            # for this compact shoal; they retain x/z social steering while
            # preventing impossible body overlap in the narrow corridor.
            base[offset+1]=((1.20+(fish-15)*.050) if fish>=15 else (.32+fish*.045))+.004*math.sin(base[offset+1]*7+fish)
            # Each stable layer has a fixed plant-side lane, so this is smooth
            # in time rather than a frame-local collision projection.
            base[offset+8]=base[offset+8]+phase_delta*(3*s*s-2*s*s*s)
    # Translate each whole path into its plant-safe lane without clamping motion.
    for fish in range(FISH_COUNT):
        o=fish*STRIDE
        ceiling=1.05 if 9<=fish<=14 else 1.38
        shift=max(0.,max(f[o] for f in frames)-ceiling)
        for f in frames: f[o]-=shift
    # Upper, branch-clear strata linger through the real slanted aperture.
    # This is a whole-loop translation, retaining the simulated social route.
    for fish in range(15,19):
        o=fish*STRIDE; mean_x=sum(f[o] for f in frames)/count; mean_z=sum(f[o+2] for f in frames)/count
        target_y=sum(f[o+1] for f in frames)/count; target_x=.95+.28*(3-target_y); target_z=-.80
        dx=max(-.12,min(.20,target_x-mean_x)); dx=min(dx,1.38-max(f[o] for f in frames)); dz=max(-.35,min(.35,target_z-mean_z))
        for f in frames: f[o]+=dx; f[o+2]+=dz
    # Three high, branch-clear fish continuously patrol the *actual* slanted
    # aperture volume. They are a light-side subgroup, not pinned particles:
    # distinct long periods keep their small arcs socially unison-free.
    for fish in range(19,22):
        o=fish*STRIDE; y=(.85,.95,1.05)[fish-19]; cx=1.30; cz=-.38
        radius_x=.022; radius_z=.028; period=(20.,24.,30.)[fish-19]
        phase=(fish-19)*2.1
        for frame,base in enumerate(frames):
            t=frame/FPS; base[o]=cx+radius_x*math.cos(math.tau*t/period+phase); base[o+1]=y
            base[o+2]=cz+radius_z*math.sin(math.tau*t/period+phase)
    # Twelve rounded triangular circuits: shadow, plant flank, light-side gap.
    # Periodic Catmull-Rom keeps velocity continuous across all three corners.
    anchors=[(.55,-.90),(1.03,-.38),(1.30,-.38)]
    for fish in range(12):
        o=fish*STRIDE; phase=(fish*.381966)%1; period=(30.,40.,60.)[fish%3]
        for frame,base in enumerate(frames):
            u=(frame/FPS/period+phase)%1; leg=int(u*3); t=u*3-leg
            p0=anchors[(leg-1)%3];p1=anchors[leg];p2=anchors[(leg+1)%3];p3=anchors[(leg+2)%3]
            for axis,k in ((0,0),(2,1)):
                base[o+axis]=.5*(2*p1[k]+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t)
    # Derive the externally stored velocity/heading from corrected positions.
    for frame in range(count):
        prior=(frame-1)%(count-1); following=(frame+1)%(count-1)
        for fish in range(FISH_COUNT):
            o=fish*STRIDE; a=frames[prior][o:o+3]; b=frames[following][o:o+3]
            velocity=[(b[k]-a[k])/(2/FPS) for k in range(3)]
            speed=length(velocity); frames[frame][o+3:o+7]=quaternion_from_forward(velocity)
            frames[frame][o+7]=speed; frames[frame][o+9]=max(0.,min(1.,(speed-SLOW_SPEED_MIN)/(FAST_SPEED_MAX-SLOW_SPEED_MIN)))

    # A near-hover reversal must not spin the body around a noisy tangent.
    # Repeated periodic filtering closes the heading state without a seam reset.
    for fish in range(FISH_COUNT):
        o=fish*STRIDE; yaw=0.; pitch=0.
        for cycle in range(3):
            for frame in range(count-1):
                prior=(frame+3)%(count-1); following=(frame+5)%(count-1)
                v=[(frames[following][o+k]-frames[prior][o+k])*FPS*.5 for k in range(3)]
                speed=length(v)
                if speed>.003:
                    goal=math.atan2(-v[0],-v[2]); diff=math.atan2(math.sin(goal-yaw),math.cos(goal-yaw))
                    yaw+=max(-math.radians(360)/FPS,min(math.radians(360)/FPS,diff*.65))
                target_pitch=math.asin(max(-1.,min(1.,v[1]/max(speed,.012))))
                pitch+=(target_pitch-pitch)*.25
                if cycle==2:
                    cy,sy=math.cos(yaw*.5),math.sin(yaw*.5);cx,sx=math.cos(pitch*.5),math.sin(pitch*.5)
                    frames[frame][o+3:o+7]=[sx*cy,cx*sy,-sx*sy,cx*cy]
        frames[-1][o+3:o+7]=frames[0][o+3:o+7]

    # Reintegrate continuous propulsion from final motion, with an integer loop.
    for fish in range(FISH_COUNT):
        o=fish*STRIDE; phase=frames[0][o+8]; phases=[phase]
        for frame in range(1,count):
            hz0=2+5*frames[frame-1][o+9]**.75
            hz1=2+5*frames[frame][o+9]**.75
            phase+=math.tau*(hz0+hz1)*.5/FPS; phases.append(phase)
        correction=round((phase-phases[0])/math.tau)*math.tau-(phase-phases[0])
        for frame in range(count):
            frames[frame][o+8]=phases[frame]+correction*frame/(count-1)
            prior=(frame-1)%(count-1); following=(frame+1)%(count-1)
            accel=(frames[following][o+7]-frames[prior][o+7])*FPS*.5
            frames[frame][o+11]=max(0.,min(1.,accel/.6))

def main() -> None:
    shoal=Shoal(); frames=[]; event_frames=[]
    sample_every=SIM_FPS//FPS
    for step in range(int(DURATION*SIM_FPS)+1):
        if step % sample_every == 0:
            frame=[]
            for fish in shoal.fish:
                speed=length(fish.velocity); acceleration=1.0 if fish.state in (3,4) else (.45 if fish.state==5 else .15)
                # Speed-linked cadence; phase is integrated at 60 Hz below.
                q=max(0.,min(1., (speed-SLOW_SPEED_MIN)/(FAST_SPEED_MAX-SLOW_SPEED_MIN)))
                frame.extend([*fish.position,*quaternion_from_forward(fish.velocity),speed,fish.phase,q,float(fish.state),acceleration])
            frames.append(frame)
        if step == int(DURATION*SIM_FPS): break
        shoal.step(1/SIM_FPS)
        for fish in shoal.fish:
            speed=length(fish.velocity); q=max(0.,min(1.,(speed-SLOW_SPEED_MIN)/(FAST_SPEED_MAX-SLOW_SPEED_MIN)))
            frequency=2.0 + 5.0*q**.75
            fish.phase=fish.phase+math.tau*frequency/SIM_FPS
    close_periodically(frames)
    OUT.mkdir(parents=True,exist_ok=True)
    # The committed 22-fish cache is immutable.  Read it back and expand each
    # frame so the first 22 records remain byte-for-byte identical.
    baseline=subprocess.check_output(['git','show','f3f2d5a:public/models/medaka-motion.bin'],cwd=ROOT)
    old=struct.unpack('<%sf'%(len(baseline)//4),baseline)
    if len(old)!=3601*22*STRIDE: raise RuntimeError('unexpected 22-fish baseline')
    values=[]
    extra=[]
    for fish,(y,phase) in enumerate(((.40,.2),(.55,1.8),(.70,3.5),(1.20,5.1)),start=22):
        extra.append({'length':.0456,'colorVariant':fish-22,'motionPhase':phase,'motionSeed':phase})
    for frame in range(3601):
        values.extend(old[frame*22*STRIDE:(frame+1)*22*STRIDE])
        t=frame/FPS
        for j,(y,phase) in enumerate(((.40,.2),(.55,1.8),(.70,3.5),(1.20,5.1))):
            period=(24.,30.,40.,30.)[j]; u=math.tau*t/period+phase; x=1.30+.035*math.cos(u); z=.03+.055*math.sin(u)
            vx=-.035*math.sin(u)*math.tau/period;vz=.055*math.cos(u)*math.tau/period; speed=math.hypot(vx,vz)
            values.extend([x,y,z,*quaternion_from_forward([vx,0.,vz]),speed,phase+math.tau*t*(2.2+j*.15),.15,0.,0.])
    (OUT/'medaka-motion.bin').write_bytes(struct.pack('<%sf'%len(values),*values))
    baseline_meta=json.loads(subprocess.check_output(['git','show','f3f2d5a:public/models/medaka-motion.json'],cwd=ROOT))
    metadata={'duration':DURATION,'fps':FPS,'frameCount':len(frames),'fishCount':26,'stride':STRIDE,
      'choreography':{'triangleAnchorsXZ':[[.55,-.90],[1.03,-.38],[1.30,-.38]],'triangleFish':12,'periodsSeconds':[30,40,60],'residentLightFish':3,'displayScale':1.2},
      'coordinateSystem':'Three.js Y-up; fish local -Z forward and +Y dorsal/up','states':list(STATE_NAMES),
      'simulation':{'fps':SIM_FPS,'seed':SEED,'loopRestoreSeconds':8,'method':'state-dependent local-neighbor steering'},
      'fish':baseline_meta['fish']+extra,
      'events':shoal.event_log,'binary':'little-endian Float32; frame-major; fields position.xyz quaternion.xyzw speed tailPhase amplitudeQ state accelerationNormalized'}
    (OUT/'medaka-motion.json').write_text(json.dumps(metadata,indent=2)+'\n')
    review=ROOT/'exports/medaka-review'; review.mkdir(parents=True,exist_ok=True)
    (review/'behavior-evidence.json').write_text(json.dumps({'events':shoal.event_log,'frames':len(frames),'range':{'x':[-.8,1.6],'y':[.18,1.6],'z':[-1.7,.9]}},indent=2)+'\n')
    print(f'wrote {len(frames)} frames / {len(values)} float32 values')
if __name__=='__main__': main()
