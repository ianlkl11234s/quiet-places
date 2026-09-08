"""Small deterministic, state-dependent shoal simulation.

This is intentionally a simple behavioural approximation, not fluid dynamics or
a biological measurement.  It integrates at 60 Hz and only samples at 30 Hz.
"""
from __future__ import annotations
import math
import random
from dataclasses import dataclass
from .config import *

Vec = list[float]
def add(a: Vec, b: Vec) -> Vec: return [a[i] + b[i] for i in range(3)]
def sub(a: Vec, b: Vec) -> Vec: return [a[i] - b[i] for i in range(3)]
def mul(a: Vec, s: float) -> Vec: return [a[i] * s for i in range(3)]
def dot(a: Vec, b: Vec) -> float: return sum(a[i] * b[i] for i in range(3))
def length(a: Vec) -> float: return math.sqrt(dot(a, a))
def norm(a: Vec) -> Vec:
    n = length(a)
    return mul(a, 1 / n) if n > 1e-9 else [0., 0., -1.]
def clamp(x: float, lo: float, hi: float) -> float: return max(lo, min(hi, x))

@dataclass
class Fish:
    position: Vec
    velocity: Vec
    length: float
    color: int
    phase: float
    seed: float
    state: int = 0
    reaction_at: float = -1.

class Shoal:
    def __init__(self) -> None:
        rng = random.Random(SEED)
        self.rng, self.time = rng, 0.
        self.fish: list[Fish] = []
        # The start is a loose plant-side macrostate. Each fish has a different
        # heading, phase and affinity, so it is not a fixed formation.
        for i in range(FISH_COUNT):
            # Rejection keeps actual body clearance from frame zero; it is not
            # an artificial lattice, because candidate angles/radii stay random.
            for _ in range(80):
                angle = rng.random() * math.tau
                radius = .18 + .56 * math.sqrt(rng.random())
                p = [1.18 + radius * math.cos(angle), .42 + rng.random() * .82,
                     -.38 + radius * .70 * math.sin(angle)]
                p[0] = clamp(p[0], -.65, 1.52); p[2] = clamp(p[2], -1.45, .65)
                if all(length(sub(p, other.position)) > .055 for other in self.fish): break
            heading = rng.random() * math.tau
            speed = .042 + rng.random() * .025
            self.fish.append(Fish(p, [math.cos(heading)*speed, (rng.random()-.5)*.012, math.sin(heading)*speed],
                                  BODY_LENGTH_MIN + rng.random()*(BODY_LENGTH_MAX-BODY_LENGTH_MIN),
                                  (0 if i < 15 else 1 if i < 18 else 2 if i < 21 else 3), rng.random()*math.tau, rng.random()*math.tau))
        self.start_positions = [f.position[:] for f in self.fish]
        self.start_velocities = [f.velocity[:] for f in self.fish]
        # major events are deliberately sparse, vary initiator, and include
        # route segments that cross the small physical aperture's light column.
        self.events = [
            # Fast portions are short local crossings (about .25-.55 m), not
            # an implausible claim that a 3.8 cm fish crosses the whole corridor
            # in a 1.5-second burst. Slow regrouping may subsequently travel farther.
            (16., 1, [.96,.72,-.82], 18), (43., 8, [1.26,.78,-.44], 11),
            (70., 15, [.82,.70,-.96], 13), (96., 5, [1.20,.68,-.28], 10),
        ]
        self.event_log: list[dict] = []
        self.active: tuple[float,int,Vec,int] | None = None
        self.next_event = 0

    def _begin_event(self, start: float, initiator: int, target: Vec, count: int) -> None:
        distances = sorted(((length(sub(f.position, self.fish[initiator].position)), i) for i, f in enumerate(self.fish)))
        members = [i for _, i in distances[:count]]
        for distance, i in distances[:count]:
            # .00-.04 base, distance response and jitter -> .05-.25 s wave.
            self.fish[i].reaction_at = start + .06 + clamp(distance * .11, 0, .12) + self.rng.uniform(-.01, .01)
        self.active = (start, initiator, target, count)
        self.event_log.append({'time':round(start,3),'initiator':initiator,'members':members,'target':target,
                               'reactionWindow':[round(min(self.fish[i].reaction_at for i in members)-start,3),round(max(self.fish[i].reaction_at for i in members)-start,3)]})

    def _base_state(self, fish: Fish, i: int, event_age: float | None) -> int:
        if event_age is not None and fish.reaction_at >= 0 and self.time >= fish.reaction_at:
            local = self.time - fish.reaction_at
            if local < .55: return 3
            if local < 2.05: return 4
            if local < 3.15: return 5
            return 6
        # restrained individual changes; names remain in the baked sample data.
        near_plant = length([fish.position[0]-1.43, 0., fish.position[2]+.38]) < .48
        cycle = (self.time + fish.seed * 3.1) % 23.
        if near_plant and cycle < 7.: return 1
        if cycle > 18. and i % 3 == 0: return 8
        if 10. < cycle < 13.: return 2
        if 15. < cycle < 16.2 and i % 5 == 0: return 7
        return 0

    def _plant_avoidance(self, p: Vec) -> Vec:
        # Stem (from wall side inward) and two branch lobes, expanded by fish body.
        volumes = [(1.57,.67,-.38,.16,.80,.13), (1.28,.92,-.13,.18,.23,.17), (1.28,.92,-.63,.18,.23,.17)]
        force = [0.,0.,0.]
        for x,y,z,rx,ry,rz in volumes:
            d=[(p[0]-x)/rx,(p[1]-y)/ry,(p[2]-z)/rz]; q=length(d)
            if q < 1.35: force=add(force,mul(norm(d), (1.35-q)*.36))
        return force

    def step(self, dt: float) -> None:
        self.time += dt
        if self.next_event < len(self.events) and self.time >= self.events[self.next_event][0]:
            e=self.events[self.next_event]; self._begin_event(*e); self.next_event += 1
        event_age = self.time-self.active[0] if self.active else None
        if event_age is not None and event_age > 7.0: self.active=None; event_age=None
        centroid = [sum(f.position[a] for f in self.fish)/FISH_COUNT for a in range(3)]
        updates: list[tuple[Vec,Vec,int,float]] = []
        for i,f in enumerate(self.fish):
            state=self._base_state(f,i,event_age)
            fast=state in (3,4,5)
            cohesion, separation, alignment, wander = ((.30,1.35,.82,.08) if fast else (.42,.72,.28,.45))
            neighbors=[o for j,o in enumerate(self.fish) if j!=i and length(sub(o.position,f.position))<.42]
            force=[0.,0.,0.]
            if neighbors:
                center=[sum(o.position[a] for o in neighbors)/len(neighbors) for a in range(3)]
                avg=[sum(o.velocity[a] for o in neighbors)/len(neighbors) for a in range(3)]
                force=add(force,mul(norm(sub(center,f.position)),cohesion))
                force=add(force,mul(norm(sub(avg,f.velocity)),alignment))
                for o in neighbors:
                    delta=sub(f.position,o.position); d=length(delta)
                    # Look .30 s ahead: brake/steer before centres meet instead
                    # of projecting overlapping samples after the fact.
                    predicted=add(delta,mul(sub(f.velocity,o.velocity),.30)); pd=length(predicted)
                    if d<.18 or pd<.14:
                        urgency=max((.18-d)/.18, (.14-pd)/.14)
                        force=add(force,mul(norm(add(delta,predicted)), separation * 4.5 * urgency))
            # Smooth correlated, individual wandering rather than per-frame dice.
            force=add(force,[wander*(.55*math.sin(.71*self.time+f.seed)+.25*math.sin(1.13*self.time+f.seed*2)),
                             wander*.15*math.sin(.47*self.time+f.seed*4),
                             wander*(.5*math.cos(.61*self.time+f.seed)+.2*math.sin(1.09*self.time))])
            if state == 1:
                force=add(force,mul(norm([1.35-f.position[0], .7-f.position[1], -.38-f.position[2]]), .24))
            elif state == 8:
                force=add(force,mul(norm([-.48-f.position[0], .65-f.position[1], -.95-f.position[2]]), .38))
            elif state == 7:
                force=add(force,mul(norm(sub(f.position,centroid)),.35))
            if fast and self.active:
                # Shared direction, offset destinations: transit stretches the
                # shoal instead of collapsing 18 centres into one waypoint.
                angle=i*2.399963229728653
                offset=[.34*math.cos(angle),.10*((i%5)-2),.34*math.sin(angle)]
                force=add(force,mul(norm(sub(add(self.active[2],offset),f.position)),1.18))
            elif state == 6 and self.active:
                force=add(force,mul(norm(sub(self.active[2],f.position)),.35))
            # Last eight seconds restore a *macrostate* through ordinary steering.
            restoring = self.time > 112.
            if restoring:
                # Converge through ordinary bounded steering toward the actual
                # initial loose arrangement; no frame is copied or teleported.
                force=add(force,mul(norm(sub(self.start_positions[i],f.position)), 2.0*((self.time-112)/8)))
            force=add(force,self._plant_avoidance(f.position))
            # Soft room bounds make edge recoveries continuous.
            for axis,(lo,hi) in enumerate(BOUNDS):
                margin=.14; value=f.position[axis]
                if value < lo+margin: force[axis]+=(lo+margin-value)*8
                if value > hi-margin: force[axis]-=(value-hi+margin)*8
            desired=FAST_SPEED_MIN + .06 if fast else .043 + .026*((math.sin(f.seed*7)+1)/2)
            if state==1: desired=.038
            if state==8: desired=.055
            if state==7: desired=.08
            if fast: desired=.17 + .05*((i*7)%5)/4
            closest=min((length(sub(f.position,o.position)) for j,o in enumerate(self.fish) if j!=i),default=1.)
            if closest < .10: desired=max(.035,desired*(.55 + .45*closest/.10))
            if restoring:
                remaining=max(.35, DURATION-self.time)
                desired=clamp(length(sub(self.start_positions[i],f.position))/remaining, .035, .14)
            desired_dir=norm(add(norm(f.velocity),mul(norm(force),.48)))
            desired_velocity=mul(desired_dir,desired)
            if restoring and self.time > 118.5:
                blend=clamp((self.time-118.5)/1.5,0.,1.); blend=blend*blend*(3-2*blend)
                desired_velocity=add(mul(desired_velocity,1-blend),mul(self.start_velocities[i],blend))
            delta=sub(desired_velocity,f.velocity); max_acc=(.35 if fast else (.18 if restoring else .11))*dt
            d=length(delta)
            if d>max_acc: delta=mul(delta,max_acc/d)
            velocity=add(f.velocity,delta)
            position=add(f.position,mul(velocity,dt))
            updates.append((position,velocity,state,desired))
        for f,(p,v,s,_) in zip(self.fish,updates): f.position,f.velocity,f.state=p,v,s
